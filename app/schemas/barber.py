import uuid
from datetime import datetime

from pydantic import BaseModel, ConfigDict, Field


class BarberBase(BaseModel):
    name: str = Field(min_length=2, max_length=150)

    phone: str | None = Field(
        default=None,
        max_length=30,
    )

    specialty: str | None = Field(
        default=None,
        max_length=150,
    )


class BarberCreate(BarberBase):
    user_id: uuid.UUID | None = Field(
        default=None,
        description=(
            "Id del usuario si este peluquero va a poder iniciar "
            "sesión y ver su propia agenda."
        ),
    )


class BarberUpdate(BaseModel):
    name: str | None = Field(default=None, min_length=2, max_length=150)
    phone: str | None = Field(default=None, max_length=30)
    specialty: str | None = Field(default=None, max_length=150)
    user_id: uuid.UUID | None = None


class BarberOut(BarberBase):
    id: uuid.UUID
    business_id: uuid.UUID
    user_id: uuid.UUID | None
    is_active: bool
    created_at: datetime
    updated_at: datetime

    model_config = ConfigDict(
        from_attributes=True,
    )
