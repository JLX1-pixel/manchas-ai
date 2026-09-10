import { useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { extractErrorMessage } from "../api/client";

export default function LoginPage() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const [businessSlug, setBusinessSlug] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const redirectTo = location.state?.from?.pathname || "/";

  async function handleSubmit(event) {
    event.preventDefault();
    setError("");

    if (!email || !password) {
      setError("Escribe tu correo y tu contraseña.");
      return;
    }

    setIsSubmitting(true);

    try {
      await login({ businessSlug, email, password });
      navigate(redirectTo, { replace: true });
    } catch (err) {
      setError(
        extractErrorMessage(err, "No pudimos iniciar sesión. Intenta de nuevo.")
      );
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <div
      style={{
        minHeight: "100vh",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        background: "var(--surface-page)",
        padding: 16,
      }}
    >
      <div className="card" style={{ width: 380 }}>
        <div style={{ marginBottom: 28, textAlign: "center" }}>
          <h1 style={{ fontSize: 22, marginBottom: 6 }}>Manchas AI</h1>
          <p style={{ margin: 0, fontSize: 14, color: "var(--text-secondary)" }}>
            Inicia sesión para administrar tu negocio
          </p>
        </div>

        <form onSubmit={handleSubmit}>
          <div className="field">
            <label htmlFor="business-slug">Negocio (opcional)</label>
            <input
              id="business-slug"
              type="text"
              placeholder="mi-peluqueria"
              value={businessSlug}
              onChange={(e) => setBusinessSlug(e.target.value)}
              autoComplete="organization"
            />
          </div>

          <div className="field">
            <label htmlFor="email">Correo</label>
            <input
              id="email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              autoComplete="email"
              required
            />
          </div>

          <div className="field">
            <label htmlFor="password">Contraseña</label>
            <input
              id="password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete="current-password"
              required
            />
          </div>

          {error && <p className="error-text">{error}</p>}

          <button
            type="submit"
            className="btn btn-primary"
            style={{ width: "100%", marginTop: 8 }}
            disabled={isSubmitting}
          >
            {isSubmitting ? "Ingresando..." : "Iniciar sesión"}
          </button>
        </form>
      </div>
    </div>
  );
}
