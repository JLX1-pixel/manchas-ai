import uuid
from datetime import datetime

from pydantic import BaseModel, ConfigDict, EmailStr, Field


class ClientBase(BaseModel):
    name: str = Field(min_length=2, max_length=150)

    phone: str | None = Field(
        default=None,
        max_length=30,
    )

    email: EmailStr | None = None

    notes: str | None = Field(
        default=None,
        max_length=2000,
    )

    is_frequent: bool = False


class ClientCreate(ClientBase):
    pass


class ClientUpdate(BaseModel):
    name: str | None = Field(default=None, min_length=2, max_length=150)
    phone: str | None = Field(default=None, max_length=30)
    email: EmailStr | None = None
    notes: str | None = Field(default=None, max_length=2000)
    is_frequent: bool | None = None


class ClientOut(ClientBase):
    id: uuid.UUID
    business_id: uuid.UUID
    is_active: bool
    created_at: datetime
    updated_at: datetime

    model_config = ConfigDict(
        from_attributes=True,
    )
