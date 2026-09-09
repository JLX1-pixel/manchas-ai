import uuid
from datetime import datetime, time

from sqlalchemy import (
    Boolean,
    DateTime,
    ForeignKey,
    Integer,
    Time,
    UniqueConstraint,
    func,
)
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column

from app.database.base import Base


class BarberSchedule(Base):
    """Horario fijo semanal de un peluquero.

    Una fila por día de la semana (0=lunes ... 6=domingo). El mismo
    horario se repite todas las semanas; para excepciones puntuales
    (vacaciones, días libres) se usa BarberTimeOff.
    """

    __tablename__ = "barber_schedules"

    __table_args__ = (
        UniqueConstraint(
            "barber_id",
            "weekday",
            name="uq_barber_schedule_weekday",
        ),
    )

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        primary_key=True,
        default=uuid.uuid4,
    )

    barber_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey(
            "barbers.id",
            ondelete="CASCADE",
        ),
        nullable=False,
        index=True,
    )

    # 0 = lunes, 1 = martes, ..., 6 = domingo
    weekday: Mapped[int] = mapped_column(
        Integer,
        nullable=False,
    )

    is_working: Mapped[bool] = mapped_column(
        Boolean,
        nullable=False,
        default=True,
        server_default="true",
    )

    start_time: Mapped[time | None] = mapped_column(
        Time,
        nullable=True,
    )

    end_time: Mapped[time | None] = mapped_column(
        Time,
        nullable=True,
    )

    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        nullable=False,
        server_default=func.now(),
    )

    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        nullable=False,
        server_default=func.now(),
        onupdate=func.now(),
    )
