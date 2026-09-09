import uuid

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import or_, select
from sqlalchemy.orm import Session

from app.core.dependencies import (
    get_current_business_user,
    require_business_roles,
)
from app.database.session import get_db
from app.models.client import Client
from app.models.user import User, UserRole
from app.schemas.client import ClientCreate, ClientOut, ClientUpdate

router = APIRouter(
    prefix="/clients",
    tags=["Clientes"],
)

# Roles que pueden crear, editar y desactivar clientes.
# PELUQUERO solo puede consultar (usa get_current_business_user en los GET).
MANAGE_CLIENTS_ROLES = (
    UserRole.ADMIN.value,
    UserRole.RECEPCIONISTA.value,
)


def _get_client_or_404(
    client_id: uuid.UUID,
    business_id: uuid.UUID,
    db: Session,
) -> Client:
    client = db.scalar(
        select(Client).where(
            Client.id == client_id,
            Client.business_id == business_id,
        )
    )

    if client is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Cliente no encontrado.",
        )

    return client


@router.post(
    "",
    response_model=ClientOut,
    status_code=status.HTTP_201_CREATED,
    summary="Crear un cliente",
)
def create_client(
    payload: ClientCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_business_roles(*MANAGE_CLIENTS_ROLES)),
) -> Client:
    client = Client(
        business_id=current_user.business_id,
        name=payload.name.strip(),
        phone=payload.phone,
        email=str(payload.email).strip().lower() if payload.email else None,
        notes=payload.notes,
        is_frequent=payload.is_frequent,
    )

    db.add(client)
    db.commit()
    db.refresh(client)

    return client


@router.get(
    "",
    response_model=list[ClientOut],
    summary="Listar clientes",
)
def list_clients(
    search: str | None = Query(
        default=None,
        description="Busca por nombre, teléfono o correo.",
    ),
    include_inactive: bool = Query(default=False),
    skip: int = Query(default=0, ge=0),
    limit: int = Query(default=50, ge=1, le=200),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_business_user),
) -> list[Client]:
    query = select(Client).where(
        Client.business_id == current_user.business_id
    )

    if not include_inactive:
        query = query.where(Client.is_active.is_(True))

    if search:
        term = f"%{search.strip()}%"
        query = query.where(
            or_(
                Client.name.ilike(term),
                Client.phone.ilike(term),
                Client.email.ilike(term),
            )
        )

    query = (
        query.order_by(Client.name.asc())
        .offset(skip)
        .limit(limit)
    )

    return list(db.scalars(query).all())


@router.get(
    "/{client_id}",
    response_model=ClientOut,
    summary="Obtener un cliente",
)
def get_client(
    client_id: uuid.UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_business_user),
) -> Client:
    return _get_client_or_404(client_id, current_user.business_id, db)


@router.put(
    "/{client_id}",
    response_model=ClientOut,
    summary="Editar un cliente",
)
def update_client(
    client_id: uuid.UUID,
    payload: ClientUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_business_roles(*MANAGE_CLIENTS_ROLES)),
) -> Client:
    client = _get_client_or_404(client_id, current_user.business_id, db)

    updates = payload.model_dump(exclude_unset=True)

    if "name" in updates:
        client.name = updates["name"].strip()

    if "phone" in updates:
        client.phone = updates["phone"]

    if "email" in updates:
        client.email = (
            str(updates["email"]).strip().lower()
            if updates["email"]
            else None
        )

    if "notes" in updates:
        client.notes = updates["notes"]

    if "is_frequent" in updates:
        client.is_frequent = updates["is_frequent"]

    db.commit()
    db.refresh(client)

    return client


@router.patch(
    "/{client_id}/deactivate",
    response_model=ClientOut,
    summary="Desactivar un cliente",
)
def deactivate_client(
    client_id: uuid.UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_business_roles(*MANAGE_CLIENTS_ROLES)),
) -> Client:
    client = _get_client_or_404(client_id, current_user.business_id, db)
    client.is_active = False

    db.commit()
    db.refresh(client)

    return client


@router.patch(
    "/{client_id}/activate",
    response_model=ClientOut,
    summary="Reactivar un cliente",
)
def activate_client(
    client_id: uuid.UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_business_roles(*MANAGE_CLIENTS_ROLES)),
) -> Client:
    client = _get_client_or_404(client_id, current_user.business_id, db)
    client.is_active = True

    db.commit()
    db.refresh(client)

    return client
