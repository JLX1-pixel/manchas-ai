import uuid
from datetime import date, datetime

from pydantic import BaseModel, ConfigDict, Field, model_validator


class TimeOffCreate(BaseModel):
    start_date: date
    end_date: date
    reason: str | None = Field(default=None, max_length=255)

    @model_validator(mode="after")
    def check_dates(self) -> "TimeOffCreate":
        if self.end_date < self.start_date:
            raise ValueError(
                "La fecha final no puede ser anterior a la fecha inicial."
            )

        return self


class TimeOffOut(BaseModel):
    id: uuid.UUID
    barber_id: uuid.UUID
    start_date: date
    end_date: date
    reason: str | None
    created_at: datetime

    model_config = ConfigDict(
        from_attributes=True,
    )
