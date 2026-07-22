import uuid

import jwt
from fastapi import Depends, HTTPException, status
from fastapi.security import OAuth2PasswordBearer
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.security import decode_access_token
from app.database.session import get_db
from app.models.user import User

oauth2_scheme = OAuth2PasswordBearer(
    tokenUrl="/api/v1/auth/login",
    auto_error=False,
)


def get_current_user(
    token: str | None = Depends(oauth2_scheme),
    db: Session = Depends(get_db),
) -> User:
    credentials_error = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="No fue posible validar las credenciales.",
        headers={"WWW-Authenticate": "Bearer"},
    )

    if token is None:
        raise credentials_error

    try:
        payload = decode_access_token(token)
        user_id = uuid.UUID(payload["sub"])
    except (jwt.PyJWTError, KeyError, ValueError) as error:
        raise credentials_error from error

    user = db.scalar(select(User).where(User.id == user_id))

    if user is None or not user.is_active:
        raise credentials_error

    return user


def require_roles(*allowed_roles: str):
    def dependency(current_user: User = Depends(get_current_user)) -> User:
        if current_user.role not in allowed_roles:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="No tienes permisos para realizar esta acción.",
            )

        return current_user

    return dependency


def get_current_business_user(
    current_user: User = Depends(get_current_user),
) -> User:
    """Garantiza que el usuario autenticado pertenece a un negocio.

    Se usa en todas las rutas operativas (clientes, servicios,
    peluqueros, citas) para que un SUPER_ADMIN sin business_id no
    pueda operar sobre datos de un negocio específico por accidente,
    y para tener siempre a mano el business_id con el que filtrar.
    """
    if current_user.business_id is None:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Esta acción requiere pertenecer a un negocio.",
        )

    return current_user


def require_business_roles(*allowed_roles: str):
    """Combina get_current_business_user con una restricción de rol."""

    def dependency(
        current_user: User = Depends(get_current_business_user),
    ) -> User:
        if current_user.role not in allowed_roles:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="No tienes permisos para realizar esta acción.",
            )

        return current_user

    return dependency
