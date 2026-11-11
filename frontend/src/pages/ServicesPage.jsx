import { useEffect, useState } from "react";
import {
  createService,
  listServices,
  setServiceActive,
  updateService,
} from "../api/services";
import { extractErrorMessage } from "../api/client";
import { useAuth } from "../context/AuthContext";
import Modal from "../components/Modal";

const CAN_MANAGE_ROLES = ["ADMIN"];

const EMPTY_FORM = {
  name: "",
  description: "",
  price: "",
  duration_minutes: "",
};

function formatPrice(value) {
  const number = Number(value);

  if (Number.isNaN(number)) {
    return value;
  }

  return number.toLocaleString("es-CO", {
    style: "currency",
    currency: "COP",
    maximumFractionDigits: 0,
  });
}

export default function ServicesPage() {
  const { user } = useAuth();
  const canManage = CAN_MANAGE_ROLES.includes(user?.role);

  const [services, setServices] = useState([]);
  const [showInactive, setShowInactive] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState("");

  const [editingService, setEditingService] = useState(null);
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [form, setForm] = useState(EMPTY_FORM);
  const [formError, setFormError] = useState("");
  const [isSaving, setIsSaving] = useState(false);

  async function loadServices() {
    setIsLoading(true);
    setLoadError("");

    try {
      const data = await listServices({ includeInactive: showInactive });
      setServices(data);
    } catch (err) {
      setLoadError(
        extractErrorMessage(err, "No pudimos cargar los servicios.")
      );
    } finally {
      setIsLoading(false);
    }
  }

  useEffect(() => {
    loadServices();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [showInactive]);

  function openCreateForm() {
    setEditingService(null);
    setForm(EMPTY_FORM);
    setFormError("");
    setIsFormOpen(true);
  }

  function openEditForm(service) {
    setEditingService(service);
    setForm({
      name: service.name,
      description: service.description || "",
      price: String(service.price),
      duration_minutes: String(service.duration_minutes),
    });
    setFormError("");
    setIsFormOpen(true);
  }

  async function handleSubmit(event) {
    event.preventDefault();
    setFormError("");

    if (!form.name.trim()) {
      setFormError("El nombre es obligatorio.");
      return;
    }

    const price = Number(form.price);
    const duration = Number(form.duration_minutes);

    if (!price || price <= 0) {
      setFormError("El precio debe ser un número mayor a cero.");
      return;
    }

    if (!duration || duration <= 0) {
      setFormError("La duración debe ser mayor a cero minutos.");
      return;
    }

    const payload = {
      name: form.name.trim(),
      description: form.description.trim() || null,
      price,
      duration_minutes: duration,
    };

    setIsSaving(true);

    try {
      if (editingService) {
        await updateService(editingService.id, payload);
      } else {
        await createService(payload);
      }

      setIsFormOpen(false);
      await loadServices();
    } catch (err) {
      setFormError(
        extractErrorMessage(err, "No pudimos guardar el servicio.")
      );
    } finally {
      setIsSaving(false);
    }
  }

  async function handleToggleActive(service) {
    try {
      await setServiceActive(service.id, !service.is_active);
      await loadServices();
    } catch (err) {
      setLoadError(
        extractErrorMessage(err, "No pudimos actualizar el servicio.")
      );
    }
  }

  return (
    <div>
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "flex-start",
          marginBottom: 24,
        }}
      >
        <div>
          <h1 style={{ fontSize: 24, marginBottom: 4 }}>Servicios</h1>
          <p style={{ color: "var(--text-secondary)", margin: 0 }}>
            {services.length} servicio{services.length !== 1 ? "s" : ""}{" "}
            {showInactive ? "" : "activos"}
          </p>
        </div>

        {canManage && (
          <button className="btn btn-primary" onClick={openCreateForm}>
            + Nuevo servicio
          </button>
        )}
      </div>

      <label
        style={{
          display: "flex",
          alignItems: "center",
          gap: 6,
          fontSize: 13,
          color: "var(--text-secondary)",
          marginBottom: 20,
          width: "fit-content",
        }}
      >
        <input
          type="checkbox"
          checked={showInactive}
          onChange={(e) => setShowInactive(e.target.checked)}
          style={{ width: "auto" }}
        />
        Mostrar inactivos
      </label>

      {loadError && <p className="error-text">{loadError}</p>}

      <div className="card table-container" role="region" aria-label="Listado de servicios" tabIndex={0}>
        <table style={{ width: "100%", borderCollapse: "collapse" }}>
          <thead>
            <tr style={{ background: "var(--surface-page)" }}>
              <Th>Nombre</Th>
              <Th>Precio</Th>
              <Th>Duración</Th>
              <Th>Estado</Th>
              {canManage && <Th align="right">Acciones</Th>}
            </tr>
          </thead>
          <tbody>
            {isLoading && (
              <tr>
                <td
                  colSpan={5}
                  style={{ padding: 24, textAlign: "center", color: "var(--text-muted)" }}
                >
                  Cargando...
                </td>
              </tr>
            )}

            {!isLoading && services.length === 0 && (
              <tr>
                <td
                  colSpan={5}
                  style={{ padding: 24, textAlign: "center", color: "var(--text-muted)" }}
                >
                  Todavía no hay servicios registrados.
                </td>
              </tr>
            )}

            {!isLoading &&
              services.map((service) => (
                <tr key={service.id} style={{ borderTop: "1px solid var(--border)" }}>
                  <Td>
                    <div>{service.name}</div>
                    {service.description && (
                      <div
                        style={{
                          fontSize: 12,
                          color: "var(--text-muted)",
                          marginTop: 2,
                        }}
                      >
                        {service.description}
                      </div>
                    )}
                  </Td>
                  <Td>{formatPrice(service.price)}</Td>
                  <Td>{service.duration_minutes} min</Td>
                  <Td>
                    <span
                      style={{
                        fontSize: 12,
                        fontWeight: 500,
                        padding: "2px 8px",
                        borderRadius: 999,
                        background: service.is_active
                          ? "var(--brand-green-light)"
                          : "var(--brand-red-light)",
                        color: service.is_active
                          ? "var(--brand-green)"
                          : "var(--brand-red)",
                      }}
                    >
                      {service.is_active ? "Activo" : "Inactivo"}
                    </span>
                  </Td>
                  {canManage && (
                    <Td align="right">
                      <button
                        className="btn btn-ghost"
                        style={{ padding: "6px 10px", fontSize: 13 }}
                        onClick={() => openEditForm(service)}
                      >
                        Editar
                      </button>{" "}
                      <button
                        className="btn btn-ghost"
                        style={{ padding: "6px 10px", fontSize: 13 }}
                        onClick={() => handleToggleActive(service)}
                      >
                        {service.is_active ? "Desactivar" : "Reactivar"}
                      </button>
                    </Td>
                  )}
                </tr>
              ))}
          </tbody>
        </table>
      </div>

      {isFormOpen && (
        <Modal
          title={editingService ? "Editar servicio" : "Nuevo servicio"}
          onClose={() => setIsFormOpen(false)}
        >
          <form onSubmit={handleSubmit}>
            <div className="field">
              <label htmlFor="name">Nombre</label>
              <input
                id="name"
                type="text"
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                required
              />
            </div>

            <div className="field">
              <label htmlFor="description">Descripción</label>
              <textarea
                id="description"
                rows={2}
                value={form.description}
                onChange={(e) =>
                  setForm({ ...form, description: e.target.value })
                }
              />
            </div>

            <div style={{ display: "flex", gap: 12 }}>
              <div className="field" style={{ flex: 1 }}>
                <label htmlFor="price">Precio</label>
                <input
                  id="price"
                  type="number"
                  min="0"
                  step="100"
                  value={form.price}
                  onChange={(e) =>
                    setForm({ ...form, price: e.target.value })
                  }
                  required
                />
              </div>

              <div className="field" style={{ flex: 1 }}>
                <label htmlFor="duration">Duración (min)</label>
                <input
                  id="duration"
                  type="number"
                  min="1"
                  max="600"
                  value={form.duration_minutes}
                  onChange={(e) =>
                    setForm({ ...form, duration_minutes: e.target.value })
                  }
                  required
                />
              </div>
            </div>

            {formError && <p className="error-text">{formError}</p>}

            <button
              type="submit"
              className="btn btn-primary"
              style={{ width: "100%", marginTop: 4 }}
              disabled={isSaving}
            >
              {isSaving ? "Guardando..." : "Guardar"}
            </button>
          </form>
        </Modal>
      )}
    </div>
  );
}

function Th({ children, align = "left" }) {
  return (
    <th
      style={{
        textAlign: align,
        padding: "12px 16px",
        fontSize: 12,
        fontWeight: 500,
        color: "var(--text-secondary)",
        textTransform: "uppercase",
        letterSpacing: "0.03em",
      }}
    >
      {children}
    </th>
  );
}

function Td({ children, align = "left" }) {
  return (
    <td style={{ textAlign: align, padding: "12px 16px", fontSize: 14 }}>
      {children}
    </td>
  );
}
