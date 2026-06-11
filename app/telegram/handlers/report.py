import re
import time
from typing import Any, Callable, Optional

from telebot.apihelper import ApiTelegramException

from app.runtime import logger

CATEGORY_USERS = "users"
CATEGORY_AUTO_RENEW = "auto_renew"
CATEGORY_LOGIN = "login"
CATEGORY_ADMINS = "admins"
CATEGORY_ERRORS = "errors"

_MAX_RATE_LIMIT_DELAY = 60
_last_telegram_error: Optional[dict[str, Any]] = None


def _extract_retry_after(exc: ApiTelegramException) -> Optional[int]:
    retry_after = None
    result_json = getattr(exc, "result_json", None)
    if isinstance(result_json, dict):
        parameters = result_json.get("parameters") or {}
        retry_after = parameters.get("retry_after") or result_json.get("retry_after")
    if retry_after is None:
        match = re.search(r"retry after (\d+)", getattr(exc, "description", ""), re.IGNORECASE)
        if match:
            retry_after = match.group(1)
    try:
        if retry_after is None:
            return None
        wait_seconds = int(retry_after)
        if wait_seconds <= 0:
            return None
        return min(wait_seconds, _MAX_RATE_LIMIT_DELAY)
    except (TypeError, ValueError):
        return None


def _store_telegram_error(exc: Exception, *, category: str, target_desc: str) -> None:
    global _last_telegram_error
    error_msg = str(exc)
    _last_telegram_error = {
        "error": error_msg,
        "error_code": getattr(exc, "error_code", None),
        "description": getattr(exc, "description", error_msg),
        "category": category,
        "target": target_desc,
        "timestamp": time.time(),
    }


def _send_with_retry(send_callable: Callable[[], None], *, category: str, target_desc: str) -> bool:
    """Shared Telegram delivery helper kept for backup delivery only."""
    for attempt in range(2):
        try:
            send_callable()
            return True
        except ApiTelegramException as exc:
            retry_delay = _extract_retry_after(exc)
            if exc.error_code == 429 and retry_delay and attempt == 0:
                logger.warning(
                    "Telegram rate limit triggered while sending '%s' notification to %s; skipping retry after %s seconds",
                    category,
                    target_desc,
                    retry_delay,
                )
                return False
            _store_telegram_error(exc, category=category, target_desc=target_desc)
            logger.error(
                "Failed to send Telegram notification to %s for category '%s': %s",
                target_desc,
                category,
                exc,
            )
            return False
        except Exception as exc:  # pragma: no cover - defensive logging
            _store_telegram_error(exc, category=category, target_desc=target_desc)
            logger.exception(
                "Unexpected error while sending Telegram notification to %s for category '%s'",
                target_desc,
                category,
            )
            return False
    return False


def get_last_telegram_error() -> Optional[dict[str, Any]]:
    return _last_telegram_error


def report(*args, **kwargs) -> None:
    # TODO(go-telegram): restore Telegram event delivery from Go.
    return None


def report_new_user(*args, **kwargs) -> None:
    return None


def report_user_modification(*args, **kwargs) -> None:
    return None


def report_user_deletion(*args, **kwargs) -> None:
    return None


def report_status_change(*args, **kwargs) -> None:
    return None


def report_user_usage_reset(*args, **kwargs) -> None:
    return None


def report_user_data_reset_by_next(*args, **kwargs) -> None:
    return None


def report_user_auto_renew_set(*args, **kwargs) -> None:
    return None


def report_user_auto_renew_applied(*args, **kwargs) -> None:
    return None


def report_user_subscription_revoked(*args, **kwargs) -> None:
    return None


def report_login(*args, **kwargs) -> None:
    return None


def report_admin_created(*args, **kwargs) -> None:
    return None


def report_admin_updated(*args, **kwargs) -> None:
    return None


def report_admin_deleted(*args, **kwargs) -> None:
    return None


def report_admin_usage_reset(*args, **kwargs) -> None:
    return None


def report_admin_limit_reached(*args, **kwargs) -> None:
    return None
