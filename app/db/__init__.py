from sqlalchemy.exc import SQLAlchemyError
from sqlalchemy.orm import Session
from importlib import import_module

from .base import Base, SessionLocal, engine  # noqa


class GetDB:  # Context Manager
    def __init__(self):
        self.db = SessionLocal()

    def __enter__(self):
        return self.db

    def __exit__(self, exc_type, exc_value, traceback):
        if isinstance(exc_value, SQLAlchemyError):
            self.db.rollback()  # rollback on exception

        self.db.close()


def get_db():  # Dependency
    with GetDB() as db:
        yield db


_CRUD_EXPORTS = {
    "create_admin",
    "create_user",
    "get_admin",
    "get_admins",
    "get_jwt_secret_key",
    "get_admin_secret_key",
    "get_subscription_secret_key",
    "get_uuid_masks",
    "get_or_create_inbound",
    "get_system_usage",
    "get_tls_certificate",
    "get_user",
    "get_user_by_id",
    "get_users",
    "get_users_count",
    "remove_admin",
    "remove_user",
    "revoke_user_sub",
    "set_owner",
    "update_admin",
    "update_user",
    "update_user_status",
    "reset_user_by_next",
    "update_user_sub",
    "start_user_expire",
    "get_admin_by_id",
    "get_admin_by_telegram_id",
    "get_user_queryset",
}

_MODEL_EXPORTS = {"JWT", "System", "User"}


def __getattr__(name):
    if name == "crud":
        return import_module("app.db.crud")
    if name == "models":
        return import_module("app.db.models")
    if name in _CRUD_EXPORTS:
        return getattr(import_module("app.db.crud"), name)
    if name in _MODEL_EXPORTS:
        return getattr(import_module("app.db.models"), name)
    raise AttributeError(f"module {__name__!r} has no attribute {name!r}")

__all__ = [
    "get_or_create_inbound",
    "get_user",
    "get_user_by_id",
    "get_users",
    "get_users_count",
    "create_user",
    "remove_user",
    "update_user",
    "update_user_status",
    "start_user_expire",
    "update_user_sub",
    "reset_user_by_next",
    "revoke_user_sub",
    "set_owner",
    "get_system_usage",
    "get_jwt_secret_key",
    "get_admin_secret_key",
    "get_subscription_secret_key",
    "get_uuid_masks",
    "get_tls_certificate",
    "get_admin",
    "create_admin",
    "update_admin",
    "remove_admin",
    "get_admins",
    "get_admin_by_id",
    "get_admin_by_telegram_id",
    "get_user_queryset",
    "GetDB",
    "get_db",
    "User",
    "System",
    "JWT",
    "Base",
    "Session",
]
