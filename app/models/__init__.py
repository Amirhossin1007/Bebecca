import sys

_IS_RUNNING_ALEMBIC = any("alembic" in (arg or "").lower() for arg in sys.argv)

if not _IS_RUNNING_ALEMBIC:
    from .admin import *
    from .proxy import *
    from .system import *
    from .user import *
