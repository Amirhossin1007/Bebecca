"""Legacy MyAccount routes.

MyAccount endpoints are Go-native and routed by the Rebecca gateway. This
module intentionally keeps only an empty router so older imports do not fail.
"""

from fastapi import APIRouter

router = APIRouter(prefix="/api", tags=["MyAccount"])
