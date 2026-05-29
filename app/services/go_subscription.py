from __future__ import annotations

import base64
from typing import Any

from app.services.go_usage import GoUsageError, GoUsageUnavailable, call_bridge


def _generate_python_v2ray_subscription(*, user: Any, as_base64: bool, reverse: bool, settings: Any = None) -> str:
    from app.services.subscription_settings import SubscriptionSettingsService
    from app.subscription.share import generate_subscription

    effective_settings = settings
    if effective_settings is None:
        admin = getattr(user, "admin", None)
        effective_settings = SubscriptionSettingsService.get_effective_settings(admin)
    return generate_subscription(
        user=user,
        config_format="v2ray",
        as_base64=as_base64,
        reverse=reverse,
        settings=effective_settings,
    )


def generate_v2ray_subscription(
    *,
    user: Any,
    as_base64: bool,
    reverse: bool = False,
    user_id: Any = None,
    settings: Any = None,
) -> str:
    user_id = user_id if user_id is not None else getattr(user, "id", None)
    if user_id is None:
        raise ValueError("user id is required for Go subscription generation")

    try:
        data = call_bridge(
            "user.config_links",
            {
                "user_id": int(user_id),
                "reverse": bool(reverse),
            },
        ) or {}
    except (GoUsageError, GoUsageUnavailable):
        return _generate_python_v2ray_subscription(
            user=user,
            as_base64=as_base64,
            reverse=reverse,
            settings=settings,
        )

    links = data.get("links") or []
    if not links:
        return _generate_python_v2ray_subscription(
            user=user,
            as_base64=as_base64,
            reverse=reverse,
            settings=settings,
        )

    content = "\n".join(str(link) for link in links)
    if as_base64:
        return base64.b64encode(content.encode()).decode()
    return content
