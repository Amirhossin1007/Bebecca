from __future__ import annotations

from typing import Any

import requests
from fastapi import HTTPException

from config import GO_MASTER_API_TIMEOUT_SECONDS, GO_MASTER_API_URL, GO_MASTER_API_VERIFY_TLS


class GoMasterAPIUnavailable(RuntimeError):
    pass


def is_enabled() -> bool:
    return bool(GO_MASTER_API_URL)


def request_json(
    method: str,
    path: str,
    *,
    authorization: str | None = None,
    params: dict[str, Any] | None = None,
    json_body: Any | None = None,
    timeout: float | None = None,
) -> Any:
    if not GO_MASTER_API_URL:
        raise GoMasterAPIUnavailable("GO_MASTER_API_URL is not configured")

    url = GO_MASTER_API_URL.rstrip("/") + "/" + path.lstrip("/")
    headers: dict[str, str] = {}
    if authorization:
        headers["Authorization"] = authorization

    try:
        response = requests.request(
            method.upper(),
            url,
            headers=headers,
            params=params or None,
            json=json_body,
            timeout=timeout or GO_MASTER_API_TIMEOUT_SECONDS,
            verify=GO_MASTER_API_VERIFY_TLS,
        )
    except requests.RequestException as exc:
        raise GoMasterAPIUnavailable(f"Go Master API is unavailable: {exc}") from exc

    if response.status_code >= 400:
        detail: Any
        try:
            payload = response.json()
            detail = payload.get("detail", payload)
        except ValueError:
            detail = response.text or response.reason
        raise HTTPException(status_code=response.status_code, detail=detail)

    if not response.content:
        return {}
    try:
        return response.json()
    except ValueError as exc:
        raise GoMasterAPIUnavailable("Go Master API returned invalid JSON") from exc
