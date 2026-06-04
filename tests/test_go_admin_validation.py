from unittest.mock import patch

import pytest
from fastapi import HTTPException

from app.models.admin import Admin, AdminRole, AdminStatus
from app.services.go_master_api import GoMasterAPIUnavailable


def _admin_payload(username="pouria", role="full_access", status="active"):
    return {
        "id": 1,
        "username": username,
        "role": role,
        "permissions": {
            "users": {
                "create": True,
                "delete": role == "full_access",
                "reset_usage": role == "full_access",
                "revoke": True,
                "create_on_hold": True,
                "allow_unlimited_data": True,
                "allow_unlimited_expire": True,
                "allow_next_plan": True,
                "advanced_actions": True,
                "set_flow": role in ("sudo", "full_access"),
                "allow_custom_key": role in ("sudo", "full_access"),
                "max_data_limit_per_user": None,
            },
            "admin_management": {
                "can_view": role in ("sudo", "full_access"),
                "can_edit": role in ("sudo", "full_access"),
                "can_manage_sudo": role == "full_access",
            },
            "sections": {
                "usage": role in ("sudo", "full_access"),
                "admins": role in ("sudo", "full_access"),
                "services": role in ("sudo", "full_access"),
                "hosts": True,
                "nodes": role in ("sudo", "full_access"),
                "integrations": role in ("sudo", "full_access"),
                "xray": role in ("sudo", "full_access"),
            },
            "self_permissions": {
                "self_myaccount": True,
                "self_change_password": True,
                "self_api_keys": True,
            },
        },
        "services": [],
        "status": status,
        "disabled_reason": "maintenance" if status == "disabled" else None,
        "telegram_id": None,
        "subscription_domain": None,
        "subscription_settings": {},
        "users_usage": 0,
        "lifetime_usage": 0,
        "created_traffic": 0,
        "deleted_users_usage": 0,
        "data_limit": None,
        "traffic_limit_mode": "used_traffic",
        "use_service_traffic_limits": False,
        "show_user_traffic": True,
        "delete_user_usage_limit_enabled": False,
        "delete_user_usage_limit": None,
        "expire": None,
        "users_limit": None,
        "service_limits": [],
    }


def _validation_payload(**kwargs):
    return {"valid": True, "source": "jwt", "admin": _admin_payload(**kwargs)}


def test_get_current_uses_go_admin_validation_for_jwt():
    with patch("app.services.go_master_api.request_json", return_value=_validation_payload()) as request_json:
        admin = Admin.get_current(db=None, token="jwt-token")

    assert admin.username == "pouria"
    assert admin.role == AdminRole.full_access
    request_json.assert_called_once_with(
        "POST",
        "/internal/admin/validate",
        authorization="Bearer jwt-token",
    )


def test_get_current_accepts_api_key_validation_payload():
    payload = _validation_payload(username="apiadmin", role="sudo")
    payload["source"] = "api_key"
    with patch("app.services.go_master_api.request_json", return_value=payload):
        admin = Admin.get_current(db=None, token="rk_token")

    assert admin.username == "apiadmin"
    assert admin.role == AdminRole.sudo


def test_check_sudo_denies_standard_admin():
    with patch("app.services.go_master_api.request_json", return_value=_validation_payload(role="standard")):
        with pytest.raises(HTTPException) as exc:
            Admin.check_sudo_admin(db=None, token="jwt-token")

    assert exc.value.status_code == 403


def test_check_sudo_allows_sudo_and_full_access():
    with patch("app.services.go_master_api.request_json", return_value=_validation_payload(role="sudo")):
        assert Admin.check_sudo_admin(db=None, token="jwt-token").role == AdminRole.sudo

    with patch("app.services.go_master_api.request_json", return_value=_validation_payload(role="full_access")):
        assert Admin.check_sudo_admin(db=None, token="jwt-token").role == AdminRole.full_access


def test_require_active_denies_disabled_standard_admin():
    with patch(
        "app.services.go_master_api.request_json",
        return_value=_validation_payload(role="standard", status="disabled"),
    ):
        with pytest.raises(HTTPException) as exc:
            Admin.require_active(db=None, token="jwt-token")

    assert exc.value.status_code == 403
    assert exc.value.detail["code"] == "admin_disabled"


def test_require_active_allows_disabled_sudo():
    with patch("app.services.go_master_api.request_json", return_value=_validation_payload(role="sudo", status="disabled")):
        admin = Admin.require_active(db=None, token="jwt-token")

    assert admin.role == AdminRole.sudo
    assert admin.status == AdminStatus.disabled


def test_go_admin_unavailable_returns_503():
    with patch("app.services.go_master_api.request_json", side_effect=GoMasterAPIUnavailable("sidecar down")):
        with pytest.raises(HTTPException) as exc:
            Admin.get_current(db=None, token="jwt-token")

    assert exc.value.status_code == 503
    assert "sidecar down" in exc.value.detail
