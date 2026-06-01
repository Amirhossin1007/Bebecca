from __future__ import annotations

from typing import Any, Optional

from app.db import SessionLocal, crud
from app.db.models import Admin as DBAdmin
from app.models.admin import AdminRole
from app.models.user import UserResponse, UsersResponse, UserStatus
from app.services.go_usage import GoUsageError, GoUsageUnavailable, call_bridge
from app.utils.request_context import subscription_request_origin
from app.utils.subscription_links import build_subscription_links


def _enum_value(value: Any) -> Any:
    return value.value if hasattr(value, "value") else value


def _admin_payload(dbadmin: Any) -> dict[str, Any]:
    if not dbadmin:
        return {}
    return {
        "id": getattr(dbadmin, "id", None),
        "username": getattr(dbadmin, "username", "") or "",
        "role": _enum_value(getattr(dbadmin, "role", "")) or "",
    }


def _sort_payload(sort: Any) -> list[dict[str, str]]:
    result: list[dict[str, str]] = []
    for item in sort or []:
        name = getattr(item, "name", None) or str(item)
        name = name.strip()
        if not name:
            continue
        direction = "desc" if name.startswith("-") else "asc"
        field = name[1:] if name.startswith("-") else name
        result.append({"field": field, "direction": direction})
    return result


def get_users_list(
    *,
    offset: Optional[int],
    limit: Optional[int],
    username: Optional[list[str]],
    search: Optional[str],
    status: Optional[UserStatus],
    sort: Any,
    advanced_filters: Optional[list[str]],
    service_id: Optional[int],
    dbadmin: Any,
    owners: Optional[list[str]],
    users_limit: Optional[int],
    active_total: Optional[int],
    include_links: bool = False,
    request_origin: Optional[str] = None,
) -> UsersResponse:
    payload: dict[str, Any] = {
        "usernames": list(username or []),
        "search": search or "",
        "owners": list(owners or []),
        "status": _enum_value(status) if status else "",
        "advanced_filters": list(advanced_filters or []),
        "sort": _sort_payload(sort),
        "include_links": bool(include_links),
        "request_origin": request_origin or "",
        "admin": _admin_payload(dbadmin),
    }
    if offset is not None:
        payload["offset"] = int(offset)
    if limit is not None:
        payload["limit"] = int(limit)
    if service_id is not None:
        payload["service_id"] = int(service_id)

    try:
        data = call_bridge("users.list", payload) or {}
    except GoUsageUnavailable:
        return _get_users_list_db_only(
            offset=offset,
            limit=limit,
            username=username,
            search=search,
            status=status,
            sort=sort,
            advanced_filters=advanced_filters,
            service_id=service_id,
            dbadmin=dbadmin,
            owners=owners,
            users_limit=users_limit,
            active_total=active_total,
            include_links=include_links,
            request_origin=request_origin,
        )
    if users_limit is not None:
        data["users_limit"] = users_limit
    if active_total is not None:
        data["active_total"] = active_total
    return UsersResponse.model_validate(data)


def get_user_detail(username: str, *, admin: Any, request_origin: Optional[str] = None) -> UserResponse:
    try:
        data = call_bridge(
            "user.get",
            {
                "username": username,
                "request_origin": request_origin or "",
                "admin": _admin_payload(admin),
            },
        )
        return UserResponse.model_validate(data or {})
    except GoUsageUnavailable:
        return _get_user_detail_db_only(username, admin=admin, request_origin=request_origin)


def _get_user_detail_db_only(username: str, *, admin: Any, request_origin: Optional[str] = None) -> UserResponse:
    db = SessionLocal()
    try:
        dbuser = crud.get_user(db, username=username)
        if not dbuser:
            raise GoUsageError("User not found")

        role = getattr(admin, "role", None)
        if not (
            role in (AdminRole.sudo, AdminRole.full_access)
            or (getattr(dbuser, "admin", None) and dbuser.admin.username == getattr(admin, "username", None))
        ):
            raise GoUsageError("You're not allowed")

        token = subscription_request_origin.set(request_origin or None)
        try:
            user = UserResponse.model_validate(dbuser)
        finally:
            subscription_request_origin.reset(token)

        links = build_subscription_links(user, request_origin=request_origin)
        if links:
            user.subscription_urls = {key: value for key, value in links.items() if key != "primary"}
            user.subscription_url = links.get("primary") or next(iter(user.subscription_urls.values()), "")
            if getattr(user, "credential_key", None):
                user.key_subscription_url = user.subscription_urls.get("key")  # type: ignore[attr-defined]
        return user
    finally:
        db.close()


def _get_users_list_db_only(
    *,
    offset: Optional[int],
    limit: Optional[int],
    username: Optional[list[str]],
    search: Optional[str],
    status: Optional[UserStatus],
    sort: Any,
    advanced_filters: Optional[list[str]],
    service_id: Optional[int],
    dbadmin: Any,
    owners: Optional[list[str]],
    users_limit: Optional[int],
    active_total: Optional[int],
    include_links: bool = False,
    request_origin: Optional[str] = None,
) -> UsersResponse:
    del include_links
    db = SessionLocal()
    try:
        from app.services.user_service import _map_raw_to_list_item

        rows, total = crud.get_users_list_rows(
            db,
            offset=offset,
            limit=limit,
            usernames=username,
            search=search,
            status=status,
            sort=sort,
            admin=dbadmin,
            admins=owners,
            advanced_filters=advanced_filters,
            service_id=service_id,
            return_with_count=True,
        )
        admin_ids = {row.get("admin_id") for row in rows if row.get("admin_id") is not None}
        admin_lookup = {}
        if admin_ids:
            admin_lookup = {item.id: item for item in db.query(DBAdmin).filter(DBAdmin.id.in_(admin_ids)).all()}

        users = [
            _map_raw_to_list_item(
                row,
                admin_lookup=admin_lookup,
                request_origin=request_origin,
            )
            for row in rows
        ]
        return UsersResponse(
            users=users,
            total=int(total or 0),
            active_total=active_total,
            users_limit=users_limit,
        )
    finally:
        db.close()
