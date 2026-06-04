"""Legacy Admin/Auth routes.

Admin/Auth endpoints are Go-native and routed by the Rebecca gateway. This
module intentionally keeps only an empty router so older imports do not fail.
"""

from fastapi import APIRouter

from app.utils import responses

router = APIRouter(tags=["Admin"], prefix="/api", responses={401: responses._401})
