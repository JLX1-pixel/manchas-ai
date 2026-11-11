import { useState } from "react";
import { createAppointment, rescheduleAppointment } from "../api/appointments";
import { extractErrorMessage } from "../api/client";
import Modal from "./Modal";

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
    start_time: appointment?.start_time.slice(0, 5) || "",
    notes: appointment?.notes || "",
  };
  const [form, setForm] = useState(initial);
  const [error, setError] = useState("");
  const [isSaving, setIsSaving] = useState(false);

  function setField(field, value) {
    setForm((previous) => ({ ...previous, [field]: value }));
  }

  const changes = Object.fromEntries(
    Object.entries(form).filter(([field, value]) =>
      field !== "client_id" && value !== initial[field]
    )
  );
  const canSave = !appointment || Object.keys(changes).length > 0;

  async function handleSubmit(event) {
    event.preventDefault();
    if (isSaving || !canSave) return;

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
    } finally {
      setIsSaving(false);
    }
  }

  const client = catalogs.clients.find(({ id }) => id === appointment?.client_id);

  return (
    <Modal
      title={appointment ? "Reprogramar cita" : "Nueva cita"}
      onClose={() => { if (!isSaving) onClose(); }}
    >
      <form onSubmit={handleSubmit}>
        {appointment ? (
          <p className="muted-text">Cliente: {client?.name || "No disponible"}</p>
        ) : (
          <CatalogField
            name="appointment-client"
            label="Cliente"
            records={clients}
            value={form.client_id}
            onChange={(value) => setField("client_id", value)}
            disabled={isSaving}
          />
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
          <input
            id="appointment-start"
            type="time"
            value={form.start_time}
            onChange={(event) => setField("start_time", event.target.value)}
            aria-describedby="appointment-closing"
            required
            disabled={isSaving}
          />
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
          <button className="btn btn-ghost" type="button" onClick={onClose} disabled={isSaving}>
            Volver
          </button>
          <button className="btn btn-primary" disabled={isSaving || !canSave}>
            {isSaving ? "Guardando..." : "Guardar cita"}
          </button>
        </div>
      </form>
    </Modal>
  );
}
