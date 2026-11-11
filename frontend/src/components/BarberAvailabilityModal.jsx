import { useEffect, useState } from "react";
import {
  createBarberTimeOff,
  deleteBarberTimeOff,
  getBarberSchedule,
  listBarberTimeOff,
  updateBarberSchedule,
} from "../api/barbers";
import { extractErrorMessage } from "../api/client";
import Modal from "./Modal";

const WEEKDAYS = ["Lunes", "Martes", "Miércoles", "Jueves", "Viernes", "Sábado", "Domingo"];
const EMPTY_TIME_OFF = { start_date: "", end_date: "", reason: "" };
const FIELDSET_STYLE = { border: 0, margin: 0, padding: 0, minInlineSize: 0 };

function editableWeek(schedule) {
  return WEEKDAYS.map((_, weekday) => {
    const day = schedule.find((item) => item.weekday === weekday);
    return {
      weekday,
      is_working: day?.is_working ?? false,
      start_time: day?.start_time ?? "",
      end_time: day?.end_time ?? "",
    };
  });
}

function timeInSeconds(value) {
  const [hours, minutes, seconds = 0] = value.split(":").map(Number);
  return hours * 3600 + minutes * 60 + seconds;
}

function displayDate(value) {
  return value.split("-").reverse().join("/");
}

export default function BarberAvailabilityModal({ barber, canManage, onClose }) {
  const [days, setDays] = useState([]);
  const [timeOff, setTimeOff] = useState([]);
  const [timeOffForm, setTimeOffForm] = useState(EMPTY_TIME_OFF);
  const [loadVersion, setLoadVersion] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [pending, setPending] = useState("");
  const [scheduleMessage, setScheduleMessage] = useState(null);
  const [timeOffMessage, setTimeOffMessage] = useState(null);

  useEffect(() => {
    let ignore = false;
    Promise.all([getBarberSchedule(barber.id), listBarberTimeOff(barber.id)])
      .then(([schedule, periods]) => {
        if (ignore) return;
        setDays(editableWeek(schedule));
        setTimeOff(periods);
      })
      .catch((error) => {
        if (!ignore) {
          setLoadError(extractErrorMessage(error, "No pudimos cargar la disponibilidad."));
        }
      })
      .finally(() => {
        if (!ignore) setIsLoading(false);
      });

    return () => {
      ignore = true;
    };
  }, [barber.id, loadVersion]);

  function updateDay(weekday, changes) {
    setScheduleMessage(null);
    setDays((current) => current.map(
      (day) => day.weekday === weekday ? { ...day, ...changes } : day
    ));
  }

  async function saveSchedule(event) {
    event.preventDefault();
    const invalidDay = days.find((day) => day.is_working && (
      !day.start_time || !day.end_time ||
      timeInSeconds(day.end_time) <= timeInSeconds(day.start_time)
    ));

    if (invalidDay) {
      setScheduleMessage({
        error: true,
        text: `${WEEKDAYS[invalidDay.weekday]}: la salida debe ser posterior a la entrada.`,
      });
      return;
    }

    setScheduleMessage(null);
    setPending("schedule");

    try {
      const saved = await updateBarberSchedule(barber.id, days.map((day) => ({
        ...day,
        start_time: day.is_working ? day.start_time : null,
        end_time: day.is_working ? day.end_time : null,
      })));
      setDays(editableWeek(saved));
      setScheduleMessage({ text: "Horario semanal guardado." });
    } catch (error) {
      setScheduleMessage({
        error: true,
        text: extractErrorMessage(error, "No pudimos guardar el horario."),
      });
    } finally {
      setPending("");
    }
  }

  async function addTimeOff(event) {
    event.preventDefault();
    setTimeOffMessage(null);
    setPending("time-off");

    try {
      const period = await createBarberTimeOff(barber.id, {
        start_date: timeOffForm.start_date,
        end_date: timeOffForm.end_date || timeOffForm.start_date,
        reason: timeOffForm.reason.trim() || null,
      });
      setTimeOff((current) => [period, ...current].sort(
        (first, second) => second.start_date.localeCompare(first.start_date)
      ));
      setTimeOffForm(EMPTY_TIME_OFF);
      setTimeOffMessage({ text: "Días libres registrados." });
    } catch (error) {
      setTimeOffMessage({
        error: true,
        text: extractErrorMessage(error, "No pudimos registrar los días libres."),
      });
    } finally {
      setPending("");
    }
  }

  async function removeTimeOff(period) {
    setTimeOffMessage(null);
    setPending(period.id);

    try {
      await deleteBarberTimeOff(barber.id, period.id);
      setTimeOff((current) => current.filter((item) => item.id !== period.id));
      setTimeOffMessage({ text: "Días libres eliminados." });
    } catch (error) {
      setTimeOffMessage({
        error: true,
        text: extractErrorMessage(error, "No pudimos eliminar los días libres."),
      });
    } finally {
      setPending("");
    }
  }

  return (
    <Modal title={`Disponibilidad de ${barber.name}`} onClose={() => !pending && onClose()}>
      {isLoading && <p className="muted-text" role="status">Cargando disponibilidad…</p>}
      {loadError && (
        <>
          <p className="alert alert-error" role="alert">{loadError}</p>
          <button className="btn btn-ghost" onClick={() => {
            setLoadError("");
            setIsLoading(true);
            setLoadVersion((version) => version + 1);
          }}>
            Reintentar
          </button>
        </>
      )}
      {!isLoading && !loadError && (
        <>
          <h3>Horario semanal</h3>
          <p className="muted-text">
            Las citas nuevas y las reprogramaciones deben quedar dentro del horario de trabajo.
            Si cambias la disponibilidad, revisa las citas ya agendadas.
          </p>
          <form onSubmit={saveSchedule}>
            <fieldset style={FIELDSET_STYLE} disabled={!canManage || Boolean(pending)}>
              {days.map((day) => (
                <div className="field" key={day.weekday}>
                  <label className="checkbox-label">
                    <input
                      type="checkbox"
                      checked={day.is_working}
                      onChange={(event) => updateDay(day.weekday, { is_working: event.target.checked })}
                    />
                    {WEEKDAYS[day.weekday]}
                  </label>
                  {day.is_working && (
                    <div style={{ display: "flex", gap: 12 }}>
                      <label style={{ flex: 1 }}>
                        Entrada
                        <input
                          type="time"
                          step="any"
                          value={day.start_time}
                          aria-label={`Entrada del ${WEEKDAYS[day.weekday].toLowerCase()}`}
                          onChange={(event) => updateDay(day.weekday, { start_time: event.target.value })}
                          required
                        />
                      </label>
                      <label style={{ flex: 1 }}>
                        Salida
                        <input
                          type="time"
                          step="any"
                          value={day.end_time}
                          aria-label={`Salida del ${WEEKDAYS[day.weekday].toLowerCase()}`}
                          onChange={(event) => updateDay(day.weekday, { end_time: event.target.value })}
                          required
                        />
                      </label>
                    </div>
                  )}
                </div>
              ))}
              {canManage && (
                <button className="btn btn-primary" type="submit">
                  {pending === "schedule" ? "Guardando…" : "Guardar horario"}
                </button>
              )}
            </fieldset>
            <FormMessage message={scheduleMessage} />
          </form>

          <section style={{ marginTop: 24 }}>
            <h3>Días libres y vacaciones</h3>
            <p className="muted-text">Durante estas fechas no se pueden reservar citas nuevas.</p>
            {timeOff.length === 0 && <p className="muted-text">No hay días libres registrados.</p>}
            {timeOff.length > 0 && (
              <ul style={{ listStyle: "none", padding: 0 }}>
                {timeOff.map((period) => (
                  <li className="field action-buttons" key={period.id}>
                    <span style={{ flex: 1 }}>
                      {displayDate(period.start_date)}
                      {period.end_date !== period.start_date && ` al ${displayDate(period.end_date)}`}
                      {period.reason && <small style={{ display: "block" }}>{period.reason}</small>}
                    </span>
                    {canManage && (
                      <button
                        className="btn btn-ghost btn-small"
                        type="button"
                        disabled={Boolean(pending)}
                        onClick={() => removeTimeOff(period)}
                        aria-label={`Eliminar días libres desde el ${displayDate(period.start_date)}`}
                      >
                        {pending === period.id ? "Eliminando…" : "Eliminar"}
                      </button>
                    )}
                  </li>
                ))}
              </ul>
            )}
            {canManage && (
              <form onSubmit={addTimeOff}>
                <fieldset style={FIELDSET_STYLE} disabled={Boolean(pending)}>
                  <div className="field" style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
                    <label style={{ flex: 1 }}>
                      Desde
                      <input
                        type="date"
                        value={timeOffForm.start_date}
                        onChange={(event) => setTimeOffForm({ ...timeOffForm, start_date: event.target.value })}
                        required
                      />
                    </label>
                    <label style={{ flex: 1 }}>
                      Hasta (opcional)
                      <input
                        type="date"
                        min={timeOffForm.start_date || undefined}
                        value={timeOffForm.end_date}
                        onChange={(event) => setTimeOffForm({ ...timeOffForm, end_date: event.target.value })}
                      />
                    </label>
                  </div>
                  <div className="field">
                    <label htmlFor="time-off-reason">Motivo (opcional)</label>
                    <input
                      id="time-off-reason"
                      maxLength={255}
                      value={timeOffForm.reason}
                      onChange={(event) => setTimeOffForm({ ...timeOffForm, reason: event.target.value })}
                    />
                  </div>
                  <button className="btn btn-primary" type="submit">
                    {pending === "time-off" ? "Registrando…" : "Registrar días libres"}
                  </button>
                </fieldset>
              </form>
            )}
            <FormMessage message={timeOffMessage} />
          </section>
        </>
      )}
    </Modal>
  );
}

function FormMessage({ message }) {
  if (!message) return null;

  return (
    <p className={message.error ? "error-text" : "muted-text"} role={message.error ? "alert" : "status"}>
      {message.text}
    </p>
  );
}
