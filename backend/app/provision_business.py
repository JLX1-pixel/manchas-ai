"""Alta asistida de un negocio desde la consola del servidor."""

from getpass import getpass

from fastapi import HTTPException
from pydantic import ValidationError

from app.database.session import SessionLocal
from app.routes.auth import register_business
from app.schemas.auth import BusinessRegister


def main() -> int:
    try:
        business_name = input("Nombre del negocio: ").strip()
        business_slug = input("Identificador para iniciar sesión: ").strip().lower()
        business_email = input("Correo del negocio: ").strip()
        admin_name = input("Nombre del administrador: ").strip()
        admin_email = input("Correo del administrador: ").strip()
        password = getpass("Contraseña del administrador: ")
        if password != getpass("Confirma la contraseña: "):
            print("Las contraseñas no coinciden.")
            return 1

        registration = BusinessRegister(
            business_name=business_name,
            business_slug=business_slug,
            business_email=business_email,
            admin_name=admin_name,
            admin_email=admin_email,
            admin_password=password,
        )
        with SessionLocal() as db:
            result = register_business(registration, db)
    except ValidationError as error:
        for problem in error.errors(include_input=False):
            print(f"{problem['loc'][0]}: {problem['msg']}")
        return 1
    except HTTPException as error:
        print(error.detail)
        return 1
    except (EOFError, KeyboardInterrupt):
        print("\nAlta interrumpida.")
        return 1

    print(f"Negocio creado. Identificador de acceso: {result.business_slug}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
