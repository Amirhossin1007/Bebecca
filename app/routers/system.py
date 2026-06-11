from fastapi import APIRouter, Body, HTTPException

from app.utils import responses

router = APIRouter(tags=["System"], prefix="/api", responses={401: responses._401})

_GO_NATIVE_DETAIL = "System and maintenance routes are served by the Go Master API."


def _go_native_only():
    raise HTTPException(status_code=503, detail=_GO_NATIVE_DETAIL)


@router.get("/system")
def get_system_stats():
    _go_native_only()


@router.get("/maintenance/info", responses={403: responses._403})
def get_maintenance_info():
    _go_native_only()


@router.post("/maintenance/update", responses={403: responses._403})
def update_panel_from_maintenance(payload: dict | None = Body(default=None)):
    del payload
    _go_native_only()


@router.post("/maintenance/restart", responses={403: responses._403})
def restart_panel_from_maintenance():
    _go_native_only()


@router.post("/maintenance/soft-reload", responses={403: responses._403})
def soft_reload_panel_from_maintenance():
    _go_native_only()
