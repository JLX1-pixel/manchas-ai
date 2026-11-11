"""Arranque del piloto en Render con migración y alta inicial idempotentes."""

import os
import sys


def prepare() -> None:
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
    with engine.connect().execution_options(isolation_level="AUTOCOMMIT") as lock:
        lock.execute(text("SELECT pg_advisory_lock(7098802026)"))
        try:
            command.upgrade(Config("alembic.ini"), "head")
            with SessionLocal() as db:
                business = db.scalar(select(Business.id).where(
                    Business.slug == registration.business_slug,
                ))
                if business is None:
                    register_business(registration, db)
        finally:
            lock.execute(text("SELECT pg_advisory_unlock(7098802026)"))


def main() -> int:
    try:
        port = int(os.environ.get("PORT", "10000"))
        if not 1 <= port <= 65535:
            raise ValueError("Puerto fuera de rango.")
        prepare()
    except Exception:
        # Los errores de validación pueden incluir valores de las variables.
        print("No se pudo preparar el piloto. Revisa la conexión y las variables de Render.", file=sys.stderr)
        return 1

    os.execvp(sys.executable, [
        sys.executable, "-m", "uvicorn", "app.render_web:app",
        "--host", "0.0.0.0", "--port", str(port),
    ])
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
