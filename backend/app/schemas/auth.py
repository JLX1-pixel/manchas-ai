import uuid
from datetime import datetime
from typing import Annotated

from pydantic import BaseModel, ConfigDict, EmailStr, Field


NewPassword = Annotated[str, Field(min_length=10, max_length=128)]


class BusinessRegister(BaseModel):
    business_name: str = Field(
        min_length=2,
        max_length=150,
        examples=["Barbería Los Primos"],
    )

    business_slug: str = Field(
        min_length=2,
        max_length=150,
        pattern=r"^[a-z0-9]+(?:-[a-z0-9]+)*$",
        examples=["barberia-los-primos"],
    )

    business_email: EmailStr

    business_phone: str | None = Field(
        default=None,
        max_length=30,
    )

    business_address: str | None = Field(
        default=None,
        max_length=255,
    )

    business_city: str | None = Field(
        default=None,
        max_length=100,
    )

    business_country: str = Field(
        default="Colombia",
        min_length=2,
        max_length=100,
    )

    admin_name: str = Field(
        min_length=2,
        max_length=150,
    )

    admin_email: EmailStr

    admin_password: NewPassword = Field(
        description="Contraseña del administrador del negocio.",
    )


class AdminPasswordReset(BaseModel):
    business_slug: str = Field(min_length=2, max_length=150, pattern=r"^[a-z0-9]+(?:-[a-z0-9]+)*$")
    admin_email: EmailStr
    new_password: NewPassword = Field(repr=False)


class BusinessRegisterResponse(BaseModel):
    business_id: uuid.UUID
    business_name: str
    business_slug: str

    admin_id: uuid.UUID
    admin_name: str
    admin_email: EmailStr

    message: str
    created_at: datetime

    model_config = ConfigDict(
        from_attributes=True,
    )


class LoginRequest(BaseModel):
    business_slug: str | None = Field(
        default=None,
        description=(
            "Identificador del negocio. Se omite solo para el "
            "inicio de sesión de un SUPER_ADMIN."
        ),
        examples=["barberia-los-primos"],
    )

    email: EmailStr

    password: str = Field(
        min_length=1,
        max_length=128,
    )


class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    expires_in: int


class UserMe(BaseModel):
    id: uuid.UUID
    business_id: uuid.UUID | None
    barber_id: uuid.UUID | None = None
    name: str
    email: EmailStr
    role: str
    is_active: bool

    model_config = ConfigDict(
        from_attributes=True,
    )
