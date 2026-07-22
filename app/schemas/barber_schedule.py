import uuid
from datetime import time

from pydantic import BaseModel, ConfigDict, Field, model_validator

WEEKDAY_NAMES = {
    0: "lunes",
    1: "martes",
    2: "miércoles",
    3: "jueves",
    4: "viernes",
    5: "sábado",
    6: "domingo",
}


class ScheduleDayIn(BaseModel):
    weekday: int = Field(
        ge=0,
        le=6,
        description="0 = lunes ... 6 = domingo",
    )

    is_working: bool = True

    start_time: time | None = None
    end_time: time | None = None

    @model_validator(mode="after")
    def check_times(self) -> "ScheduleDayIn":
        if self.is_working:
            if self.start_time is None or self.end_time is None:
                raise ValueError(
                    "Si el día se trabaja, se necesita hora de "
                    "entrada y de salida."
                )

            if self.end_time <= self.start_time:
                raise ValueError(
                    "La hora de salida debe ser posterior a la "
                    "hora de entrada."
                )
        else:
            self.start_time = None
            self.end_time = None

        return self


class WeeklyScheduleUpdate(BaseModel):
    days: list[ScheduleDayIn] = Field(min_length=1, max_length=7)

    @model_validator(mode="after")
    def check_unique_weekdays(self) -> "WeeklyScheduleUpdate":
        weekdays = [day.weekday for day in self.days]

        if len(weekdays) != len(set(weekdays)):
            raise ValueError(
                "No puedes enviar el mismo día de la semana más "
                "de una vez."
            )

        return self


class ScheduleDayOut(BaseModel):
    id: uuid.UUID
    weekday: int
    is_working: bool
    start_time: time | None
    end_time: time | None

    model_config = ConfigDict(
        from_attributes=True,
    )
