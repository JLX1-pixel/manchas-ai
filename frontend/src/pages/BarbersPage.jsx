import { useEffect, useState } from "react";

import {
  createBarber,
  listBarbers,
  setBarberActive,
  updateBarber,
} from "../api/barbers";

import { extractErrorMessage } from "../api/client";
import BarberAccessModal from "../components/BarberAccessModal";
import BarberAvailabilityModal from "../components/BarberAvailabilityModal";
import Modal from "../components/Modal";
import { useAuth } from "../context/AuthContext";


const CAN_MANAGE_ROLES = ["ADMIN"];

const EMPTY_FORM = {
  name: "",
  phone: "",
  specialty: "",
};


export default function BarbersPage() {
  const { user } = useAuth();

  const canManage = CAN_MANAGE_ROLES.includes(user?.role);

  const [barbers, setBarbers] = useState([]);
  const [showInactive, setShowInactive] = useState(false);
  const [reloadVersion, setReloadVersion] = useState(0);

  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [actionError, setActionError] = useState("");
  const [accessSaved, setAccessSaved] = useState(false);
  const [changingBarber, setChangingBarber] = useState(null);

  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingBarber, setEditingBarber] = useState(null);
  const [availabilityBarber, setAvailabilityBarber] = useState(null);
  const [accessBarber, setAccessBarber] = useState(null);
  const [form, setForm] = useState(EMPTY_FORM);

  const [formError, setFormError] = useState("");
  const [isSaving, setIsSaving] = useState(false);


  function reloadBarbers() {
    setIsLoading(true);
    setReloadVersion((version) => version + 1);
  }


  useEffect(() => {
    let ignore = false;
    setLoadError("");

    listBarbers({ includeInactive: showInactive })
      .then((data) => {
        if (!ignore) setBarbers(data);
      })
      .catch((error) => {
        if (!ignore) {
          setLoadError(extractErrorMessage(error, "No pudimos cargar los peluqueros."));
        }
      })
      .finally(() => {
        if (!ignore) setIsLoading(false);
      });

    return () => {
      ignore = true;
    };
  }, [showInactive, reloadVersion]);


  function openCreateForm() {
    setEditingBarber(null);
    setForm(EMPTY_FORM);
    setFormError("");
    setIsFormOpen(true);
  }


  function openEditForm(barber) {
    setEditingBarber(barber);

    setForm({
      name: barber.name,
      phone: barber.phone || "",
      specialty: barber.specialty || "",
    });

    setFormError("");
    setIsFormOpen(true);
  }


  function closeForm() {
    if (isSaving) {
      return;
    }

    setIsFormOpen(false);
    setEditingBarber(null);
    setForm(EMPTY_FORM);
    setFormError("");
  }


  async function handleSubmit(event) {
    event.preventDefault();
    setFormError("");

    const name = form.name.trim();
    const phone = form.phone.trim();
    const specialty = form.specialty.trim();

    if (name.length < 2) {
      setFormError("El nombre debe tener al menos dos caracteres.");
      return;
    }

    const payload = { name, phone: phone || null, specialty: specialty || null };
    setIsSaving(true);
    setActionError("");

    try {
      if (editingBarber) {
        await updateBarber(editingBarber.id, payload);
      } else {
        const barber = await createBarber(payload);
        setAvailabilityBarber(barber);
      }

      setIsFormOpen(false);
      reloadBarbers();
    } catch (error) {
      setFormError(extractErrorMessage(error, "No pudimos guardar el peluquero."));
    } finally {
      setIsSaving(false);
    }
  }

  async function handleToggleActive(barber) {
    setChangingBarber(barber.id);
    setActionError("");

    try {
      await setBarberActive(barber.id, !barber.is_active);
      reloadBarbers();
    } catch (error) {
      setActionError(extractErrorMessage(error, "No pudimos cambiar el estado del peluquero."));
    } finally {
      setChangingBarber(null);
    }
  }

  return (
    <div>
      <div className="page-header">
        <div>
          <h1>Peluqueros</h1>
          <p className="page-description">Consulta el equipo, sus horarios y sus días libres.</p>
        </div>
        {canManage && (
          <button className="btn btn-primary" onClick={openCreateForm}>
            + Nuevo peluquero
          </button>
        )}
      </div>

      <div className="toolbar">
        <label className="checkbox-label">
          <input
            type="checkbox"
            checked={showInactive}
            onChange={(event) => {
              setIsLoading(true);
              setShowInactive(event.target.checked);
            }}
          />
          Mostrar inactivos
        </label>
      </div>

      {(loadError || actionError) && (
        <p className="alert alert-error" role="alert">{loadError || actionError}</p>
      )}
      {accessSaved && <p className="muted-text" role="status">Acceso guardado.</p>}
      {loadError && (
        <button className="btn btn-ghost" onClick={reloadBarbers}>Reintentar</button>
      )}

      <div className="card table-container" role="region" aria-label="Listado de peluqueros" tabIndex={0}>
        <table>
          <thead>
            <tr>
              <th scope="col">Nombre</th>
              <th scope="col">Teléfono</th>
              <th scope="col">Especialidad</th>
              <th scope="col">Estado</th>
              <th scope="col">Acciones</th>
            </tr>
          </thead>
          <tbody>
            {isLoading && (
              <tr><td className="empty-cell" colSpan={5}>Cargando peluqueros…</td></tr>
            )}
            {!isLoading && !loadError && barbers.length === 0 && (
              <tr><td className="empty-cell" colSpan={5}>No hay peluqueros para mostrar.</td></tr>
            )}
            {!isLoading && !loadError && barbers.map((barber) => (
              <tr key={barber.id}>
                <td>{barber.name}</td>
                <td>{barber.phone || "—"}</td>
                <td>{barber.specialty || "—"}</td>
                <td>
                  <span className={`status-badge ${barber.is_active ? "status-active" : "status-inactive"}`}>
                    {barber.is_active ? "Activo" : "Inactivo"}
                  </span>
                </td>
                <td>
                  <div className="action-buttons">
                    <button
                      className="btn btn-ghost btn-small"
                      onClick={() => setAvailabilityBarber(barber)}
                    >
                      Disponibilidad
                    </button>
                    {canManage && (
                      <>
                        {(barber.is_active || barber.user_id) && (
                          <button
                            className="btn btn-ghost btn-small"
                            onClick={() => {
                              setAccessSaved(false);
                              setAccessBarber(barber);
                            }}
                          >
                            {barber.user_id ? "Gestionar acceso" : "Dar acceso"}
                          </button>
                        )}
                        <button
                          className="btn btn-ghost btn-small"
                          onClick={() => openEditForm(barber)}
                        >
                          Editar
                        </button>
                        <button
                          className="btn btn-ghost btn-small"
                          onClick={() => handleToggleActive(barber)}
                          disabled={changingBarber !== null}
                        >
                          {changingBarber === barber.id
                            ? "Actualizando…"
                            : barber.is_active ? "Desactivar" : "Reactivar"}
                        </button>
                      </>
                    )}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {isFormOpen && (
        <Modal title={editingBarber ? "Editar peluquero" : "Nuevo peluquero"} onClose={closeForm}>
          <form onSubmit={handleSubmit}>
            <div className="field">
              <label htmlFor="barber-name">Nombre</label>
              <input
                id="barber-name"
                value={form.name}
                onChange={(event) => setForm({ ...form, name: event.target.value })}
                minLength={2}
                maxLength={150}
                disabled={isSaving}
                required
              />
            </div>
            <div className="field">
              <label htmlFor="barber-phone">Teléfono</label>
              <input
                id="barber-phone"
                type="tel"
                value={form.phone}
                onChange={(event) => setForm({ ...form, phone: event.target.value })}
                maxLength={30}
                disabled={isSaving}
              />
            </div>
            <div className="field">
              <label htmlFor="barber-specialty">Especialidad</label>
              <input
                id="barber-specialty"
                value={form.specialty}
                onChange={(event) => setForm({ ...form, specialty: event.target.value })}
                maxLength={150}
                disabled={isSaving}
              />
            </div>

            {formError && <p className="error-text" role="alert">{formError}</p>}
            <div className="modal-actions">
              <button type="button" className="btn btn-ghost" onClick={closeForm} disabled={isSaving}>
                Cancelar
              </button>
              <button type="submit" className="btn btn-primary" disabled={isSaving}>
                {isSaving ? "Guardando…" : "Guardar"}
              </button>
            </div>
          </form>
        </Modal>
      )}

      {availabilityBarber && (
        <BarberAvailabilityModal
          key={availabilityBarber.id}
          barber={availabilityBarber}
          canManage={canManage}
          onClose={() => setAvailabilityBarber(null)}
        />
      )}
      {accessBarber && (
        <BarberAccessModal
          barber={accessBarber}
          onClose={() => setAccessBarber(null)}
          onSaved={() => {
            setAccessBarber(null);
            setAccessSaved(true);
            reloadBarbers();
          }}
        />
      )}
    </div>
  );
}
