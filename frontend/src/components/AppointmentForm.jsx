import { useEffect, useState } from "react";
import { createAppointment, getAppointmentAvailability, rescheduleAppointment } from "../api/appointments";
import { extractErrorMessage } from "../api/client";
import Modal from "./Modal";
import QuickClientFields from "./QuickClientFields";

function CatalogField({ name, label, records, value, onChange, disabled }) {
  return (
    <div className="field">
      <label htmlFor={name}>{label}</label>
      <select
        id={name}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        disabled={disabled}
        required
      >
        <option value="">Selecciona una opción</option>
        {records.map((record) => (
          <option key={record.id} value={record.id}>
            {record.name}
            {record.phone ? ` · ${record.phone}` : ""}
            {record.duration_minutes ? ` · ${record.duration_minutes} min` : ""}
          </option>
        ))}
      </select>
    </div>
  );
}

export default function AppointmentForm({
  appointment,
  date,
  barberId,
  catalogs,
  onClientCreated,
  onClose,
  onSaved,
}) {
  const clients = catalogs.clients.filter((client) => client.is_active);
  const barbers = catalogs.barbers.filter((barber) => barber.is_active);
  const services = catalogs.services.filter((service) => service.is_active);
  const selectedBarberId = appointment?.barber_id || barberId;
  const initial = {
    client_id: appointment?.client_id || "",
    barber_id: barbers.find(({ id }) => id === selectedBarberId)?.id || "",
    service_id: services.find(({ id }) => id === appointment?.service_id)?.id || "",
    appointment_date: appointment?.appointment_date || date,
    start_time: appointment?.start_time || "",
    notes: appointment?.notes || "",
  };
  const [form, setForm] = useState(initial);
  const [error, setError] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const [isCreatingClient, setIsCreatingClient] = useState(false);
  const [isSavingClient, setIsSavingClient] = useState(false);
  const [clientNotice, setClientNotice] = useState("");
  const [availability, setAvailability] = useState(null);
  const [availabilityVersion, setAvailabilityVersion] = useState(0);
  const [manualTime, setManualTime] = useState(false);
  const canQueryAvailability = Boolean(form.barber_id && form.service_id && form.appointment_date);
  const availabilityKey = `${form.barber_id}/${form.service_id}/${form.appointment_date}/${availabilityVersion}`;
  const currentAvailability = availability?.key === availabilityKey ? availability : null;
  const isLoadingAvailability = canQueryAvailability && !currentAvailability;

  useEffect(() => {
    if (!canQueryAvailability) return;
    const controller = new AbortController();
    getAppointmentAvailability({
      barberId: form.barber_id,
      serviceId: form.service_id,
      date: form.appointment_date,
      excludeId: appointment?.id,
      signal: controller.signal,
    })
      .then((slots) => {
        if (!controller.signal.aborted) setAvailability({ key: availabilityKey, slots });
      })
      .catch((err) => {
        if (!controller.signal.aborted) {
          setAvailability({
            key: availabilityKey,
            error: extractErrorMessage(err, "No pudimos consultar las horas disponibles."),
          });
        }
      });
    return () => controller.abort();
  }, [form.barber_id, form.service_id, form.appointment_date, appointment?.id, canQueryAvailability, availabilityKey]);

  function setField(field, value) {
    const changesSchedule = ["barber_id", "service_id", "appointment_date"].includes(field);
    if (changesSchedule) setManualTime(false);
    setError("");
    setForm((previous) => ({
      ...previous,
      [field]: value,
      ...(changesSchedule && previous[field] !== value ? { start_time: "" } : {}),
    }));
  }

  const changes = Object.fromEntries(
    Object.entries(form).filter(([field, value]) =>
      field !== "client_id" && value !== initial[field]
    )
  );
  const canSave = !appointment || Object.keys(changes).length > 0;

  async function handleSubmit(event) {
    event.preventDefault();
    if (isSaving || isCreatingClient || isSavingClient || !canSave || !form.start_time || !form.client_id) return;

    setIsSaving(true);
    setError("");
    try {
      let saved;
      if (appointment) {
        if ("notes" in changes) {
          changes.notes = changes.notes.trim() || null;
        }
        saved = await rescheduleAppointment(appointment.id, changes);
      } else {
        saved = await createAppointment({
          ...form,
          notes: form.notes.trim() || null,
        });
      }
      onSaved(saved);
    } catch (err) {
      setError(extractErrorMessage(err, "No pudimos guardar la cita."));
      if (err.response?.status === 409) {
        setAvailabilityVersion((version) => version + 1);
        setForm((previous) => ({ ...previous, start_time: "" }));
        setManualTime(false);
      }
    } finally {
      setIsSaving(false);
    }
  }

  const client = catalogs.clients.find(({ id }) => id === appointment?.client_id);
  const slots = currentAvailability?.slots || [];
  const keepOriginalTime = appointment && form.start_time === initial.start_time &&
    form.barber_id === initial.barber_id && form.service_id === initial.service_id &&
    form.appointment_date === initial.appointment_date &&
    !slots.some((slot) => slot.start_time === initial.start_time);

  return (
    <Modal
      title={appointment ? "Reprogramar cita" : "Nueva cita"}
      onClose={() => { if (!isSaving && !isSavingClient) onClose(); }}
    >
      <form onSubmit={handleSubmit}>
        {appointment ? (
          <p className="muted-text">Cliente: {client?.name || "No disponible"}</p>
        ) : (
          <>
            <CatalogField
              name="appointment-client"
              label="Cliente"
              records={clients}
              value={form.client_id}
              onChange={(value) => { setField("client_id", value); setClientNotice(""); }}
              disabled={isSaving || isCreatingClient}
            />
            {isCreatingClient ? (
              <QuickClientFields
                onSavingChange={setIsSavingClient}
                onCancel={() => setIsCreatingClient(false)}
                onCreated={(created) => {
                  onClientCreated(created);
                  setField("client_id", created.id);
                  setIsCreatingClient(false);
                  setClientNotice("Cliente registrado. Completa y guarda la cita.");
                }}
              />
            ) : (
              <div className="field">
                <button type="button" className="btn btn-ghost btn-small" disabled={isSaving} onClick={() => { setClientNotice(""); setIsCreatingClient(true); }}>
                  + Registrar cliente aquí
                </button>
                {clientNotice && <p className="muted-text" role="status">{clientNotice}</p>}
              </div>
            )}
          </>
        )}
        <CatalogField
          name="appointment-barber"
          label="Peluquero"
          records={barbers}
          value={form.barber_id}
          onChange={(value) => setField("barber_id", value)}
          disabled={isSaving}
        />
        <CatalogField
          name="appointment-service"
          label="Servicio"
          records={services}
          value={form.service_id}
          onChange={(value) => setField("service_id", value)}
          disabled={isSaving}
        />
        {appointment && (!initial.barber_id || !initial.service_id) && (
          <p className="muted-text">Selecciona un peluquero y un servicio activos para reprogramar.</p>
        )}
        <div className="field">
          <label htmlFor="appointment-date">Fecha</label>
          <input
            id="appointment-date"
            type="date"
            value={form.appointment_date}
            onChange={(event) => setField("appointment_date", event.target.value)}
            required
            disabled={isSaving}
          />
        </div>
        <div className="field">
          <label htmlFor="appointment-start">Hora de inicio</label>
          <select
            id="appointment-start"
            value={manualTime ? "manual" : form.start_time}
            onChange={(event) => {
              if (event.target.value === "manual") {
                setManualTime(true);
              } else {
                setManualTime(false);
                setField("start_time", event.target.value);
              }
            }}
            aria-describedby="appointment-closing"
            required
            disabled={isSaving || !canQueryAvailability || isLoadingAvailability}
          >
            <option value="">
              {isLoadingAvailability ? "Consultando horarios…" : "Selecciona una hora disponible"}
            </option>
            {keepOriginalTime && <option value={initial.start_time}>{initial.start_time.slice(0, 5)} · Hora actual</option>}
            {slots.map((slot) => (
              <option key={slot.start_time} value={slot.start_time}>
                {slot.start_time.slice(0, 5)} – {slot.end_time.slice(0, 5)}
              </option>
            ))}
            <option value="manual">Escribir otra hora</option>
          </select>
          {!canQueryAvailability && <p className="muted-text">Elige el peluquero, el servicio y la fecha para consultar horarios.</p>}
          {currentAvailability?.error && (
            <div role="alert">
              <p className="error-text">{currentAvailability.error}</p>
              <button type="button" className="btn btn-ghost btn-small" onClick={() => setAvailabilityVersion((version) => version + 1)} disabled={isSaving}>
                Volver a consultar
              </button>
            </div>
          )}
          {currentAvailability?.slots?.length === 0 && (
            <p className="muted-text" role="status">No hay horas disponibles para este servicio, peluquero y fecha.</p>
          )}
          {manualTime && (
            <div className="field" style={{ marginTop: 12 }}>
              <label htmlFor="appointment-manual-start">Hora exacta</label>
              <input
                id="appointment-manual-start"
                type="time"
                step="any"
                value={form.start_time}
                onChange={(event) => setField("start_time", event.target.value)}
                disabled={isSaving}
                required
              />
            </div>
          )}
          <p id="appointment-closing" className="muted-text">
            La cita debe terminar a más tardar a las 7:00 p. m.
          </p>
        </div>
        <div className="field">
          <label htmlFor="appointment-notes">Notas</label>
          <textarea
            id="appointment-notes"
            rows={3}
            maxLength={2000}
            value={form.notes}
            onChange={(event) => setField("notes", event.target.value)}
            disabled={isSaving}
          />
        </div>
        {appointment?.status === "CONFIRMADA" && (
          <p className="muted-text">Al reprogramar, la cita quedará pendiente de confirmación.</p>
        )}
        {error && <p className="error-text" role="alert">{error}</p>}
        <div className="modal-actions">
          <button className="btn btn-ghost" type="button" onClick={onClose} disabled={isSaving || isSavingClient}>
            Volver
          </button>
          <button className="btn btn-primary" disabled={isSaving || isCreatingClient || isSavingClient || !canSave || !form.start_time || !form.client_id}>
            {isSaving ? "Guardando..." : "Guardar cita"}
          </button>
        </div>
      </form>
    </Modal>
  );
}
