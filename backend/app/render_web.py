"""Interfaz y API bajo el mismo dominio en el despliegue de Render."""

from pathlib import Path

from starlette.applications import Starlette
from starlette.middleware import Middleware
from starlette.middleware.base import BaseHTTPMiddleware
from starlette.responses import FileResponse, JSONResponse
from starlette.routing import Mount, Route
from starlette.staticfiles import StaticFiles

from app.main import app as api


FRONTEND = Path("/app/frontend")

async def close_registration(request, call_next):
    # El primer negocio se crea desde render_start, antes de aceptar conexiones.
    if request.url.path.rstrip("/") == "/api/v1/auth/register":
        return JSONResponse({"detail": "Not Found"}, status_code=404)
    return await call_next(request)


async def frontend(_request):
    return FileResponse(FRONTEND / "index.html", headers={
        "Cache-Control": "no-cache",
        "X-Content-Type-Options": "nosniff",
        "X-Frame-Options": "DENY",
        "Referrer-Policy": "same-origin",
    })


app = Starlette(middleware=[
    Middleware(BaseHTTPMiddleware, dispatch=close_registration),
], routes=[
    Route(path, frontend) for path in (
        "/", "/login", "/citas", "/clientes", "/servicios", "/peluqueros",
    )
] + [
    Mount("/assets", app=StaticFiles(directory=FRONTEND / "assets")),
    Mount("/", app=api),
])
