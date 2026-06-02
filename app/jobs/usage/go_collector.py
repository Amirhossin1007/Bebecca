from __future__ import annotations

import threading

from app.runtime import logger


_record_user_usages_lock = threading.Lock()
_record_node_usages_lock = threading.Lock()


def _collect_usage(*, users: bool, outbound: bool) -> dict:
    logger.debug(
        "Usage collection is handled by the Go Master API sidecar; skipping Python bridge trigger "
        "(users=%s outbound=%s)",
        users,
        outbound,
    )
    return {"delegated": True, "users": bool(users), "outbound": bool(outbound)}


def record_user_usages():
    if not _record_user_usages_lock.acquire(blocking=False):
        logger.warning("record_user_usages is already running; skipping overlapping run")
        return None
    try:
        return _collect_usage(users=True, outbound=False)
    finally:
        _record_user_usages_lock.release()


def record_node_usages():
    if not _record_node_usages_lock.acquire(blocking=False):
        logger.warning("record_node_usages is already running; skipping overlapping run")
        return None
    try:
        return _collect_usage(users=False, outbound=True)
    finally:
        _record_node_usages_lock.release()
