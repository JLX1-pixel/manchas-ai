import uuid

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.dependencies import (
    get_current_business_user,
    require_business_roles,
)
from app.database.session import get_db
from app.models.barber import Barber
from app.models.barber_schedule import BarberSchedule
from app.models.barber_time_off import BarberTimeOff
from app.models.user import User, UserRole
from app.schemas.barber import BarberCreate, BarberOut, BarberUpdate
from app.schemas.barber_schedule import (
    ScheduleDayOut,
    WeeklyScheduleUpdate,
)
from app.schemas.barber_time_off import TimeOffCreate, TimeOffOut

router = APIRouter(
    prefix="/barbers",
    tags=["Peluqueros"],
)

MANAGE_BARBERS_ROLES = (UserRole.ADMIN.value,)


def _get_barber_or_404(
    barber_id: uuid.UUID,
    business_id: uuid.UUID,
    db: Session,
) -> Barber:
    barber = db.scalar(
        select(Barber).where(
            Barber.id == barber_id,
            Barber.business_id == business_id,
        )
    )

    if barber is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Peluquero no encontrado.",
        )

    return barber


# --------------------------------------------------------------------
# CRUD de peluqueros
# --------------------------------------------------------------------


@router.post(
    "",
    response_model=BarberOut,
    status_code=status.HTTP_201_CREATED,
    summary="Registrar un peluquero",
)
def create_barber(
    payload: BarberCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(
        require_business_roles(*MANAGE_BARBERS_ROLES)
    ),
) -> Barber:
    if payload.user_id is not None:
        linked_user = db.scalar(
            select(User).where(
                User.id == payload.user_id,
                User.business_id == current_user.business_id,
            )
        )

        if linked_user is None:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="El usuario indicado no pertenece a este negocio.",
            )

        already_linked = db.scalar(
            select(Barber).where(Barber.user_id == payload.user_id)
        )

        if already_linked is not None:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail="Ese usuario ya está vinculado a otro peluquero.",
            )

    barber = Barber(
        business_id=current_user.business_id,
        user_id=payload.user_id,
        name=payload.name.strip(),
        phone=payload.phone,
        specialty=payload.specialty,
    )

    db.add(barber)
    db.commit()
    db.refresh(barber)

    return barber


@router.get(
    "",
    response_model=list[BarberOut],
    summary="Listar peluqueros",
)
def list_barbers(
    include_inactive: bool = Query(default=False),
    skip: int = Query(default=0, ge=0),
    limit: int = Query(default=100, ge=1, le=200),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_business_user),
) -> list[Barber]:
    query = select(Barber).where(
        Barber.business_id == current_user.business_id
    )

    if not include_inactive:
        query = query.where(Barber.is_active.is_(True))

    query = (
        query.order_by(Barber.name.asc())
        .offset(skip)
        .limit(limit)
    )

    return list(db.scalars(query).all())


@router.get(
    "/{barber_id}",
    response_model=BarberOut,
    summary="Obtener un peluquero",
)
def get_barber(
    barber_id: uuid.UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_business_user),
) -> Barber:
    return _get_barber_or_404(barber_id, current_user.business_id, db)


@router.put(
    "/{barber_id}",
    response_model=BarberOut,
    summary="Editar un peluquero",
)
def update_barber(
    barber_id: uuid.UUID,
    payload: BarberUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(
        require_business_roles(*MANAGE_BARBERS_ROLES)
    ),
) -> Barber:
    barber = _get_barber_or_404(barber_id, current_user.business_id, db)

    updates = payload.model_dump(exclude_unset=True)

    if "name" in updates:
        barber.name = updates["name"].strip()

    if "phone" in updates:
        barber.phone = updates["phone"]

    if "specialty" in updates:
        barber.specialty = updates["specialty"]

    if "user_id" in updates:
        barber.user_id = updates["user_id"]

    db.commit()
    db.refresh(barber)

    return barber


@router.patch(
    "/{barber_id}/deactivate",
    response_model=BarberOut,
    summary="Desactivar un peluquero",
)
def deactivate_barber(
    barber_id: uuid.UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(
        require_business_roles(*MANAGE_BARBERS_ROLES)
    ),
) -> Barber:
    barber = _get_barber_or_404(barber_id, current_user.business_id, db)
    barber.is_active = False

    db.commit()
    db.refresh(barber)

    return barber


@router.patch(
    "/{barber_id}/activate",
    response_model=BarberOut,
    summary="Reactivar un peluquero",
)
def activate_barber(
    barber_id: uuid.UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(
        require_business_roles(*MANAGE_BARBERS_ROLES)
    ),
) -> Barber:
    barber = _get_barber_or_404(barber_id, current_user.business_id, db)
    barber.is_active = True

    db.commit()
    db.refresh(barber)

    return barber


# --------------------------------------------------------------------
# Horario fijo semanal
# --------------------------------------------------------------------


@router.get(
    "/{barber_id}/schedule",
    response_model=list[ScheduleDayOut],
    summary="Consultar el horario semanal del peluquero",
)
def get_schedule(
    barber_id: uuid.UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_business_user),
) -> list[BarberSchedule]:
    _get_barber_or_404(barber_id, current_user.business_id, db)

    query = (
        select(BarberSchedule)
        .where(BarberSchedule.barber_id == barber_id)
        .order_by(BarberSchedule.weekday.asc())
    )

    return list(db.scalars(query).all())


@router.put(
    "/{barber_id}/schedule",
    response_model=list[ScheduleDayOut],
    summary="Definir el horario semanal del peluquero",
)
def set_schedule(
    barber_id: uuid.UUID,
    payload: WeeklyScheduleUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(
        require_business_roles(*MANAGE_BARBERS_ROLES)
    ),
) -> list[BarberSchedule]:
    """Reemplaza por completo el horario semanal del peluquero.

    Se pensó como un horario fijo simple: se manda la lista de los
    días de la semana que aplican (no hace falta mandar los 7 si
    algunos no cambian de un momento a otro) y ese horario se repite
    todas las semanas hasta que se vuelva a actualizar.
    """
    _get_barber_or_404(barber_id, current_user.business_id, db)

    existing = {
        row.weekday: row
        for row in db.scalars(
            select(BarberSchedule).where(
                BarberSchedule.barber_id == barber_id
            )
        )
    }

    for day in payload.days:
        row = existing.get(day.weekday)

        if row is None:
            row = BarberSchedule(
                barber_id=barber_id,
                weekday=day.weekday,
            )
            db.add(row)

        row.is_working = day.is_working
        row.start_time = day.start_time
        row.end_time = day.end_time

    db.commit()

    query = (
        select(BarberSchedule)
        .where(BarberSchedule.barber_id == barber_id)
        .order_by(BarberSchedule.weekday.asc())
    )

    return list(db.scalars(query).all())


# --------------------------------------------------------------------
# Días libres / vacaciones
# --------------------------------------------------------------------


@router.get(
    "/{barber_id}/time-off",
    response_model=list[TimeOffOut],
    summary="Listar días libres y vacaciones del peluquero",
)
def list_time_off(
    barber_id: uuid.UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_business_user),
) -> list[BarberTimeOff]:
    _get_barber_or_404(barber_id, current_user.business_id, db)

    query = (
        select(BarberTimeOff)
        .where(BarberTimeOff.barber_id == barber_id)
        .order_by(BarberTimeOff.start_date.desc())
    )

    return list(db.scalars(query).all())


@router.post(
    "/{barber_id}/time-off",
    response_model=TimeOffOut,
    status_code=status.HTTP_201_CREATED,
    summary="Registrar un día libre o periodo de vacaciones",
)
def create_time_off(
    barber_id: uuid.UUID,
    payload: TimeOffCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(
        require_business_roles(*MANAGE_BARBERS_ROLES)
    ),
) -> BarberTimeOff:
    _get_barber_or_404(barber_id, current_user.business_id, db)

    time_off = BarberTimeOff(
        barber_id=barber_id,
        start_date=payload.start_date,
        end_date=payload.end_date,
        reason=payload.reason,
    )

    db.add(time_off)
    db.commit()
    db.refresh(time_off)

    return time_off


@router.delete(
    "/{barber_id}/time-off/{time_off_id}",
    status_code=status.HTTP_204_NO_CONTENT,
    summary="Eliminar un día libre o periodo de vacaciones",
)
def delete_time_off(
    barber_id: uuid.UUID,
    time_off_id: uuid.UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(
        require_business_roles(*MANAGE_BARBERS_ROLES)
    ),
) -> None:
    _get_barber_or_404(barber_id, current_user.business_id, db)

    time_off = db.scalar(
        select(BarberTimeOff).where(
            BarberTimeOff.id == time_off_id,
            BarberTimeOff.barber_id == barber_id,
        )
    )

    if time_off is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Registro de día libre no encontrado.",
        )

    db.delete(time_off)
    db.commit()
