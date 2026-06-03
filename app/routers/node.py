from typing import List, Union

from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException, WebSocket
from sqlalchemy.exc import IntegrityError

from app.runtime import logger
from app.db import Session, crud, get_db, GetDB
from app.dependencies import get_dbnode
from app.models.admin import Admin, AdminRole
from app.models.node import (
    MasterNodeResponse,
    MasterNodeUpdate,
    NodeCreate,
    NodeModify,
    NodeResponse,
    NodeSettings,
    NodeStatus,
    NodesUsageResponse,
)
from app.models.proxy import ProxyHost
from app.utils import responses, report
from app.db.models import MasterNodeState as DBMasterNodeState, Node as DBNode
from app.services import node_operations
from app.utils.crypto import (
    generate_certificate,
    generate_unique_cn,
    extract_public_key_from_certificate,
)
from uuid import uuid4

router = APIRouter(tags=["Node"], prefix="/api", responses={401: responses._401, 403: responses._403})

_PENDING_CERTS: dict[str, dict[str, str]] = {}


def add_host_if_needed(new_node: NodeCreate, db: Session):
    """Add a host if specified in the new node settings."""
    if new_node.add_as_new_host:
        from app.utils.xray_targets import collect_all_inbound_tags

        host = ProxyHost(
            remark=f"{new_node.name} ({{USERNAME}}) [{{PROTOCOL}} - {{TRANSPORT}}]",
            address=new_node.address,
        )
        inbound_tags = collect_all_inbound_tags(db)
        for inbound_tag in inbound_tags:
            crud.add_host(db, inbound_tag, host)


MASTER_NODE_NAME = "Master"
OPERATIONAL_NODE_ROUTE_DISABLED_DETAIL = (
    "This operational node route is served directly by the Go gateway and Go Master API."
)


def _serialize_node_response(dbnode: Union[DBNode, NodeResponse]) -> NodeResponse:
    """Convert DB node rows to API responses without Python runtime probing."""
    return dbnode if isinstance(dbnode, NodeResponse) else NodeResponse.model_validate(dbnode)


def _operational_node_route_disabled() -> None:
    raise HTTPException(
        status_code=503,
        detail=OPERATIONAL_NODE_ROUTE_DISABLED_DETAIL,
    )


def _augment_node_cert_fields(
    node_response: NodeResponse, dbnode: Union[DBNode, NodeResponse], default_cert: str | None
) -> NodeResponse:
    cert_value = getattr(dbnode, "certificate", None)
    normalized_default = default_cert.strip() if isinstance(default_cert, str) else None
    normalized_cert = cert_value.strip() if isinstance(cert_value, str) else None

    has_custom_cert = False
    uses_default_cert = True
    public_key = None

    if normalized_cert:
        if normalized_default and normalized_cert == normalized_default:
            uses_default_cert = True
        else:
            has_custom_cert = True
            uses_default_cert = False
            try:
                public_key = extract_public_key_from_certificate(cert_value)
            except Exception as exc:
                logger.warning("Failed to extract public key for node %s: %s", node_response.id, exc)

    updated = node_response.model_copy(
        update={
            "has_custom_certificate": has_custom_cert,
            "uses_default_certificate": uses_default_cert,
            "certificate_public_key": public_key,
            "node_certificate": cert_value if has_custom_cert else None,
        }
    )
    return updated


def _build_master_response(master: DBMasterNodeState) -> MasterNodeResponse:
    total_usage = (master.uplink or 0) + (master.downlink or 0)
    data_limit = master.data_limit
    remaining = max((data_limit or 0) - total_usage, 0) if data_limit is not None else None

    return MasterNodeResponse(
        id=master.id,
        name=MASTER_NODE_NAME,
        status=master.status,
        message=master.message,
        data_limit=data_limit,
        uplink=master.uplink or 0,
        downlink=master.downlink or 0,
        total_usage=total_usage,
        remaining_data=remaining,
        limit_exceeded=bool(data_limit is not None and total_usage >= data_limit),
        updated_at=master.updated_at,
    )


@router.get("/node/master", response_model=MasterNodeResponse, responses={403: responses._403})
def get_master_node_state(
    db: Session = Depends(get_db),
    _: Admin = Depends(Admin.check_sudo_admin),
):
    """Retrieve the current usage and limits for the master node."""
    master_state = crud.get_master_node_state(db)
    return _build_master_response(master_state)


@router.put("/node/master", response_model=MasterNodeResponse, responses={403: responses._403})
def update_master_node_state(
    payload: MasterNodeUpdate,
    db: Session = Depends(get_db),
    _: Admin = Depends(Admin.check_sudo_admin),
):
    """Update master node settings such as data limit."""
    master_state = crud.set_master_data_limit(db, payload.data_limit)
    return _build_master_response(master_state)


@router.post("/node/master/usage/reset", response_model=MasterNodeResponse, responses={403: responses._403})
def reset_master_node_usage(
    db: Session = Depends(get_db),
    _: Admin = Depends(Admin.check_sudo_admin),
):
    """Reset usage counters for the master node."""
    master_state = crud.reset_master_usage(db)
    logger.info("Master usage reset")
    return _build_master_response(master_state)


@router.get("/node/settings", response_model=NodeSettings)
def get_node_settings(db: Session = Depends(get_db), admin: Admin = Depends(Admin.check_sudo_admin)):
    """Retrieve the current node settings, including the shared TLS certificate (legacy)."""
    tls = crud.get_tls_certificate(db)
    return NodeSettings(
        certificate=tls.certificate,
        node_certificate=None,
        node_certificate_key=None,
    )


@router.post("/node/certificate/new")
def issue_node_certificate(
    admin: Admin = Depends(Admin.check_sudo_admin),
) -> dict:
    """
    Generate a brand new certificate/key pair for a node creation flow.
    """
    unique_cn = generate_unique_cn()
    cert_pair = generate_certificate(cn=unique_cn)
    token = uuid4().hex
    _PENDING_CERTS[token] = {
        "certificate": cert_pair.get("cert"),
        "certificate_key": cert_pair.get("key"),
    }
    return {
        "certificate": cert_pair.get("cert"),
        "certificate_token": token,
    }


@router.post("/node", response_model=NodeResponse, responses={409: responses._409})
def add_node(
    new_node: NodeCreate,
    bg: BackgroundTasks,
    db: Session = Depends(get_db),
    admin: Admin = Depends(Admin.check_sudo_admin),
):
    """Add a new node to the database and optionally add it as a host."""
    try:
        dbnode = crud.create_node(db, new_node)
    except IntegrityError:
        db.rollback()
        raise HTTPException(status_code=409, detail=f'Node "{new_node.name}" already exists')

    bg.add_task(node_operations.queue_sync_config, node_id=dbnode.id)
    bg.add_task(add_host_if_needed, new_node, db)
    bg.add_task(
        report.node_created,
        NodeResponse.model_validate(dbnode),
        getattr(admin, "username", str(admin)),
    )

    logger.info(f'New node "{dbnode.name}" added')
    default_cert = crud.get_tls_certificate(db).certificate
    resp = _augment_node_cert_fields(_serialize_node_response(dbnode), dbnode, default_cert)
    return resp.model_copy(
        update={
            "node_certificate": dbnode.certificate,
        }
    )


@router.get("/node/{node_id}", response_model=NodeResponse)
def get_node(
    node_id: int,
    _: Admin = Depends(Admin.check_sudo_admin),
):
    """Operational node detail is served directly by the Go gateway."""
    _operational_node_route_disabled()


@router.get("/node/{node_id}/logs")
def get_node_logs(
    node_id: int,
    max_lines: int = 200,
    _: Admin = Depends(Admin.check_sudo_admin),
):
    """Operational node logs are served directly by the Go gateway."""
    _operational_node_route_disabled()


@router.post("/node/{node_id}/certificate/regenerate", response_model=NodeResponse)
def regenerate_node_certificate(
    node_id: int,
    db: Session = Depends(get_db),
    admin: Admin = Depends(Admin.check_sudo_admin),
):
    """Regenerate a unique certificate for an existing node and return it."""
    dbnode = crud.get_node_by_id(db, node_id)
    if not dbnode:
        raise HTTPException(status_code=404, detail="Node not found")

    updated = crud.regenerate_node_certificate(db, dbnode)

    default_cert = crud.get_tls_certificate(db).certificate
    resp = _augment_node_cert_fields(_serialize_node_response(updated), updated, default_cert)
    return resp.model_copy(
        update={
            "node_certificate": updated.certificate,
        }
    )


@router.websocket("/node/{node_id}/logs")
async def node_logs(node_id: int, websocket: WebSocket):
    token = websocket.query_params.get("token") or websocket.headers.get("Authorization", "").removeprefix("Bearer ")
    with GetDB() as db:
        admin = Admin.get_admin(token, db)
    if not admin:
        return await websocket.close(reason="Unauthorized", code=4401)

    if admin.role not in (AdminRole.sudo, AdminRole.full_access):
        return await websocket.close(reason="You're not allowed", code=4403)

    return await websocket.close(reason=OPERATIONAL_NODE_ROUTE_DISABLED_DETAIL, code=4400)


@router.get("/nodes", response_model=List[NodeResponse])
def get_nodes(
    _: Admin = Depends(Admin.check_sudo_admin),
):
    """Operational node listing is served directly by the Go gateway."""
    _operational_node_route_disabled()


@router.put("/node/{node_id}", response_model=NodeResponse)
def modify_node(
    modified_node: NodeModify,
    bg: BackgroundTasks,
    dbnode: DBNode = Depends(get_dbnode),
    db: Session = Depends(get_db),
    admin: Admin = Depends(Admin.check_sudo_admin),
):
    """Update a node's details. Only accessible to sudo admins."""
    previous_status = dbnode.status
    updated_node = crud.update_node(db, dbnode, modified_node)
    updated_node_resp = NodeResponse.model_validate(updated_node)

    if modified_node.status is not None and updated_node_resp.status != previous_status:
        bg.add_task(report.node_status_change, updated_node_resp, previous_status=previous_status)

    if updated_node.status not in {NodeStatus.disabled, NodeStatus.limited}:
        bg.add_task(node_operations.queue_sync_config, node_id=updated_node.id)

    logger.info(f'Node "{dbnode.name}" modified')
    default_cert = crud.get_tls_certificate(db).certificate
    return _augment_node_cert_fields(_serialize_node_response(updated_node_resp), updated_node_resp, default_cert)


@router.post("/node/{node_id}/usage/reset", response_model=NodeResponse)
def reset_node_usage(
    bg: BackgroundTasks,
    dbnode: DBNode = Depends(get_dbnode),
    db: Session = Depends(get_db),
    admin: Admin = Depends(Admin.check_sudo_admin),
):
    """Reset the tracked data usage of a node."""
    updated_node = crud.reset_node_usage(db, dbnode)
    bg.add_task(node_operations.queue_sync_config, node_id=updated_node.id)
    report.node_usage_reset(updated_node, admin)
    logger.info(f'Node "{dbnode.name}" usage reset')
    default_cert = crud.get_tls_certificate(db).certificate
    return _augment_node_cert_fields(_serialize_node_response(updated_node), updated_node, default_cert)


@router.post("/node/{node_id}/reconnect")
def reconnect_node(
    node_id: int,
    _: Admin = Depends(Admin.check_sudo_admin),
):
    """Operational node reconnect is served directly by the Go gateway."""
    _operational_node_route_disabled()


@router.post("/node/{node_id}/restart")
def restart_node_runtime(
    node_id: int,
    _: Admin = Depends(Admin.check_sudo_admin),
):
    """Operational node runtime restart is served directly by the Go gateway."""
    _operational_node_route_disabled()


@router.delete("/node/{node_id}")
def remove_node(
    bg: BackgroundTasks,
    dbnode: DBNode = Depends(get_dbnode),
    db: Session = Depends(get_db),
    admin: Admin = Depends(Admin.check_sudo_admin),
):
    """Delete a node and schedule xray cleanup in the background."""
    crud.remove_node(db, dbnode)

    report.node_deleted(dbnode, admin)

    logger.info(f'Node "{dbnode.name}" deleted')
    return {}


@router.get("/nodes/usage", response_model=NodesUsageResponse)
def get_usage(
    start: str = "",
    end: str = "",
    admin: Admin = Depends(Admin.check_sudo_admin),
):
    """Operational node usage is served directly by the Go gateway."""
    _operational_node_route_disabled()


@router.get("/node/{node_id}/usage/daily", responses={403: responses._403, 404: responses._404})
def get_node_usage_daily(
    node_id: int,
    start: str = "",
    end: str = "",
    granularity: str = "day",
    _: Admin = Depends(Admin.check_sudo_admin),
):
    """Operational node daily usage is served directly by the Go gateway."""
    _operational_node_route_disabled()


@router.post("/node/{node_id}/xray/update", responses={403: responses._403, 404: responses._404})
def update_node_runtime(
    node_id: int,
    _: Admin = Depends(Admin.check_sudo_admin),
):
    """Operational node runtime update is served directly by the Go gateway."""
    _operational_node_route_disabled()


@router.post("/node/{node_id}/geo/update", responses={403: responses._403, 404: responses._404})
def update_node_geo(
    node_id: int,
    _: Admin = Depends(Admin.check_sudo_admin),
):
    """Operational node geo update is served directly by the Go gateway."""
    _operational_node_route_disabled()


@router.post("/node/{node_id}/service/restart", responses={403: responses._403, 404: responses._404})
def restart_node_service(
    node_id: int,
    _: Admin = Depends(Admin.check_sudo_admin),
):
    """Operational node service restart is served directly by the Go gateway."""
    _operational_node_route_disabled()


@router.post("/node/{node_id}/service/update", responses={403: responses._403, 404: responses._404})
def update_node_service(
    node_id: int,
    _: Admin = Depends(Admin.check_sudo_admin),
):
    """Operational node service update is served directly by the Go gateway."""
    _operational_node_route_disabled()
