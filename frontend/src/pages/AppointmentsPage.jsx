import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import {
  changeAppointmentStatus,
  listAppointments,
  loadAppointmentCatalogs,
} from "../api/appointments";
import { extractErrorMessage } from "../api/client";
import AppointmentForm from "../components/AppointmentForm";
import Modal from "../components/Modal";
import { useAuth } from "../context/AuthContext";

const MANAGE_ROLES = ["ADMIN", "RECEPCIONISTA"];
const AGENDA_REFRESH_MS = 30_000;
const STATUSES = {
  PENDIENTE: { label: "Pendiente", className: "appointment-pending" },
  CONFIRMADA: { label: "Confirmada", className: "status-active" },
  COMPLETADA: { label: "Completada", className: "status-active" },
  CANCELADA: { label: "Cancelada", className: "status-inactive" },
  NO_ASISTIO: { label: "No asistió", className: "status-inactive" },
};

const ACTIONS = [
  { value: "confirm", label: "Confirmar", pendingOnly: true },
  { value: "complete", label: "Marcar como completada" },
  { value: "no-show", label: "Marcar que no asistió" },
  { value: "cancel", label: "Cancelar cita" },
];

function todayInColombia() {
  const parts = new Intl.DateTimeFormat("es-CO", {
    timeZone: "America/Bogota",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date());
  const getPart = (type) => parts.find((part) => part.type === type).value;
  return `${getPart("year")}-${getPart("month")}-${getPart("day")}`;
}

function AppointmentStatusForm({ appointment, clientName, onClose, onSaved }) {
  const [action, setAction] = useState("");
  const [error, setError] = useState("");
  const [isSaving, setIsSaving] = useState(false);

  async function handleSubmit(event) {
    event.preventDefault();
    if (!action || isSaving) return;

    setIsSaving(true);
    setError("");
    try {
      const saved = await changeAppointmentStatus(appointment.id, action);
      onSaved(saved);
    } catch (err) {
      setError(extractErrorMessage(err, "No pudimos cambiar el estado."));
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <Modal title="Cambiar estado" onClose={() => { if (!isSaving) onClose(); }}>
      <p className="muted-text">{clientName} · {appointment.start_time.slice(0, 5)}</p>
      <form onSubmit={handleSubmit}>
        <div className="field">
          <label htmlFor="appointment-action">Acción</label>
          <select
            id="appointment-action"
            value={action}
            onChange={(event) => setAction(event.target.value)}
            required
            disabled={isSaving}
          >
            <option value="">Selecciona una acción</option>
            {ACTIONS.filter((item) => !item.pendingOnly || appointment.status === "PENDIENTE")
              .map((item) => (
                <option key={item.value} value={item.value}>{item.label}</option>
              ))}
          </select>
        </div>
        {action === "cancel" && <p className="muted-text">Esta acción liberará el horario.</p>}
        {error && <p className="error-text" role="alert">{error}</p>}
        <div className="modal-actions">
          <button className="btn btn-ghost" type="button" onClick={onClose} disabled={isSaving}>
            Volver
          </button>
          <button className="btn btn-primary" disabled={!action || isSaving}>
            {isSaving ? "Guardando..." : "Aplicar cambio"}
          </button>
        </div>
      </form>
    </Modal>
  );
}

export default function AppointmentsPage() {
  const { user } = useAuth();
  const canManage = MANAGE_ROLES.includes(user?.role);
  const [date, setDate] = useState(todayInColombia);
  const [barberId, setBarberId] = useState(() => canManage ? user.barber_id ?? "" : "");
  const [catalogs, setCatalogs] = useState(null);
  const catalogsRef = useRef(null);
  const [catalogError, setCatalogError] = useState("");
  const [agenda, setAgenda] = useState(null);
  const [revision, setRevision] = useState(0);
  const [catalogRevision, setCatalogRevision] = useState(0);
  const [dialog, setDialog] = useState(null);
  const agendaKey = `${date}/${barberId}/${revision}`;

  useEffect(() => {
    const controller = new AbortController();
    loadAppointmentCatalogs(controller.signal)
      .then((data) => {
        if (!controller.signal.aborted) {
          catalogsRef.current = data;
          setCatalogs(data);
          setCatalogError("");
        }
      })
      .catch((err) => {
        if (!controller.signal.aborted) {
          setCatalogError(extractErrorMessage(err, "No pudimos cargar los datos de la agenda."));
        }
      });
    return () => controller.abort();
  }, [catalogRevision]);

  useEffect(() => {
    if (!date) return;
    const controller = new AbortController();
    let inFlight = false;

    function showRefreshError(message) {
      if (controller.signal.aborted) return;
      setAgenda((previous) => previous?.key === agendaKey && previous.items
        ? { ...previous, refreshError: message }
        : { key: agendaKey, error: message });
    }

    async function refresh() {
      if (document.hidden || inFlight || controller.signal.aborted) return;
      if (!navigator.onLine) {
        showRefreshError("Sin conexión. La agenda se actualizará cuando vuelvas a conectarte.");
        return;
      }
      inFlight = true;
      try {
        const items = await listAppointments({ date, barberId, signal: controller.signal });
        const known = catalogsRef.current;
        // Otra persona puede agendar para un cliente recién registrado.
        const hasUnknownRecord = known && items.some((item) =>
          [["clients", "client_id"], ["barbers", "barber_id"], ["services", "service_id"]]
            .some(([group, field]) => !known[group].some(({ id }) => id === item[field]))
        );
        if (hasUnknownRecord) {
          const data = await loadAppointmentCatalogs(controller.signal);
          if (controller.signal.aborted) return;
          catalogsRef.current = data;
          setCatalogs(data);
          setCatalogError("");
        }
        if (!controller.signal.aborted) {
          setAgenda({ key: agendaKey, items, updatedAt: new Date() });
        }
      } catch (err) {
        showRefreshError(extractErrorMessage(err, "No pudimos actualizar las citas. Volveremos a intentarlo automáticamente."));
      } finally {
        inFlight = false;
      }
    }

    function handleOffline() {
      showRefreshError("Sin conexión. La agenda se actualizará cuando vuelvas a conectarte.");
    }

    refresh();
    const interval = window.setInterval(refresh, AGENDA_REFRESH_MS);
    document.addEventListener("visibilitychange", refresh);
    window.addEventListener("focus", refresh);
    window.addEventListener("online", refresh);
    window.addEventListener("offline", handleOffline);
    return () => {
      controller.abort();
      window.clearInterval(interval);
      document.removeEventListener("visibilitychange", refresh);
      window.removeEventListener("focus", refresh);
      window.removeEventListener("online", refresh);
      window.removeEventListener("offline", handleOffline);
    };
  }, [date, barberId, agendaKey]);

  const currentAgenda = agenda?.key === agendaKey ? agenda : null;
  const error = currentAgenda?.error || catalogError;
  const loading = date && (!currentAgenda || !catalogs) && !error;
  const names = Object.fromEntries(
    ["clients", "barbers", "services"].map((group) => [
      group,
      new Map(catalogs?.[group].map(({ id, name }) => [id, name])),
    ])
  );
  const canBook = catalogs && ["clients", "barbers", "services"].every(
    (group) => catalogs[group].some((record) => record.is_active)
  );

  function handleSaved(saved) {
    setDialog(null);
    setDate(saved.appointment_date);
    setBarberId((filter) => filter && filter !== saved.barber_id ? "" : filter);
    setRevision((value) => value + 1);
  }

  function retry() {
    setRevision((value) => value + 1);
    if (catalogError) {
      setCatalogError("");
      setCatalogRevision((value) => value + 1);
    }
  }

  return (
    <section>
      <header className="page-header">
        <div>
          <h1>Agenda</h1>
          <p className="page-description">Consulta y gestiona las citas del día.</p>
        </div>
        {canManage && (
          <button
            className="btn btn-primary"
            onClick={() => setDialog({ type: "create" })}
            disabled={!canBook}
          >
            + Nueva cita
          </button>
        )}
      </header>

      {canManage && catalogs && !canBook && (
        <p className="muted-text">
          Para agendar, necesitas al menos un <Link to="/clientes">cliente</Link>, un{" "}
          <Link to="/servicios">servicio</Link> y un <Link to="/peluqueros">peluquero</Link> activos.
        </p>
      )}

      <div className="toolbar appointment-filters">
        <div>
          <label htmlFor="agenda-date">Fecha</label>
          <input
            id="agenda-date"
            type="date"
            value={date}
            onChange={(event) => setDate(event.target.value)}
          />
        </div>
        {canManage && (
          <div>
            <label htmlFor="agenda-barber">Peluquero</label>
            <select
              id="agenda-barber"
              value={barberId}
              onChange={(event) => setBarberId(event.target.value)}
              disabled={!catalogs}
            >
              <option value="">Todos los peluqueros</option>
              {catalogs?.barbers.map((barber) => (
                <option key={barber.id} value={barber.id}>
                  {barber.id === user.barber_id ? "Mi agenda" : barber.name}
                  {barber.is_active ? "" : " (inactivo)"}
                </option>
              ))}
            </select>
          </div>
        )}
        <button type="button" className="btn btn-ghost" onClick={retry} disabled={!date || loading}>
          Actualizar
        </button>
      </div>

      {currentAgenda?.updatedAt && (
        <p className="muted-text">
          Actualización automática cada 30 segundos mientras esta pantalla esté abierta.
          {" Última consulta "}
          <time dateTime={currentAgenda.updatedAt.toISOString()}>
            {currentAgenda.updatedAt.toLocaleTimeString("es-CO", { hour: "2-digit", minute: "2-digit", timeZone: "America/Bogota" })}
          </time>.
        </p>
      )}
      {currentAgenda?.refreshError && (
        <div className="alert alert-error" role="status">
          {currentAgenda.refreshError} Mostramos la última información recibida.
        </div>
      )}

      {error ? (
        <div className="alert alert-error" role="alert">
          <p>{error}</p>
          <button className="btn btn-ghost btn-small" onClick={retry}>Volver a cargar</button>
        </div>
      ) : loading ? (
        <p className="muted-text" role="status">Cargando agenda...</p>
      ) : !date ? (
        <p className="muted-text">Selecciona una fecha para consultar la agenda.</p>
      ) : (
        <div className="card table-container appointment-table" role="region" aria-label="Listado de citas" tabIndex={0}>
          <table role="table" aria-label="Citas del día">
            <thead role="rowgroup">
              <tr role="row">
                <th role="columnheader" scope="col">Hora</th>
                <th role="columnheader" scope="col">Cliente</th>
                <th role="columnheader" scope="col">Servicio</th>
                <th role="columnheader" scope="col">Peluquero</th>
                <th role="columnheader" scope="col">Estado</th>
                {canManage && <th role="columnheader" scope="col">Acciones</th>}
              </tr>
            </thead>
            <tbody role="rowgroup">
              {currentAgenda.items.length === 0 && (
                <tr role="row">
                  <td role="cell" className="empty-cell" colSpan={canManage ? 6 : 5}>
                    No hay citas para esta fecha y selección.
                  </td>
                </tr>
              )}
              {currentAgenda.items.map((appointment) => {
                const state = STATUSES[appointment.status];
                const isOpen = ["PENDIENTE", "CONFIRMADA"].includes(appointment.status);
                return (
                  <tr role="row" key={appointment.id}>
                    <td role="cell" className="appointment-hours">
                      {appointment.start_time.slice(0, 5)} – {appointment.end_time.slice(0, 5)}
                    </td>
                    <td role="cell" className="appointment-client">
                      <span className="appointment-mobile-label" aria-hidden="true">Cliente</span>
                      {names.clients.get(appointment.client_id) || "Cliente no disponible"}
                      {appointment.notes && (
                        <details className="appointment-notes">
                          <summary>Notas</summary>
                          {appointment.notes}
                        </details>
                      )}
                    </td>
                    <td role="cell">
                      <span className="appointment-mobile-label" aria-hidden="true">Servicio</span>
                      {names.services.get(appointment.service_id) || "Servicio no disponible"}
                    </td>
                    <td role="cell">
                      <span className="appointment-mobile-label" aria-hidden="true">Peluquero</span>
                      {names.barbers.get(appointment.barber_id) || "Peluquero no disponible"}
                    </td>
                    <td role="cell" className="appointment-status">
                      <span className={`status-badge ${state?.className || ""}`}>
                        {state?.label || appointment.status}
                      </span>
                    </td>
                    {canManage && (
                      <td role="cell" className="appointment-actions">
                        {isOpen && (
                          <div className="action-buttons">
                            <button className="btn btn-ghost btn-small" onClick={() => setDialog({ type: "edit", appointment })}>
                              Reprogramar
                            </button>
                            <button className="btn btn-ghost btn-small" onClick={() => setDialog({ type: "status", appointment })}>
                              Cambiar estado
                            </button>
                          </div>
                        )}
                      </td>
                    )}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {dialog?.type === "status" ? (
        <AppointmentStatusForm
          appointment={dialog.appointment}
          clientName={names.clients.get(dialog.appointment.client_id) || "Cliente no disponible"}
          onClose={() => setDialog(null)}
          onSaved={handleSaved}
        />
      ) : dialog && (
        <AppointmentForm
          appointment={dialog.appointment}
          date={date || todayInColombia()}
          barberId={barberId}
          catalogs={catalogs}
          onClose={() => setDialog(null)}
          onSaved={handleSaved}
        />
      )}
    </section>
  );
}
