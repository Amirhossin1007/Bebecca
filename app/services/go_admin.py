from __future__ import annotations

from typing import Any

from fastapi import HTTPException, status

from app.services import go_master_api


def validate_credentials(username: str, password: str) -> dict[str, Any] | None:
    if not username or not password:
        return None
    try:
        token_payload = go_master_api.request_json(
            "POST",
            "/api/admin/token",
            json_body={"username": username, "password": password},
        )
    except HTTPException as exc:
        if exc.status_code in (status.HTTP_401_UNAUTHORIZED, status.HTTP_403_FORBIDDEN):
            return None
        raise
    except go_master_api.GoMasterAPIUnavailable as exc:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail=str(exc),
        ) from exc

    token = token_payload.get("access_token") if isinstance(token_payload, dict) else None
    if not isinstance(token, str) or not token:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Go Master API returned invalid admin token payload",
        )
    return validate_token(token)


def validate_token(token: str) -> dict[str, Any]:
    if not token:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Could not validate credentials",
            headers={"WWW-Authenticate": "Bearer"},
        )
    try:
        payload = go_master_api.request_json(
            "POST",
            "/internal/admin/validate",
            authorization=f"Bearer {token}",
        )
    except HTTPException as exc:
        if exc.status_code == status.HTTP_401_UNAUTHORIZED:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Could not validate credentials",
                headers={"WWW-Authenticate": "Bearer"},
            ) from exc
        raise
    except go_master_api.GoMasterAPIUnavailable as exc:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail=str(exc),
        ) from exc

    if not isinstance(payload, dict) or not payload.get("valid"):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Could not validate credentials",
            headers={"WWW-Authenticate": "Bearer"},
        )
    admin = payload.get("admin")
    if not isinstance(admin, dict):
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Go Master API returned invalid admin validation payload",
        )
    return admin
