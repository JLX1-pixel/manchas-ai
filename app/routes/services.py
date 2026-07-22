import uuid

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.dependencies import (
    get_current_business_user,
    require_business_roles,
)
from app.database.session import get_db
from app.models.service import Service
from app.models.user import User, UserRole
from app.schemas.service import ServiceCreate, ServiceOut, ServiceUpdate

router = APIRouter(
    prefix="/services",
    tags=["Servicios"],
)

# Los precios y duraciones los define el dueño del negocio.
MANAGE_SERVICES_ROLES = (UserRole.ADMIN.value,)


def _get_service_or_404(
    service_id: uuid.UUID,
    business_id: uuid.UUID,
    db: Session,
) -> Service:
    service = db.scalar(
        select(Service).where(
            Service.id == service_id,
            Service.business_id == business_id,
        )
    )

    if service is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Servicio no encontrado.",
        )

    return service


@router.post(
    "",
    response_model=ServiceOut,
    status_code=status.HTTP_201_CREATED,
    summary="Crear un servicio",
)
def create_service(
    payload: ServiceCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(
        require_business_roles(*MANAGE_SERVICES_ROLES)
    ),
) -> Service:
    service = Service(
        business_id=current_user.business_id,
        name=payload.name.strip(),
        description=payload.description,
        price=payload.price,
        duration_minutes=payload.duration_minutes,
    )

    db.add(service)
    db.commit()
    db.refresh(service)

    return service


@router.get(
    "",
    response_model=list[ServiceOut],
    summary="Listar servicios",
)
def list_services(
    include_inactive: bool = Query(default=False),
    skip: int = Query(default=0, ge=0),
    limit: int = Query(default=100, ge=1, le=200),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_business_user),
) -> list[Service]:
    query = select(Service).where(
        Service.business_id == current_user.business_id
    )

    if not include_inactive:
        query = query.where(Service.is_active.is_(True))

    query = (
        query.order_by(Service.name.asc())
        .offset(skip)
        .limit(limit)
    )

    return list(db.scalars(query).all())


@router.get(
    "/{service_id}",
    response_model=ServiceOut,
    summary="Obtener un servicio",
)
def get_service(
    service_id: uuid.UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_business_user),
) -> Service:
    return _get_service_or_404(service_id, current_user.business_id, db)


@router.put(
    "/{service_id}",
    response_model=ServiceOut,
    summary="Editar un servicio",
)
def update_service(
    service_id: uuid.UUID,
    payload: ServiceUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(
        require_business_roles(*MANAGE_SERVICES_ROLES)
    ),
) -> Service:
    service = _get_service_or_404(
        service_id, current_user.business_id, db
    )

    updates = payload.model_dump(exclude_unset=True)

    if "name" in updates:
        service.name = updates["name"].strip()

    if "description" in updates:
        service.description = updates["description"]

    if "price" in updates:
        service.price = updates["price"]

    if "duration_minutes" in updates:
        service.duration_minutes = updates["duration_minutes"]

    db.commit()
    db.refresh(service)

    return service


@router.patch(
    "/{service_id}/deactivate",
    response_model=ServiceOut,
    summary="Desactivar un servicio",
)
def deactivate_service(
    service_id: uuid.UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(
        require_business_roles(*MANAGE_SERVICES_ROLES)
    ),
) -> Service:
    service = _get_service_or_404(
        service_id, current_user.business_id, db
    )
    service.is_active = False

    db.commit()
    db.refresh(service)

    return service


@router.patch(
    "/{service_id}/activate",
    response_model=ServiceOut,
    summary="Reactivar un servicio",
)
def activate_service(
    service_id: uuid.UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(
        require_business_roles(*MANAGE_SERVICES_ROLES)
    ),
) -> Service:
    service = _get_service_or_404(
        service_id, current_user.business_id, db
    )
    service.is_active = True

    db.commit()
    db.refresh(service)

    return service
