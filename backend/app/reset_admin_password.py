"""Recuperación asistida de acceso desde la consola del servidor."""

import sys
import warnings
from getpass import GetPassWarning, getpass

from pydantic import ValidationError
from sqlalchemy import select, update
from sqlalchemy.exc import SQLAlchemyError
from sqlalchemy.orm import Session

from app.core.security import hash_password
from app.database.session import SessionLocal
from app.models.business import Business
from app.models.user import User, UserRole
from app.schemas.auth import AdminPasswordReset


def reset_admin_password(db: Session, payload: AdminPasswordReset) -> bool:
    business_id = (
        select(Business.id)
        .where(Business.slug == payload.business_slug, Business.is_active.is_(True))
        .scalar_subquery()
    )
    updated = db.scalar(
        update(User)
        .where(
            User.business_id == business_id,
            User.email == str(payload.admin_email).lower(),
            User.role == UserRole.ADMIN.value,
            User.is_active.is_(True),
        )
        .values(
            password_hash=hash_password(payload.new_password),
            token_version=User.token_version + 1,
        )
        .returning(User.id)
    )
    if updated is None:
        return False

    db.commit()
    return True


def main() -> int:
    if not sys.stdin.isatty():
        print("Abre una terminal interactiva para introducir la contraseña.")
        return 1

    try:
        business_slug = input("Identificador del negocio: ").strip().lower()
        admin_email = input("Correo del administrador: ").strip()
        with warnings.catch_warnings():
            warnings.simplefilter("error", GetPassWarning)
            new_password = getpass("Nueva contraseña (mínimo 10 caracteres): ")
            confirmation = getpass("Confirma la nueva contraseña: ")
        if new_password != confirmation:
            print("Las contraseñas no coinciden.")
            return 1

        payload = AdminPasswordReset(
            business_slug=business_slug,
            admin_email=admin_email,
            new_password=new_password,
        )
        with SessionLocal() as db:
            changed = reset_admin_password(db, payload)
    except ValidationError as error:
        for problem in error.errors(include_input=False):
            print(f"{problem['loc'][0]}: {problem['msg']}")
        return 1
    except (EOFError, KeyboardInterrupt, GetPassWarning):
        print("\nRestablecimiento interrumpido.")
        return 1
    except SQLAlchemyError:
        print("No se pudo guardar el cambio en PostgreSQL.")
        return 1

    if not changed:
        print("No se encontró un administrador activo con ese negocio y correo.")
        return 1

    print("Contraseña actualizada. Las sesiones anteriores dejaron de ser válidas.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
