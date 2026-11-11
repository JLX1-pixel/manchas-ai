import { useEffect, useState } from "react";
import { getBarberAccess, saveBarberAccess } from "../api/barbers";
import { extractErrorMessage } from "../api/client";
import Modal from "./Modal";

export default function BarberAccessModal({ barber, onClose, onSaved }) {
  const [form, setForm] = useState(null);
  const [hasAccount, setHasAccount] = useState(false);
  const [error, setError] = useState("");
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    const controller = new AbortController();
    getBarberAccess(barber.id, controller.signal)
      .then((access) => {
        if (controller.signal.aborted) return;
        setHasAccount(Boolean(access));
        setForm({
          email: access?.email ?? "",
          can_manage_appointments: access?.can_manage_appointments ?? true,
          is_active: barber.is_active && (access?.is_active ?? true),
          password: "",
        });
      })
      .catch((err) => {
        if (!controller.signal.aborted) {
          setError(extractErrorMessage(err, "No pudimos consultar el acceso."));
        }
      });
    return () => controller.abort();
  }, [barber.id, barber.is_active]);

  function change(field, value) {
    setForm((previous) => ({ ...previous, [field]: value }));
  }

  async function handleSubmit(event) {
    event.preventDefault();
    if (!form || isSaving) return;
    setError("");
    setIsSaving(true);
    try {
      await saveBarberAccess(barber.id, { ...form, password: form.password || null });
      onSaved();
    } catch (err) {
      setError(extractErrorMessage(err, "No pudimos guardar el acceso."));
    } finally {
      setIsSaving(false);
    }
  }

  const close = () => { if (!isSaving) onClose(); };

  return (
    <Modal title={`Acceso de ${barber.name}`} onClose={close}>
      {!form && !error && <p role="status">Cargando acceso…</p>}
      {form && (
        <form onSubmit={handleSubmit}>
          <div className="field">
            <label htmlFor="barber-access-email">Correo para iniciar sesión</label>
            <input
              id="barber-access-email"
              type="email"
              value={form.email}
              onChange={(event) => change("email", event.target.value)}
              maxLength={255}
              disabled={isSaving}
              required
            />
          </div>
          <div className="field">
            <label htmlFor="barber-access-password">
              {hasAccount ? "Nueva contraseña (opcional)" : "Contraseña inicial"}
            </label>
            <input
              id="barber-access-password"
              type="password"
              autoComplete="new-password"
              value={form.password}
              onChange={(event) => change("password", event.target.value)}
              minLength={10}
              maxLength={128}
              disabled={isSaving}
              required={!hasAccount}
            />
          </div>
          <div className="field">
            <label htmlFor="barber-access-role">Permisos de citas</label>
            <select
              id="barber-access-role"
              value={String(form.can_manage_appointments)}
              onChange={(event) => change("can_manage_appointments", event.target.value === "true")}
              disabled={isSaving}
            >
              <option value="true">Gestionar citas del local</option>
              <option value="false">Solo consultar sus citas</option>
            </select>
          </div>
          {hasAccount && (
            <label className="checkbox-label">
              <input
                type="checkbox"
                checked={form.is_active}
                onChange={(event) => change("is_active", event.target.checked)}
                disabled={isSaving || !barber.is_active}
              />
              Permitir inicio de sesión
            </label>
          )}
          {!barber.is_active && <p className="muted-text">Reactiva al peluquero para habilitar su acceso.</p>}
          {!hasAccount && (
            <p className="muted-text">
              Comparte en privado el correo, la contraseña y el identificador que usas para entrar al negocio.
            </p>
          )}
          {error && <p className="error-text" role="alert">{error}</p>}
          <div className="modal-actions">
            <button type="button" className="btn btn-ghost" onClick={close} disabled={isSaving}>
              Cancelar
            </button>
            <button type="submit" className="btn btn-primary" disabled={isSaving}>
              {isSaving ? "Guardando…" : "Guardar acceso"}
            </button>
          </div>
        </form>
      )}
      {!form && error && <p className="error-text" role="alert">{error}</p>}
    </Modal>
  );
}
