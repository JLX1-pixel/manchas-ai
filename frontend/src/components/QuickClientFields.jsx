import { useState } from "react";
import { createClient } from "../api/clients";
import { extractErrorMessage } from "../api/client";

export default function QuickClientFields({ onCreated, onCancel, onSavingChange }) {
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [error, setError] = useState("");
  const [isSaving, setIsSaving] = useState(false);

  async function saveClient() {
    if (isSaving) return;
    if (name.trim().length < 2) {
      setError("Escribe un nombre de al menos 2 caracteres.");
      return;
    }
    setError("");
    setIsSaving(true);
    onSavingChange(true);
    try {
      const client = await createClient({ name: name.trim(), phone: phone.trim() || null });
      onCreated(client);
    } catch (err) {
      setError(extractErrorMessage(err, "No pudimos registrar el cliente. Revisa los datos e inténtalo de nuevo."));
    } finally {
      setIsSaving(false);
      onSavingChange(false);
    }
  }

  return (
    <fieldset
      className="field"
      disabled={isSaving}
      style={{ border: "1px solid var(--border)", borderRadius: 8, padding: 12 }}
      onKeyDown={(event) => {
        if (event.key === "Enter" && event.target.tagName === "INPUT") {
          event.preventDefault();
          saveClient();
        }
      }}
    >
      <legend>Nuevo cliente</legend>
      <div className="field">
        <label htmlFor="quick-client-name">Nombre del cliente</label>
        <input id="quick-client-name" value={name} onChange={(event) => setName(event.target.value)} maxLength={150} autoComplete="name" />
      </div>
      <div className="field">
        <label htmlFor="quick-client-phone">Teléfono (opcional)</label>
        <input id="quick-client-phone" type="tel" value={phone} onChange={(event) => setPhone(event.target.value)} maxLength={30} autoComplete="tel" />
      </div>
      <p className="muted-text">El cliente se guardará aunque después cierres la cita.</p>
      {error && <p className="error-text" role="alert">{error}</p>}
      <div className="action-buttons">
        <button type="button" className="btn btn-ghost btn-small" onClick={onCancel}>Volver a clientes</button>
        <button type="button" className="btn btn-primary btn-small" onClick={saveClient}>
          {isSaving ? "Guardando cliente..." : "Guardar cliente"}
        </button>
      </div>
    </fieldset>
  );
}
