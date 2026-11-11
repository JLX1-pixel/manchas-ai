import uuid
from datetime import date, datetime, time

from pydantic import BaseModel, ConfigDict, Field

from app.models.appointment import AppointmentStatus


class AppointmentCreate(BaseModel):
    client_id: uuid.UUID
    barber_id: uuid.UUID
    service_id: uuid.UUID

    appointment_date: date
    start_time: time

    notes: str | None = Field(default=None, max_length=2000)


class AppointmentReschedule(BaseModel):
    """Para reprogramar: cambia fecha/hora y, si hace falta,
    de peluquero o de servicio. Todo opcional, solo se actualiza
    lo que se envíe."""

    barber_id: uuid.UUID | None = None
    service_id: uuid.UUID | None = None
    appointment_date: date | None = None
    start_time: time | None = None
    notes: str | None = Field(default=None, max_length=2000)


class AppointmentOut(BaseModel):
    id: uuid.UUID
    business_id: uuid.UUID
    client_id: uuid.UUID
    barber_id: uuid.UUID
    service_id: uuid.UUID
    appointment_date: date
    start_time: time
    end_time: time
    status: AppointmentStatus
    notes: str | None
    created_at: datetime
    updated_at: datetime

    model_config = ConfigDict(
        from_attributes=True,
    )
