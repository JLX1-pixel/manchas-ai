from fastapi import FastAPI

from app.routes.appointments import router as appointments_router
from app.routes.auth import router as auth_router
from app.routes.barbers import router as barbers_router
from app.routes.clients import router as clients_router
from app.routes.services import router as services_router


app = FastAPI(
    title="Manchas AI API",
    description=(
        "API del asistente inteligente SaaS para peluquerías, "
        "barberías y salones de belleza."
    ),
    version="0.1.0",
)


app.include_router(
    auth_router,
    prefix="/api/v1",
)

app.include_router(
    clients_router,
    prefix="/api/v1",
)

app.include_router(
    services_router,
    prefix="/api/v1",
)

app.include_router(
    barbers_router,
    prefix="/api/v1",
)

app.include_router(
    appointments_router,
    prefix="/api/v1",
)


@app.get("/", tags=["General"])
def root():
    return {
        "message": "Bienvenido a Manchas AI",
        "status": "online",
        "version": "0.1.0",
    }


@app.get("/health", tags=["General"])
def health_check():
    return {
        "status": "healthy",
        "service": "Manchas AI API",
    }