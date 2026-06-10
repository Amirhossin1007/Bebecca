"""
Functions for managing proxy hosts, users, user templates, nodes, and administrative tasks.
"""

import logging
from datetime import datetime, timedelta, timezone
from typing import Dict, List, Optional, Set

from sqlalchemy import delete, func, inspect
from sqlalchemy.orm import Session
from sqlalchemy.orm.attributes import set_committed_value
from app.db.models import (
    Admin,
    AdminServiceLink,
    Proxy,
    ProxyTypes,
    Service,
    User,
    excluded_inbounds_association,
)
from app.utils.credentials import (
    serialize_proxy_settings,
)
from app.models.proxy import ProxySettings
from app.models.xray_account import XTLSFlows
from app.models.user import (
    UserStatus,
)

# Imported inside functions to avoid circular import
# from .usage import _get_usage_data, _get_usage_timeseries
# from .user import get_user_queryset, _apply_service_filter
from .proxy import get_or_create_inbound

_USER_STATUS_ENUM_ENSURED = False

_logger = logging.getLogger(__name__)
_RECORD_CHANGED_ERRNO = 1020
ADMIN_DATA_LIMIT_EXHAUSTED_REASON_KEY = "admin_data_limit_exhausted"

# ============================================================================


class ServiceRepository:
    def __init__(self, db: Session):
        self.db = db

    def ensure_admin_service_link(self, admin: Optional[Admin], service: Service) -> None:
        if not admin or admin.id is None or service.id is None:
            return

        link_exists = (
            self.db.query(AdminServiceLink)
            .filter(
                AdminServiceLink.admin_id == admin.id,
                AdminServiceLink.service_id == service.id,
            )
            .first()
        )
        if link_exists:
            return

        self.db.add(AdminServiceLink(admin_id=admin.id, service_id=service.id))

    @staticmethod
    def compute_allowed_inbounds(service: Service) -> Dict[ProxyTypes, Set[str]]:
        from sqlalchemy.orm import object_session
        from app.services.data_access import get_inbounds_by_tag_cached

        allowed: Dict[ProxyTypes, Set[str]] = {}
        if service is None:
            return allowed

        db = object_session(service)
        inbound_map = get_inbounds_by_tag_cached(db) if db is not None else {}

        for link in service.host_links:
            host = link.host
            if not host or host.is_disabled:
                continue
            inbound_tag = host.inbound_tag
            inbound_info = inbound_map.get(inbound_tag)
            if not inbound_info:
                continue
            protocol = inbound_info.get("protocol")
            if not protocol:
                continue
            try:
                proxy_type = ProxyTypes(protocol)
            except ValueError:
                continue
            allowed.setdefault(proxy_type, set()).add(inbound_tag)

        return allowed

    def apply_service_to_user(
        self,
        dbuser: User,
        service: Service,
        allowed_inbounds: Optional[Dict[ProxyTypes, Set[str]]] = None,
    ) -> None:
        if allowed_inbounds is None:
            allowed_inbounds = self.compute_allowed_inbounds(service)

        allowed_protocols = set(allowed_inbounds.keys())
        existing_proxies: Dict[ProxyTypes, Proxy] = {}

        for proxy in list(dbuser.proxies):
            proxy_type = ProxyTypes(proxy.type)
            if proxy_type not in allowed_protocols:
                if inspect(proxy).persistent:
                    self.db.delete(proxy)
                elif proxy in dbuser.proxies:
                    dbuser.proxies.remove(proxy)
                continue
            existing_proxies[proxy_type] = proxy

        for proxy_type in allowed_protocols:
            allowed_tags = allowed_inbounds[proxy_type]
            proxy = existing_proxies.get(proxy_type)
            if not proxy:
                settings_model = proxy_type.settings_model()
                if hasattr(settings_model, "flow"):
                    settings_model.flow = XTLSFlows.NONE
                serialized = serialize_proxy_settings(settings_model, proxy_type, dbuser.credential_key)
                proxy = Proxy(type=proxy_type.value, settings=serialized)
                dbuser.proxies.append(proxy)
            else:
                if hasattr(proxy_type.settings_model, "model_validate"):
                    settings_obj = proxy_type.settings_model.model_validate(proxy.settings or {})
                else:
                    settings_obj = proxy.settings or {}
                if isinstance(settings_obj, ProxySettings):
                    if hasattr(settings_obj, "flow"):
                        settings_obj.flow = XTLSFlows.NONE
                    proxy.settings = serialize_proxy_settings(
                        settings_obj,
                        proxy_type,
                        dbuser.credential_key,
                        preserve_existing_uuid=True,
                    )

            from app.services.data_access import get_inbounds_by_tag_cached

            proxy_type_value = proxy_type.value if hasattr(proxy_type, "value") else str(proxy_type)
            inbound_map = get_inbounds_by_tag_cached(self.db)
            available_tags = {
                tag for tag, inbound in inbound_map.items() if inbound.get("protocol") == proxy_type_value
            }
            excluded_tags = sorted(available_tags - set(allowed_tags))
            inbound_objs = [get_or_create_inbound(self.db, tag) for tag in excluded_tags]
            if proxy.id is None:
                proxy.excluded_inbounds = inbound_objs
            else:
                self.db.execute(
                    delete(excluded_inbounds_association).where(excluded_inbounds_association.c.proxy_id == proxy.id)
                )
                if excluded_tags:
                    self.db.execute(
                        excluded_inbounds_association.insert(),
                        [{"proxy_id": proxy.id, "inbound_tag": tag} for tag in excluded_tags],
                    )
                set_committed_value(proxy, "excluded_inbounds", inbound_objs)

        dbuser.service = service
        dbuser.edit_at = datetime.now(timezone.utc)

    def refresh_users(
        self, service: Service, allowed_inbounds: Optional[Dict[ProxyTypes, Set[str]]] = None
    ) -> List[User]:
        if allowed_inbounds is None:
            allowed_inbounds = self.compute_allowed_inbounds(service)
        updated_users: List[User] = []
        for user in service.users:
            if user.status == UserStatus.deleted:
                continue
            self.apply_service_to_user(user, service, allowed_inbounds)
            updated_users.append(user)
        self.db.flush()
        return updated_users

    def get_allowed_inbounds(self, service: Service) -> Dict[ProxyTypes, Set[str]]:
        return self.compute_allowed_inbounds(service)


def _apply_service_to_user(
    db: Session,
    dbuser: User,
    service: Service,
    allowed_inbounds: Optional[Dict[ProxyTypes, Set[str]]] = None,
) -> None:
    ServiceRepository(db).apply_service_to_user(dbuser, service, allowed_inbounds)


def _service_allowed_inbounds(service: Service) -> Dict[ProxyTypes, Set[str]]:
    return ServiceRepository.compute_allowed_inbounds(service)


def _ensure_admin_service_link(db: Session, admin: Optional[Admin], service: Service) -> None:
    ServiceRepository(db).ensure_admin_service_link(admin, service)


def count_users(
    db: Session,
    admin: Optional[Admin] = None,
    service_id: Optional[int] = None,
    service_without_assignment: bool = False,
) -> int:
    """Return a lightweight count of users respecting admin/service filters."""
    from .user import get_user_queryset, _apply_service_filter

    query = get_user_queryset(db, eager_load=False)
    if admin:
        query = query.filter(User.admin == admin)
    query = _apply_service_filter(
        query,
        service_id=service_id,
        service_without_assignment=service_without_assignment,
    )
    return query.count()


def count_online_users(db: Session, hours: int | None = None, admin: Admin | None = None):
    from app.db.crud.user import ONLINE_ACTIVE_WINDOW  # lazy import to avoid circulars

    window = timedelta(hours=hours) if hours is not None else ONLINE_ACTIVE_WINDOW
    twenty_four_hours_ago = datetime.now(timezone.utc) - window
    query = db.query(func.count(User.id)).filter(
        User.online_at.isnot(None),
        User.online_at >= twenty_four_hours_ago,
    )
    if admin and admin.id is not None:
        query = query.filter(User.admin_id == admin.id)
    return query.scalar() or 0
