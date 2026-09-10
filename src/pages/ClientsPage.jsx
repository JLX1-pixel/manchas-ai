import { useEffect, useState } from "react";
import {
  createClient,
  listClients,
  setClientActive,
  updateClient,
} from "../api/clients";
import { extractErrorMessage } from "../api/client";
import { useAuth } from "../context/AuthContext";
import Modal from "../components/Modal";

const CAN_MANAGE_ROLES = ["ADMIN", "RECEPCIONISTA"];

const EMPTY_FORM = {
  name: "",
  phone: "",
  email: "",
  notes: "",
  is_frequent: false,
};

export default function ClientsPage() {
  const { user } = useAuth();
  const canManage = CAN_MANAGE_ROLES.includes(user?.role);

  const [clients, setClients] = useState([]);
  const [search, setSearch] = useState("");
  const [showInactive, setShowInactive] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState("");

  const [editingClient, setEditingClient] = useState(null);
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [form, setForm] = useState(EMPTY_FORM);
  const [formError, setFormError] = useState("");
  const [isSaving, setIsSaving] = useState(false);

  async function loadClients() {
    setIsLoading(true);
    setLoadError("");

    try {
      const data = await listClients({
        search,
        includeInactive: showInactive,
      });
      setClients(data);
    } catch (err) {
      setLoadError(
        extractErrorMessage(err, "No pudimos cargar los clientes.")
      );
    } finally {
      setIsLoading(false);
    }
  }

  useEffect(() => {
    const timeout = setTimeout(loadClients, 300);
    return () => clearTimeout(timeout);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search, showInactive]);

  function openCreateForm() {
    setEditingClient(null);
    setForm(EMPTY_FORM);
    setFormError("");
    setIsFormOpen(true);
  }

  function openEditForm(client) {
    setEditingClient(client);
    setForm({
      name: client.name,
      phone: client.phone || "",
      email: client.email || "",
      notes: client.notes || "",
      is_frequent: client.is_frequent,
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

    const payload = {
      name: form.name.trim(),
      phone: form.phone.trim() || null,
      email: form.email.trim() || null,
      notes: form.notes.trim() || null,
      is_frequent: form.is_frequent,
    };

    setIsSaving(true);

    try {
      if (editingClient) {
        await updateClient(editingClient.id, payload);
      } else {
        await createClient(payload);
      }

      setIsFormOpen(false);
      await loadClients();
    } catch (err) {
      setFormError(
        extractErrorMessage(err, "No pudimos guardar el cliente.")
      );
    } finally {
      setIsSaving(false);
    }
  }

  async function handleToggleActive(client) {
    try {
      await setClientActive(client.id, !client.is_active);
      await loadClients();
    } catch (err) {
      setLoadError(
        extractErrorMessage(err, "No pudimos actualizar el cliente.")
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
          <h1 style={{ fontSize: 24, marginBottom: 4 }}>Clientes</h1>
          <p style={{ color: "var(--text-secondary)", margin: 0 }}>
            {clients.length} cliente{clients.length !== 1 ? "s" : ""}{" "}
            {showInactive ? "" : "activos"}
          </p>
        </div>

        {canManage && (
          <button className="btn btn-primary" onClick={openCreateForm}>
            + Nuevo cliente
          </button>
        )}
      </div>

      <div style={{ display: "flex", gap: 12, marginBottom: 20 }}>
        <input
          type="text"
          placeholder="Buscar por nombre, teléfono o correo..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          style={{ maxWidth: 320 }}
        />
        <label
          style={{
            display: "flex",
            alignItems: "center",
            gap: 6,
            fontSize: 13,
            color: "var(--text-secondary)",
            marginBottom: 0,
            whiteSpace: "nowrap",
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
      </div>

      {loadError && <p className="error-text">{loadError}</p>}

      <div className="card" style={{ padding: 0, overflow: "hidden" }}>
        <table style={{ width: "100%", borderCollapse: "collapse" }}>
          <thead>
            <tr style={{ background: "var(--surface-page)" }}>
              <Th>Nombre</Th>
              <Th>Teléfono</Th>
              <Th>Correo</Th>
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

            {!isLoading && clients.length === 0 && (
              <tr>
                <td
                  colSpan={5}
                  style={{ padding: 24, textAlign: "center", color: "var(--text-muted)" }}
                >
                  No hay clientes que coincidan con la búsqueda.
                </td>
              </tr>
            )}

            {!isLoading &&
              clients.map((client) => (
                <tr key={client.id} style={{ borderTop: "1px solid var(--border)" }}>
                  <Td>
                    {client.name}
                    {client.is_frequent && (
                      <span
                        style={{
                          marginLeft: 8,
                          fontSize: 11,
                          fontWeight: 500,
                          padding: "2px 8px",
                          borderRadius: 999,
                          background: "var(--brand-amber-light)",
                          color: "var(--brand-amber)",
                        }}
                      >
                        Frecuente
                      </span>
                    )}
                  </Td>
                  <Td>{client.phone || "—"}</Td>
                  <Td>{client.email || "—"}</Td>
                  <Td>
                    <span
                      style={{
                        fontSize: 12,
                        fontWeight: 500,
                        padding: "2px 8px",
                        borderRadius: 999,
                        background: client.is_active
                          ? "var(--brand-green-light)"
                          : "var(--brand-red-light)",
                        color: client.is_active
                          ? "var(--brand-green)"
                          : "var(--brand-red)",
                      }}
                    >
                      {client.is_active ? "Activo" : "Inactivo"}
                    </span>
                  </Td>
                  {canManage && (
                    <Td align="right">
                      <button
                        className="btn btn-ghost"
                        style={{ padding: "6px 10px", fontSize: 13 }}
                        onClick={() => openEditForm(client)}
                      >
                        Editar
                      </button>{" "}
                      <button
                        className="btn btn-ghost"
                        style={{ padding: "6px 10px", fontSize: 13 }}
                        onClick={() => handleToggleActive(client)}
                      >
                        {client.is_active ? "Desactivar" : "Reactivar"}
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
          title={editingClient ? "Editar cliente" : "Nuevo cliente"}
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
              <label htmlFor="phone">Teléfono</label>
              <input
                id="phone"
                type="tel"
                value={form.phone}
                onChange={(e) => setForm({ ...form, phone: e.target.value })}
              />
            </div>

            <div className="field">
              <label htmlFor="email">Correo</label>
              <input
                id="email"
                type="email"
                value={form.email}
                onChange={(e) => setForm({ ...form, email: e.target.value })}
              />
            </div>

            <div className="field">
              <label htmlFor="notes">Notas</label>
              <textarea
                id="notes"
                rows={3}
                value={form.notes}
                onChange={(e) => setForm({ ...form, notes: e.target.value })}
              />
            </div>

            <label
              style={{
                display: "flex",
                alignItems: "center",
                gap: 8,
                fontSize: 14,
                color: "var(--text-primary)",
                marginBottom: 20,
              }}
            >
              <input
                type="checkbox"
                checked={form.is_frequent}
                onChange={(e) =>
                  setForm({ ...form, is_frequent: e.target.checked })
                }
                style={{ width: "auto" }}
              />
              Cliente frecuente
            </label>

            {formError && <p className="error-text">{formError}</p>}

            <button
              type="submit"
              className="btn btn-primary"
              style={{ width: "100%" }}
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
