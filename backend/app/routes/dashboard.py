from datetime import datetime
from zoneinfo import ZoneInfo

from fastapi import APIRouter, Depends
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.core.dependencies import require_business_roles
from app.database.session import get_db
from app.models.appointment import Appointment, AppointmentStatus
from app.models.barber import Barber
from app.models.client import Client
from app.models.service import Service
from app.models.user import User, UserRole
from app.schemas.dashboard import DashboardSummary

router = APIRouter(prefix="/dashboard", tags=["Panel"])
BOGOTA_TIMEZONE = ZoneInfo("America/Bogota")


@router.get("/summary", response_model=DashboardSummary)
def get_dashboard_summary(
    db: Session = Depends(get_db),
    current_user: User = Depends(
        require_business_roles(UserRole.ADMIN.value, UserRole.RECEPCIONISTA.value)
    ),
) -> DashboardSummary:
    business_id = current_user.business_id
    today = datetime.now(BOGOTA_TIMEZONE).date()

    query = select(
        select(func.count(Appointment.id))
        .where(
            Appointment.business_id == business_id,
            Appointment.appointment_date == today,
            Appointment.status != AppointmentStatus.CANCELADA.value,
        )
        .scalar_subquery(),
        select(func.count(Client.id))
        .where(Client.business_id == business_id)
        .scalar_subquery(),
        select(func.count(Service.id))
        .where(Service.business_id == business_id, Service.is_active.is_(True))
        .scalar_subquery(),
        select(func.count(Barber.id))
        .where(Barber.business_id == business_id, Barber.is_active.is_(True))
        .scalar_subquery(),
    )

    appointments_today, registered_clients, active_services, active_barbers = (
        db.execute(query).one()
    )

    return DashboardSummary(
        date=today,
        appointments_today=appointments_today,
        registered_clients=registered_clients,
        active_services=active_services,
        active_barbers=active_barbers,
    )
