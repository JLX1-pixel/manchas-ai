from datetime import date

from pydantic import BaseModel


class DashboardSummary(BaseModel):
    date: date
    appointments_today: int
    registered_clients: int
    active_services: int
    active_barbers: int
