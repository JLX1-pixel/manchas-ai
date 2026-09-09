import uuid
from datetime import datetime
from decimal import Decimal

from pydantic import BaseModel, ConfigDict, Field


class ServiceBase(BaseModel):
    name: str = Field(min_length=2, max_length=150)

    description: str | None = Field(
        default=None,
        max_length=2000,
    )

    price: Decimal = Field(
        gt=0,
        max_digits=10,
        decimal_places=2,
        examples=["25000.00"],
    )

    duration_minutes: int = Field(
        gt=0,
        le=600,
        description="Duración estimada del servicio, en minutos.",
        examples=[30],
    )


class ServiceCreate(ServiceBase):
    pass


class ServiceUpdate(BaseModel):
    name: str | None = Field(default=None, min_length=2, max_length=150)
    description: str | None = Field(default=None, max_length=2000)
    price: Decimal | None = Field(
        default=None,
        gt=0,
        max_digits=10,
        decimal_places=2,
    )
    duration_minutes: int | None = Field(default=None, gt=0, le=600)


class ServiceOut(ServiceBase):
    id: uuid.UUID
    business_id: uuid.UUID
    is_active: bool
    created_at: datetime
    updated_at: datetime

    model_config = ConfigDict(
        from_attributes=True,
    )
