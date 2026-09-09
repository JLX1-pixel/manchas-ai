from app.routes.appointments import router as appointments_router
from app.routes.auth import router as auth_router
from app.routes.barbers import router as barbers_router
from app.routes.clients import router as clients_router
from app.routes.services import router as services_router

__all__ = [
    "appointments_router",
    "auth_router",
    "barbers_router",
    "clients_router",
    "services_router",
]