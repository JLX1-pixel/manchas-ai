from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import or_, select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.core.dependencies import get_current_user
from app.core.security import (
    create_access_token,
    hash_password,
    verify_password,
)
from app.core.config import settings
from app.database.session import get_db
from app.models.barber import Barber
from app.models.business import Business
from app.models.user import User, UserRole
from app.schemas.auth import (
    BusinessRegister,
    BusinessRegisterResponse,
    LoginRequest,
    TokenResponse,
    UserMe,
)


router = APIRouter(
    prefix="/auth",
    tags=["Autenticación"],
)


@router.post(
    "/register",
    response_model=BusinessRegisterResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Registrar negocio y administrador",
)
def register_business(
    registration: BusinessRegister,
    db: Session = Depends(get_db),
) -> BusinessRegisterResponse:
    business_slug = registration.business_slug.strip().lower()
    business_email = str(registration.business_email).strip().lower()
    admin_email = str(registration.admin_email).strip().lower()

    existing_business = db.scalar(
        select(Business).where(
            or_(
                Business.slug == business_slug,
                Business.email == business_email,
            )
        )
    )

    if existing_business:
        if existing_business.slug == business_slug:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail="El identificador del negocio ya está registrado.",
            )

        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="El correo del negocio ya está registrado.",
        )

    business = Business(
        name=registration.business_name.strip(),
        slug=business_slug,
        email=business_email,
        phone=registration.business_phone,
        address=registration.business_address,
        city=registration.business_city,
        country=registration.business_country.strip(),
    )

    try:
        db.add(business)
        db.flush()

        admin = User(
            business_id=business.id,
            name=registration.admin_name.strip(),
            email=admin_email,
            password_hash=hash_password(
                registration.admin_password
            ),
            role=UserRole.ADMIN.value,
            is_active=True,
        )

        db.add(admin)
        db.commit()

        db.refresh(business)
        db.refresh(admin)

    except IntegrityError as error:
        db.rollback()

        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=(
                "No fue posible completar el registro porque "
                "algunos datos ya están registrados."
            ),
        ) from error

    except Exception:
        db.rollback()
        raise

    return BusinessRegisterResponse(
        business_id=business.id,
        business_name=business.name,
        business_slug=business.slug,
        admin_id=admin.id,
        admin_name=admin.name,
        admin_email=admin.email,
        message="Negocio y administrador registrados correctamente.",
        created_at=business.created_at,
    )


@router.post(
    "/login",
    response_model=TokenResponse,
    summary="Iniciar sesión",
)
def login(
    credentials: LoginRequest,
    db: Session = Depends(get_db),
) -> TokenResponse:
    invalid_credentials = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Correo o contraseña incorrectos.",
    )

    email = str(credentials.email).strip().lower()

    query = select(User).where(User.email == email)

    if credentials.business_slug:
        business_slug = credentials.business_slug.strip().lower()

        business = db.scalar(
            select(Business).where(Business.slug == business_slug)
        )

        if business is None:
            raise invalid_credentials

        query = query.where(User.business_id == business.id)
    else:
        query = query.where(User.business_id.is_(None))

    user = db.scalar(query)

    if user is None or not user.is_active:
        raise invalid_credentials

    if not verify_password(credentials.password, user.password_hash):
        raise invalid_credentials

    access_token = create_access_token(
        user_id=user.id,
        business_id=user.business_id,
        role=user.role,
        token_version=user.token_version,
    )

    return TokenResponse(
        access_token=access_token,
        expires_in=settings.access_token_expire_minutes * 60,
    )


@router.get(
    "/me",
    response_model=UserMe,
    summary="Obtener el usuario autenticado",
)
def read_current_user(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> UserMe:
    user = UserMe.model_validate(current_user)
    if user.role in (UserRole.PELUQUERO.value, UserRole.RECEPCIONISTA.value):
        user.barber_id = db.scalar(select(Barber.id).where(
            Barber.user_id == user.id,
            Barber.business_id == user.business_id,
            Barber.is_active.is_(True),
        ))
    return user
