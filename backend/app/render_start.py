"""Arranque del piloto en Render con migración y alta inicial idempotentes."""

import os
import sys

from fastapi import HTTPException
from pydantic import ValidationError
from sqlalchemy.exc import SQLAlchemyError


REQUIRED_VARIABLES = (
    "DATABASE_URL", "JWT_SECRET_KEY", "MANCHAS_BUSINESS_NAME",
    "MANCHAS_BUSINESS_SLUG", "MANCHAS_OWNER_EMAIL", "MANCHAS_OWNER_PASSWORD",
)


def prepare() -> None:
    missing = [name for name in REQUIRED_VARIABLES if not os.environ.get(name, "").strip()]
    if missing:
        raise RuntimeError("MISSING_ENV:" + ", ".join(missing))

    print("Piloto: validando configuración inicial.", flush=True)
    # Render entrega postgres:// o postgresql://. El proyecto usa psycopg 3.
    url = os.environ["DATABASE_URL"]
    for prefix in ("postgres://", "postgresql://"):
        if url.startswith(prefix):
            os.environ["DATABASE_URL"] = "postgresql+psycopg://" + url[len(prefix):]
            break

    from alembic import command
    from alembic.config import Config
    from sqlalchemy import select, text

    from app.database.session import SessionLocal, engine
    from app.models.business import Business
    from app.routes.auth import register_business
    from app.schemas.auth import BusinessRegister

    registration = BusinessRegister(
        business_name=os.environ["MANCHAS_BUSINESS_NAME"],
        business_slug=os.environ["MANCHAS_BUSINESS_SLUG"],
        business_email=os.environ["MANCHAS_OWNER_EMAIL"],
        admin_name="Administración",
        admin_email=os.environ["MANCHAS_OWNER_EMAIL"],
        admin_password=os.environ["MANCHAS_OWNER_PASSWORD"],
    )

    # Los arranques superpuestos del mismo servicio comparten este bloqueo.
    print("Piloto: conectando con PostgreSQL.", flush=True)
    with engine.connect().execution_options(isolation_level="AUTOCOMMIT") as lock:
        lock.execute(text("SELECT pg_advisory_lock(7098802026)"))
        try:
            print("Piloto: aplicando migraciones.", flush=True)
            command.upgrade(Config("alembic.ini"), "head")
            print("Piloto: comprobando la cuenta inicial.", flush=True)
            with SessionLocal() as db:
                business = db.scalar(select(Business.id).where(
                    Business.slug == registration.business_slug,
                ))
                if business is None:
                    register_business(registration, db)
        finally:
            lock.execute(text("SELECT pg_advisory_unlock(7098802026)"))
    print("Piloto: preparación completada.", flush=True)


def report_error(error: Exception) -> None:
    """Describe el fallo sin imprimir los valores ni la conexión de la base."""
    if isinstance(error, ValidationError):
        fields = {
            "business_name": "MANCHAS_BUSINESS_NAME",
            "business_slug": "MANCHAS_BUSINESS_SLUG",
            "business_email": "MANCHAS_OWNER_EMAIL",
            "admin_email": "MANCHAS_OWNER_EMAIL",
            "admin_password": "MANCHAS_OWNER_PASSWORD",
        }
        problems = {
            f"{fields.get(str(item['loc'][0]), str(item['loc'][0]).upper())} ({item['type']})"
            for item in error.errors(include_input=False, include_context=False, include_url=False)
        }
        message = "Variables inválidas: " + ", ".join(sorted(problems))
    elif isinstance(error, RuntimeError) and str(error).startswith("MISSING_ENV:"):
        message = "Faltan variables: " + str(error).removeprefix("MISSING_ENV:")
    elif isinstance(error, SQLAlchemyError):
        original = getattr(error, "orig", None)
        code = getattr(original, "sqlstate", None)
        message = f"Error de PostgreSQL ({type(error).__name__}, SQLSTATE={code or 'sin código'}). Revisa DATABASE_URL y el estado de la base."
    elif isinstance(error, HTTPException):
        message = f"El alta inicial fue rechazada (HTTP {error.status_code}). Revisa el correo y el identificador del negocio."
    elif isinstance(error, ModuleNotFoundError):
        message = f"Falta el módulo {error.name}."
    else:
        message = f"Fallo de preparación ({type(error).__name__}). Revisa el último paso registrado."
    print(message, file=sys.stderr, flush=True)


def main() -> int:
    try:
        port = int(os.environ.get("PORT", "10000"))
        if not 1 <= port <= 65535:
            raise ValueError("Puerto fuera de rango.")
        prepare()
    except Exception as error:
        report_error(error)
        return 1

    os.execvp(sys.executable, [
        sys.executable, "-m", "uvicorn", "app.render_web:app",
        "--host", "0.0.0.0", "--port", str(port),
    ])
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
