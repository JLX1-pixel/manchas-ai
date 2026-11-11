import uuid
from datetime import date, datetime, time, timedelta

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import and_, select
from sqlalchemy.orm import Session

from app.core.dependencies import (
    get_current_business_user,
    require_business_roles,
)
from app.database.session import get_db
from app.models.appointment import Appointment, AppointmentStatus
from app.models.barber import Barber
from app.models.barber_schedule import BarberSchedule
from app.models.barber_time_off import BarberTimeOff
from app.models.client import Client
from app.models.service import Service
from app.models.user import User, UserRole
from app.schemas.appointment import (
    AppointmentCreate,
    AppointmentOut,
    AppointmentReschedule,
    AppointmentSlot,
)

router = APIRouter(
    prefix="/appointments",
    tags=["Citas"],
)

MANAGE_APPOINTMENTS_ROLES = (
    UserRole.ADMIN.value,
    UserRole.RECEPCIONISTA.value,
)

# Estados en los que una cita ya no bloquea el horario del peluquero
# ni puede seguir editándose.
CLOSED_STATUSES = (
    AppointmentStatus.CANCELADA.value,
    AppointmentStatus.COMPLETADA.value,
    AppointmentStatus.NO_ASISTIO.value,
)

# Hora máxima de cierre para peluquerías en el MVP (7:00 p. m.).
MAX_APPOINTMENT_END_TIME = time(19, 0)


def _add_minutes(base_time: time, minutes: int) -> time:
    combined = datetime.combine(date.min, base_time) + timedelta(
        minutes=minutes
    )

    if combined.date() != date.min:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_CONTENT,
            detail="La cita debe terminar antes de la medianoche.",
        )

    return combined.time()


def _get_appointment_or_404(
    appointment_id: uuid.UUID,
    business_id: uuid.UUID,
    db: Session,
    barber_id: uuid.UUID | None = None,
) -> Appointment:
    conditions = [
        Appointment.id == appointment_id,
        Appointment.business_id == business_id,
    ]

    if barber_id is not None:
        conditions.append(Appointment.barber_id == barber_id)

    appointment = db.scalar(select(Appointment).where(*conditions))

    if appointment is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Cita no encontrada.",
        )

    return appointment


def _get_active_record(model, record_id, business_id, db, label: str):
    record = db.scalar(
        select(model).where(
            model.id == record_id,
            model.business_id == business_id,
        )
    )

    if record is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"{label} no encontrado.",
        )

    if not record.is_active:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"{label} está inactivo.",
        )

    return record


def _blocking_appointments_query(
    business_id: uuid.UUID,
    barber_id: uuid.UUID,
    appointment_date: date,
    exclude_appointment_id: uuid.UUID | None = None,
):
    query = select(Appointment).where(
        Appointment.business_id == business_id,
        Appointment.barber_id == barber_id,
        Appointment.appointment_date == appointment_date,
        Appointment.status.notin_(CLOSED_STATUSES),
    )
    if exclude_appointment_id is not None:
        query = query.where(Appointment.id != exclude_appointment_id)
    return query


def _validate_slot(
    db: Session,
    barber_id: uuid.UUID,
    appointment_date: date,
    start_time: time,
    end_time: time,
    exclude_appointment_id: uuid.UUID | None = None,
) -> None:
    # Serialize reservations for the same barber. PostgreSQL keeps this row
    # lock until the surrounding request commits or rolls back, so a second
    # request checks for conflicts after the first one has finished.
    barber = db.scalar(
        select(Barber)
        .where(Barber.id == barber_id)
        .with_for_update()
    )

    if barber is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Peluquero no encontrado.",
        )

    # 1. El peluquero debe trabajar ese día, dentro de su horario.
    weekday = appointment_date.weekday()  # 0 = lunes ... 6 = domingo

    schedule = db.scalar(
        select(BarberSchedule).where(
            BarberSchedule.barber_id == barber_id,
            BarberSchedule.weekday == weekday,
        )
    )

    if schedule is None or not schedule.is_working:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="El peluquero no trabaja ese día.",
        )

    if start_time < schedule.start_time or end_time > schedule.end_time:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=(
                "El horario solicitado está fuera del horario de "
                f"trabajo del peluquero ({schedule.start_time.strftime('%H:%M')} "
                f"- {schedule.end_time.strftime('%H:%M')})."
            ),
        )

    if end_time > MAX_APPOINTMENT_END_TIME:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="La cita debe terminar a más tardar a las 19:00.",
        )

    # 2. El peluquero no debe estar en un día libre / vacaciones.
    time_off = db.scalar(
        select(BarberTimeOff).where(
            BarberTimeOff.barber_id == barber_id,
            BarberTimeOff.start_date <= appointment_date,
            BarberTimeOff.end_date >= appointment_date,
        )
    )

    if time_off is not None:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="El peluquero tiene día libre o vacaciones ese día.",
        )

    # 3. No debe cruzarse con otra cita activa del mismo peluquero.
    overlap_query = _blocking_appointments_query(
        barber.business_id, barber_id, appointment_date, exclude_appointment_id,
    ).where(
        Appointment.start_time < end_time,
        Appointment.end_time > start_time,
    )

    conflicting = db.scalar(overlap_query)

    if conflicting is not None:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=(
                "El peluquero ya tiene una cita en ese horario "
                f"({conflicting.start_time.strftime('%H:%M')} - "
                f"{conflicting.end_time.strftime('%H:%M')})."
            ),
        )


def _current_user_barber_id(
    current_user: User, db: Session
) -> uuid.UUID | None:
    if current_user.role != UserRole.PELUQUERO.value:
        return None

    barber = db.scalar(
        select(Barber).where(
            Barber.user_id == current_user.id,
            Barber.business_id == current_user.business_id,
        )
    )

    if barber is None:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Tu usuario no está vinculado a un peluquero.",
        )

    return barber.id


@router.get(
    "/availability",
    response_model=list[AppointmentSlot],
    summary="Consultar horas disponibles para un servicio y peluquero",
)
def available_slots(
    barber_id: uuid.UUID,
    service_id: uuid.UUID,
    appointment_date: date,
    exclude_appointment_id: uuid.UUID | None = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_business_roles(*MANAGE_APPOINTMENTS_ROLES)),
) -> list[AppointmentSlot]:
    business_id = current_user.business_id
    barber = _get_active_record(Barber, barber_id, business_id, db, "Peluquero")
    service = _get_active_record(Service, service_id, business_id, db, "Servicio")
    if exclude_appointment_id is not None:
        _get_appointment_or_404(exclude_appointment_id, business_id, db)

    schedule = db.scalar(select(BarberSchedule).where(
        BarberSchedule.barber_id == barber.id,
        BarberSchedule.weekday == appointment_date.weekday(),
    ))
    if (schedule is None or not schedule.is_working
            or schedule.start_time is None or schedule.end_time is None):
        return []
    time_off = db.scalar(select(BarberTimeOff.id).where(
        BarberTimeOff.barber_id == barber.id,
        BarberTimeOff.start_date <= appointment_date,
        BarberTimeOff.end_date >= appointment_date,
    ))
    if time_off is not None:
        return []

    bookings = list(db.scalars(_blocking_appointments_query(
        business_id, barber.id, appointment_date, exclude_appointment_id,
    )))
    start = datetime.combine(date.min, schedule.start_time)
    closing = datetime.combine(
        date.min, min(schedule.end_time, MAX_APPOINTMENT_END_TIME),
    )
    duration = timedelta(minutes=service.duration_minutes)
    slots = []
    while start + duration <= closing:
        end = start + duration
        if not any(
            booking.start_time < end.time() and booking.end_time > start.time()
            for booking in bookings
        ):
            slots.append(AppointmentSlot(start_time=start.time(), end_time=end.time()))
        start += timedelta(minutes=15)
    return slots


@router.post(
    "",
    response_model=AppointmentOut,
    status_code=status.HTTP_201_CREATED,
    summary="Agendar una cita",
)
def create_appointment(
    payload: AppointmentCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(
        require_business_roles(*MANAGE_APPOINTMENTS_ROLES)
    ),
) -> Appointment:
    business_id = current_user.business_id

    _get_active_record(Client, payload.client_id, business_id, db, "Cliente")
    barber = _get_active_record(
        Barber, payload.barber_id, business_id, db, "Peluquero"
    )
    service = _get_active_record(
        Service, payload.service_id, business_id, db, "Servicio"
    )

    end_time = _add_minutes(payload.start_time, service.duration_minutes)

    _validate_slot(
        db,
        barber_id=barber.id,
        appointment_date=payload.appointment_date,
        start_time=payload.start_time,
        end_time=end_time,
    )

    appointment = Appointment(
        business_id=business_id,
        client_id=payload.client_id,
        barber_id=payload.barber_id,
        service_id=payload.service_id,
        appointment_date=payload.appointment_date,
        start_time=payload.start_time,
        end_time=end_time,
        notes=payload.notes,
        status=AppointmentStatus.PENDIENTE.value,
    )

    db.add(appointment)
    db.commit()
    db.refresh(appointment)

    return appointment


@router.get(
    "",
    response_model=list[AppointmentOut],
    summary="Listar citas (agenda)",
)
def list_appointments(
    appointment_date: date | None = Query(default=None),
    date_from: date | None = Query(default=None),
    date_to: date | None = Query(default=None),
    barber_id: uuid.UUID | None = Query(default=None),
    client_id: uuid.UUID | None = Query(default=None),
    appointment_status: AppointmentStatus | None = Query(
        default=None, alias="status"
    ),
    skip: int = Query(default=0, ge=0),
    limit: int = Query(default=100, ge=1, le=300),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_business_user),
) -> list[Appointment]:
    query = select(Appointment).where(
        Appointment.business_id == current_user.business_id
    )

    # Un peluquero, si tiene cuenta propia, solo ve su propia agenda.
    own_barber_id = _current_user_barber_id(current_user, db)

    if own_barber_id is not None:
        query = query.where(Appointment.barber_id == own_barber_id)
    elif barber_id is not None:
        query = query.where(Appointment.barber_id == barber_id)

    if appointment_date is not None:
        query = query.where(Appointment.appointment_date == appointment_date)
    else:
        if date_from is not None:
            query = query.where(
                Appointment.appointment_date >= date_from
            )
        if date_to is not None:
            query = query.where(Appointment.appointment_date <= date_to)

    if client_id is not None:
        query = query.where(Appointment.client_id == client_id)

    if appointment_status is not None:
        query = query.where(Appointment.status == appointment_status.value)

    query = (
        query.order_by(
            Appointment.appointment_date.asc(),
            Appointment.start_time.asc(),
        )
        .offset(skip)
        .limit(limit)
    )

    return list(db.scalars(query).all())


@router.get(
    "/agenda/daily",
    response_model=list[AppointmentOut],
    summary="Agenda de un día, ordenada por peluquero",
)
def daily_agenda(
    for_date: date = Query(alias="date"),
    barber_id: uuid.UUID | None = Query(default=None),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_business_user),
) -> list[Appointment]:
    query = select(Appointment).where(
        Appointment.business_id == current_user.business_id,
        Appointment.appointment_date == for_date,
        Appointment.status.notin_((AppointmentStatus.CANCELADA.value,)),
    )

    own_barber_id = _current_user_barber_id(current_user, db)

    if own_barber_id is not None:
        query = query.where(Appointment.barber_id == own_barber_id)
    elif barber_id is not None:
        query = query.where(Appointment.barber_id == barber_id)

    query = query.order_by(
        Appointment.barber_id.asc(),
        Appointment.start_time.asc(),
    )

    return list(db.scalars(query).all())


@router.get(
    "/agenda/weekly",
    response_model=list[AppointmentOut],
    summary="Agenda de 7 días a partir de una fecha",
)
def weekly_agenda(
    start_date: date = Query(),
    barber_id: uuid.UUID | None = Query(default=None),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_business_user),
) -> list[Appointment]:
    end_date = start_date + timedelta(days=6)

    query = select(Appointment).where(
        Appointment.business_id == current_user.business_id,
        Appointment.appointment_date >= start_date,
        Appointment.appointment_date <= end_date,
        Appointment.status.notin_((AppointmentStatus.CANCELADA.value,)),
    )

    own_barber_id = _current_user_barber_id(current_user, db)

    if own_barber_id is not None:
        query = query.where(Appointment.barber_id == own_barber_id)
    elif barber_id is not None:
        query = query.where(Appointment.barber_id == barber_id)

    query = query.order_by(
        Appointment.appointment_date.asc(),
        Appointment.barber_id.asc(),
        Appointment.start_time.asc(),
    )

    return list(db.scalars(query).all())


@router.get(
    "/{appointment_id}",
    response_model=AppointmentOut,
    summary="Obtener una cita",
)
def get_appointment(
    appointment_id: uuid.UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_business_user),
) -> Appointment:
    own_barber_id = _current_user_barber_id(current_user, db)

    return _get_appointment_or_404(
        appointment_id,
        current_user.business_id,
        db,
        barber_id=own_barber_id,
    )


@router.put(
    "/{appointment_id}",
    response_model=AppointmentOut,
    summary="Reprogramar una cita",
)
def reschedule_appointment(
    appointment_id: uuid.UUID,
    payload: AppointmentReschedule,
    db: Session = Depends(get_db),
    current_user: User = Depends(
        require_business_roles(*MANAGE_APPOINTMENTS_ROLES)
    ),
) -> Appointment:
    business_id = current_user.business_id
    appointment = _get_appointment_or_404(appointment_id, business_id, db)

    if appointment.status in CLOSED_STATUSES:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=(
                "No se puede reprogramar una cita cancelada, "
                "completada o marcada como no asistió."
            ),
        )

    updates = payload.model_dump(exclude_unset=True)

    barber_id = appointment.barber_id
    if "barber_id" in updates:
        barber = _get_active_record(
            Barber, updates["barber_id"], business_id, db, "Peluquero"
        )
        barber_id = barber.id

    service = _get_active_record(
        Service,
        updates.get("service_id", appointment.service_id),
        business_id,
        db,
        "Servicio",
    )

    appointment_date = updates.get(
        "appointment_date", appointment.appointment_date
    )
    start_time = updates.get("start_time", appointment.start_time)
    end_time = _add_minutes(start_time, service.duration_minutes)

    _validate_slot(
        db,
        barber_id=barber_id,
        appointment_date=appointment_date,
        start_time=start_time,
        end_time=end_time,
        exclude_appointment_id=appointment.id,
    )

    appointment.barber_id = barber_id
    appointment.service_id = service.id
    appointment.appointment_date = appointment_date
    appointment.start_time = start_time
    appointment.end_time = end_time

    if "notes" in updates:
        appointment.notes = updates["notes"]

    # Reprogramar vuelve la cita a pendiente de confirmación.
    appointment.status = AppointmentStatus.PENDIENTE.value

    db.commit()
    db.refresh(appointment)

    return appointment


def _transition_status(
    appointment: Appointment,
    allowed_from: tuple[str, ...],
    new_status: AppointmentStatus,
) -> None:
    if appointment.status not in allowed_from:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=(
                f"No se puede pasar una cita en estado "
                f"'{appointment.status}' a '{new_status.value}'."
            ),
        )

    appointment.status = new_status.value


@router.patch(
    "/{appointment_id}/confirm",
    response_model=AppointmentOut,
    summary="Confirmar una cita",
)
def confirm_appointment(
    appointment_id: uuid.UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(
        require_business_roles(*MANAGE_APPOINTMENTS_ROLES)
    ),
) -> Appointment:
    appointment = _get_appointment_or_404(
        appointment_id, current_user.business_id, db
    )
    _transition_status(
        appointment,
        (AppointmentStatus.PENDIENTE.value,),
        AppointmentStatus.CONFIRMADA,
    )
    db.commit()
    db.refresh(appointment)

    return appointment


@router.patch(
    "/{appointment_id}/cancel",
    response_model=AppointmentOut,
    summary="Cancelar una cita",
)
def cancel_appointment(
    appointment_id: uuid.UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(
        require_business_roles(*MANAGE_APPOINTMENTS_ROLES)
    ),
) -> Appointment:
    appointment = _get_appointment_or_404(
        appointment_id, current_user.business_id, db
    )
    _transition_status(
        appointment,
        (
            AppointmentStatus.PENDIENTE.value,
            AppointmentStatus.CONFIRMADA.value,
        ),
        AppointmentStatus.CANCELADA,
    )
    db.commit()
    db.refresh(appointment)

    return appointment


@router.patch(
    "/{appointment_id}/complete",
    response_model=AppointmentOut,
    summary="Marcar una cita como completada",
)
def complete_appointment(
    appointment_id: uuid.UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(
        require_business_roles(*MANAGE_APPOINTMENTS_ROLES)
    ),
) -> Appointment:
    appointment = _get_appointment_or_404(
        appointment_id, current_user.business_id, db
    )
    _transition_status(
        appointment,
        (
            AppointmentStatus.PENDIENTE.value,
            AppointmentStatus.CONFIRMADA.value,
        ),
        AppointmentStatus.COMPLETADA,
    )
    db.commit()
    db.refresh(appointment)

    return appointment


@router.patch(
    "/{appointment_id}/no-show",
    response_model=AppointmentOut,
    summary="Marcar una cita como no asistió",
)
def mark_no_show(
    appointment_id: uuid.UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(
        require_business_roles(*MANAGE_APPOINTMENTS_ROLES)
    ),
) -> Appointment:
    appointment = _get_appointment_or_404(
        appointment_id, current_user.business_id, db
    )
    _transition_status(
        appointment,
        (
            AppointmentStatus.PENDIENTE.value,
            AppointmentStatus.CONFIRMADA.value,
        ),
        AppointmentStatus.NO_ASISTIO,
    )
    db.commit()
    db.refresh(appointment)

    return appointment
