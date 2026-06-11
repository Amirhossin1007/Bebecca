import asyncio
import time

from fastapi import APIRouter, Depends, HTTPException, WebSocket, Body, BackgroundTasks, Request
from starlette.websockets import WebSocketDisconnect

from app.services import node_operations
from app.db import Session, get_db, crud, GetDB
from app.models.admin import Admin, AdminRole
from app.models.runtime import RuntimeStats
from app.utils.xray_logs import sort_log_lines
from app.services import go_master_api
from app.utils import responses
from app.utils.xray_targets import (
    MASTER_TARGET_ID,
    parse_target_id,
)

router = APIRouter(tags=["Runtime"], prefix="/api", responses={401: responses._401})

NATIVE_NODE_API_REQUIRED_DETAIL = "Native Go Master API is required for this node operation."
# TODO(go-access-insights): rebuild Access Insights in Go with node gRPC log
# streaming, then remove these disabled compatibility endpoints.
ACCESS_INSIGHTS_DISABLED_DETAIL = (
    "Access Insights is temporarily disabled while it is rebuilt as a Go-native feature."
)


class _RuntimeXrayProxy:
    """Live compatibility target for legacy runtime log-source tests."""

    def __getattr__(self, name):
        from app import runtime as runtime_state

        target = runtime_state.xray
        if target is None:
            raise AttributeError(name)
        return getattr(target, name)


xray = _RuntimeXrayProxy()


def _authorization_from_token(token: str) -> str:
    return token if token.lower().startswith("bearer ") else f"Bearer {token}"


def _go_master_json_from_token(token: str, method: str, path: str, **kwargs):
    try:
        return go_master_api.request_json(method, path, authorization=_authorization_from_token(token), **kwargs)
    except go_master_api.GoMasterAPIUnavailable as exc:
        raise ValueError(NATIVE_NODE_API_REQUIRED_DETAIL) from exc


def _connected_node_id_from_token(token: str) -> int:
    nodes = _go_master_json_from_token(token, "GET", "/api/nodes")
    for node in nodes or []:
        if str(node.get("status", "")).lower() == "connected":
            return int(node["id"])
    raise ValueError("No connected node is available for logs")


def _select_legacy_runtime_log_source(node_id_raw: str | None = None):
    nodes = getattr(xray, "nodes", {}) or {}
    node_id_raw = (node_id_raw or "").strip()
    if node_id_raw:
        try:
            node_id = int(node_id_raw)
        except ValueError as exc:
            raise ValueError("Invalid node_id") from exc
        node = nodes.get(node_id)
        if node is None:
            raise ValueError("Node not found")
        if not getattr(node, "connected", False):
            raise ValueError("Node is not connected")
        return node
    for node in nodes.values():
        if getattr(node, "connected", False):
            return node
    raise ValueError("No connected node is available for logs")


def _select_runtime_log_source(token: str | None = None, node_id_raw: str | None = None):
    if token is None:
        return _select_legacy_runtime_log_source(node_id_raw)
    if node_id_raw is None and str(token).strip().isdigit():
        return _select_legacy_runtime_log_source(str(token))
    node_id_raw = (node_id_raw or "").strip()
    if node_id_raw:
        try:
            return int(node_id_raw)
        except ValueError as exc:
            raise ValueError("Invalid node_id") from exc
    return _connected_node_id_from_token(token)


@router.websocket("/core/logs")
async def runtime_logs(websocket: WebSocket):
    token = websocket.query_params.get("token") or websocket.headers.get("Authorization", "").removeprefix("Bearer ")
    with GetDB() as db:
        admin = Admin.get_admin(token, db)
    if not admin:
        return await websocket.close(reason="Unauthorized", code=4401)

    if admin.role not in (AdminRole.sudo, AdminRole.full_access):
        return await websocket.close(reason="You're not allowed", code=4403)

    interval = websocket.query_params.get("interval")
    if interval:
        try:
            interval = float(interval)
        except ValueError:
            return await websocket.close(reason="Invalid interval value", code=4400)
        if interval > 10:
            return await websocket.close(reason="Interval must be more than 0 and at most 10 seconds", code=4400)

    try:
        logs_source = _select_runtime_log_source(token, websocket.query_params.get("node_id"))
    except Exception as exc:
        reason = getattr(exc, "detail", None) or str(exc)
        return await websocket.close(reason=reason, code=4404)

    await websocket.accept()

    cache: list[str] = []
    last_sent_ts = 0

    async def _flush_cache() -> bool:
        nonlocal cache, last_sent_ts
        if not cache:
            return True
        try:
            for line in sort_log_lines(cache):
                await websocket.send_text(line)
        except (WebSocketDisconnect, RuntimeError):
            return False
        cache = []
        last_sent_ts = time.time()
        return True

    sent: set[str] = set()
    while True:
        if interval and time.time() - last_sent_ts >= interval and cache:
            if not await _flush_cache():
                break
        try:
            payload = _go_master_json_from_token(
                token,
                "GET",
                f"/api/node/{logs_source}/logs",
                params={"max_lines": 200},
            )
            lines = payload.get("logs", []) if isinstance(payload, dict) else []
        except Exception as exc:
            lines = [str(exc)]
        fresh = [line for line in sort_log_lines(lines) if line not in sent]
        sent.update(fresh)
        if interval:
            cache.extend(fresh)
        else:
            for line in fresh:
                try:
                    await websocket.send_text(line)
                except (WebSocketDisconnect, RuntimeError):
                    return
        try:
            await asyncio.wait_for(websocket.receive(), timeout=1.0)
        except asyncio.TimeoutError:
            continue
        except (WebSocketDisconnect, RuntimeError):
            break


@router.get("/core/access/insights", responses={403: responses._403})
def get_access_insights(
    request: Request,
    admin: Admin = Depends(Admin.get_current),
):
    _ = request, admin
    raise HTTPException(status_code=410, detail=ACCESS_INSIGHTS_DISABLED_DETAIL)


@router.get("/core/access/insights/multi-node", responses={403: responses._403})
def get_multi_node_access_insights(
    request: Request,
    admin: Admin = Depends(Admin.get_current),
):
    _ = request, admin
    raise HTTPException(status_code=410, detail=ACCESS_INSIGHTS_DISABLED_DETAIL)


@router.get("/core/access/logs/raw", responses={403: responses._403})
def get_raw_access_logs(
    request: Request,
    admin: Admin = Depends(Admin.get_current),
):
    _ = request, admin
    raise HTTPException(status_code=410, detail=ACCESS_INSIGHTS_DISABLED_DETAIL)


@router.post("/core/access/operators", responses={403: responses._403})
def resolve_access_log_operators(
    ips: list[str] = Body(default_factory=list, embed=True),
    admin: Admin = Depends(Admin.get_current),
):
    _ = ips, admin
    raise HTTPException(status_code=410, detail=ACCESS_INSIGHTS_DISABLED_DETAIL)


@router.websocket("/core/access/logs/ws")
async def access_logs_ws(websocket: WebSocket):
    await websocket.close(reason=ACCESS_INSIGHTS_DISABLED_DETAIL, code=4404)


@router.get("/core", response_model=RuntimeStats)
def get_runtime_stats(
    admin: Admin = Depends(Admin.get_current),
    db: Session = Depends(get_db),
):
    """Retrieve aggregate node runtime status."""
    started = False
    version = None
    try:
        for node in crud.get_nodes(db):
            status_raw = getattr(node, "status", "")
            status_value = str(getattr(status_raw, "value", status_raw)).lower()
            if status_value == "connected":
                started = True
                version = (
                    getattr(node, "xray_version", None)
                    or getattr(node, "node_service_version", None)
                    or version
                )
                break
    except Exception:
        pass
    return RuntimeStats(
        version=version,
        started=started,
        logs_websocket=router.url_path_for("runtime_logs"),
    )


@router.get("/core/ips")
def get_server_ips(admin: Admin = Depends(Admin.get_current)):
    """Retrieve server's public IPv4 and IPv6 addresses."""
    raise HTTPException(
        status_code=503,
        detail="Server IP routes are handled by the native Go Master API",
    )


@router.post("/core/restart", responses={403: responses._403})
def queue_runtime_restart(
    bg: BackgroundTasks,
    target: str | None = None,
    db: Session = Depends(get_db),
    admin: Admin = Depends(Admin.check_sudo_admin),
):
    """Restart the selected runtime target."""
    if target:
        kind, node_id = parse_target_id(target)
        if kind != MASTER_TARGET_ID and not crud.get_node_by_id(db, node_id):
            raise HTTPException(status_code=404, detail="Node not found")

    def _restart():
        # TODO(go-runtime-cleanup): route this endpoint directly through the Go
        # Master API. For now Python only enqueues config sync work; it no
        # longer restarts or talks to a local Xray runtime.
        if not target:
            node_operations.queue_sync_config()
            return
        kind, node_id = parse_target_id(target)
        if kind == MASTER_TARGET_ID:
            node_operations.queue_sync_config()
        elif node_id is not None:
            node_operations.queue_sync_config(node_id=node_id)

    bg.add_task(_restart)

    return {"detail": "Runtime restart queued"}


@router.get("/core/config", responses={403: responses._403})
def get_runtime_config(
    target: str = MASTER_TARGET_ID,
    admin: Admin = Depends(Admin.check_sudo_admin),
    db: Session = Depends(get_db),
) -> dict:
    """Get the current runtime configuration."""
    raise HTTPException(
        status_code=503,
        detail="Xray config routes are handled by the native Go Master API",
    )


@router.put("/core/config", responses={403: responses._403})
def modify_runtime_config(
    payload: dict,
    target: str = MASTER_TARGET_ID,
    admin: Admin = Depends(Admin.check_sudo_admin),
) -> dict:
    """Modify the runtime configuration and restart the target runtime."""
    raise HTTPException(
        status_code=503,
        detail="Xray config routes are handled by the native Go Master API",
    )


@router.get("/core/config/targets", responses={403: responses._403})
def get_runtime_config_targets(
    admin: Admin = Depends(Admin.check_sudo_admin),
    db: Session = Depends(get_db),
):
    raise HTTPException(
        status_code=503,
        detail="Xray config target routes are handled by the native Go Master API",
    )


@router.put("/core/config/targets/{node_id}/mode", responses={403: responses._403})
def modify_node_config_mode(
    node_id: int,
    bg: BackgroundTasks,
    payload: dict = Body(...),
    admin: Admin = Depends(Admin.check_sudo_admin),
    db: Session = Depends(get_db),
):
    raise HTTPException(
        status_code=503,
        detail="Xray config target routes are handled by the native Go Master API",
    )


@router.get("/core/xray/releases", responses={403: responses._403})
def list_xray_releases(limit: int = 10, admin: Admin = Depends(Admin.check_sudo_admin)):
    """List latest Xray-core tags for node update workflows."""
    _ = limit, admin
    raise HTTPException(
        status_code=503,
        detail="Xray release routes are handled by the native Go Master API",
    )


@router.post("/core/xray/update", responses={403: responses._403})
def update_node_runtime_version(
    payload: dict = Body(..., examples={"default": {"version": "v1.8.11", "persist_env": True}}),
    admin: Admin = Depends(Admin.check_sudo_admin),
):
    """Deprecated: master no longer owns a local runtime."""
    raise HTTPException(status_code=410, detail="Master runtime is node-only; update nodes instead.")


@router.get("/core/geo/templates", responses={403: responses._403})
def list_geo_templates(index_url: str = "", admin: Admin = Depends(Admin.check_sudo_admin)):
    """Fetch and list geo templates."""
    _ = index_url, admin
    raise HTTPException(
        status_code=503,
        detail="Geo template routes are handled by the native Go Master API",
    )


@router.post("/core/geo/apply", responses={403: responses._403})
def apply_geo_assets(
    request: Request,
    payload: dict = Body(
        ...,
        examples={
            "default": {
                "mode": "default",
                "files": [
                    {"name": "geosite.dat", "url": "https://.../geosite.dat"},
                    {"name": "geoip.dat", "url": "https://.../geoip.dat"},
                ],
                "persist_env": True,
                "apply_to_nodes": True,
                "skip_node_ids": [],
            }
        },
    ),
    admin: Admin = Depends(Admin.check_sudo_admin),
    db: Session = Depends(get_db),
):
    """Download and apply geo assets."""
    _ = request, payload, admin, db
    raise HTTPException(
        status_code=503,
        detail="Geo update routes are handled by the native Go Master API",
    )


@router.post("/core/geo/update", responses={403: responses._403})
def update_geo_assets(
    request: Request,
    payload: dict = Body(
        ...,
        examples={
            "default": {
                "mode": "template",
                "templateIndexUrl": "",
                "templateName": "standard",
                "files": [],
                "persistEnv": True,
                "applyToNodes": True,
                "skipNodeIds": [],
            }
        },
    ),
    admin: Admin = Depends(Admin.check_sudo_admin),
    db: Session = Depends(get_db),
):
    """
    Backward-compatible alias used by the dashboard to update geo files on the master (and optionally nodes).
    Accepts camelCase keys from the frontend and forwards to the main handler.
    """
    _ = request, payload, admin, db
    raise HTTPException(
        status_code=503,
        detail="Geo update routes are handled by the native Go Master API",
    )


@router.get("/core/warp", responses={403: responses._403})
def get_warp_account(admin: Admin = Depends(Admin.check_sudo_admin), db: Session = Depends(get_db)):
    """Return the stored Cloudflare WARP account (if any)."""
    raise HTTPException(status_code=503, detail="WARP routes are served by the Go Master API")


@router.post(
    "/core/warp/register",
    responses={403: responses._403},
)
def register_warp_account(
    payload: dict = Body(...),
    admin: Admin = Depends(Admin.check_sudo_admin),
    db: Session = Depends(get_db),
):
    """Register a new WARP device via Cloudflare and persist credentials."""
    raise HTTPException(status_code=503, detail="WARP routes are served by the Go Master API")


@router.post(
    "/core/warp/license",
    responses={403: responses._403},
)
def update_warp_license(
    payload: dict = Body(...),
    admin: Admin = Depends(Admin.check_sudo_admin),
    db: Session = Depends(get_db),
):
    """Update the stored license key on Cloudflare WARP."""
    raise HTTPException(status_code=503, detail="WARP routes are served by the Go Master API")


@router.get(
    "/core/warp/config",
    responses={403: responses._403},
)
def get_warp_config(admin: Admin = Depends(Admin.check_sudo_admin), db: Session = Depends(get_db)):
    """Fetch the latest device+account info from Cloudflare."""
    raise HTTPException(status_code=503, detail="WARP routes are served by the Go Master API")


@router.delete("/core/warp", responses={403: responses._403})
def delete_warp_account(admin: Admin = Depends(Admin.check_sudo_admin), db: Session = Depends(get_db)):
    """Remove the locally stored WARP credentials."""
    raise HTTPException(status_code=503, detail="WARP routes are served by the Go Master API")


@router.post("/panel/xray/testOutbound", responses={403: responses._403})
def test_outbound(
    payload: dict = Body(...),
    admin: Admin = Depends(Admin.check_sudo_admin),
):
    _ = payload, admin
    raise HTTPException(
        status_code=503,
        detail="Outbound test routes are handled by the native Go Master API",
    )


@router.get("/panel/xray/getOutboundsTraffic", responses={403: responses._403})
def get_outbounds_traffic(admin: Admin = Depends(Admin.check_sudo_admin), db: Session = Depends(get_db)):
    """Get outbound traffic statistics from database."""
    _ = admin, db
    raise HTTPException(status_code=503, detail="Outbound traffic routes are served by the Go Master API")


@router.post("/panel/xray/resetOutboundsTraffic", responses={403: responses._403})
def reset_outbounds_traffic(
    payload: dict = Body(...),
    admin: Admin = Depends(Admin.check_sudo_admin),
    db: Session = Depends(get_db),
):
    """Reset outbound traffic statistics."""
    _ = payload, admin, db
    raise HTTPException(status_code=503, detail="Outbound traffic routes are served by the Go Master API")
