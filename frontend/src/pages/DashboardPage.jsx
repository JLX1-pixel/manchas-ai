import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { extractErrorMessage } from "../api/client";
import { getDashboardSummary } from "../api/dashboard";
import { useAuth } from "../context/AuthContext";

const SUMMARY_ROLES = ["ADMIN", "RECEPCIONISTA"];
const METRICS = [
  { field: "appointments_today", label: "Citas de hoy", to: "/citas", action: "Ver agenda" },
  { field: "registered_clients", label: "Clientes registrados", to: "/clientes", action: "Ver clientes" },
  { field: "active_services", label: "Servicios activos", to: "/servicios", action: "Ver servicios" },
  { field: "active_barbers", label: "Peluqueros activos", to: "/peluqueros", action: "Ver peluqueros" },
];
const numberFormat = new Intl.NumberFormat("es-CO");
const dateFormat = new Intl.DateTimeFormat("es-CO", {
  dateStyle: "full",
  timeZone: "UTC",
});

function DashboardSummary() {
  const [summary, setSummary] = useState(null);
  const [error, setError] = useState("");
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    const controller = new AbortController();
    getDashboardSummary(controller.signal)
      .then((data) => {
        if (!controller.signal.aborted) setSummary(data);
      })
      .catch((err) => {
        if (!controller.signal.aborted) {
          setError(extractErrorMessage(err, "No pudimos cargar el resumen del negocio."));
        }
      });
    return () => controller.abort();
  }, [attempt]);

  if (error) {
    return (
      <div className="alert alert-error" role="alert">
        <p>{error}</p>
        <button
          className="btn btn-ghost btn-small"
          onClick={() => {
            setError("");
            setAttempt((value) => value + 1);
          }}
        >
          Volver a cargar
        </button>
      </div>
    );
  }

  if (!summary) {
    return <p className="muted-text" role="status">Cargando resumen del negocio...</p>;
  }

  return (
    <section aria-label="Resumen del negocio">
      <p className="muted-text">
        <time dateTime={summary.date}>{dateFormat.format(new Date(summary.date))}</time>
      </p>
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 180px), 1fr))",
          gap: 16,
        }}
      >
        {METRICS.map(({ field, label, to, action }) => (
          <article className="card" key={field}>
            <h2 style={{ fontSize: 15 }}>{label}</h2>
            <p style={{ fontSize: 28, fontFamily: "var(--font-display)", margin: "8px 0 16px" }}>
              {numberFormat.format(summary[field])}
            </p>
            <Link to={to} style={{ color: "var(--brand-wine)", fontSize: 14 }}>
              {action}
            </Link>
          </article>
        ))}
      </div>
    </section>
  );
}

export default function DashboardPage() {
  const { user } = useAuth();
  const canViewSummary = user?.business_id && SUMMARY_ROLES.includes(user.role);

  return (
    <div>
      <header className="page-header">
        <div>
          <h1>Hola, {user?.name?.split(" ")[0]}</h1>
          <p className="page-description">Este es tu panel de Manchas AI.</p>
        </div>
      </header>
      {canViewSummary ? (
        <DashboardSummary key={user.id} />
      ) : user?.role === "PELUQUERO" && user.business_id ? (
        <div className="card">
          <h2>Mi agenda</h2>
          <p className="page-description">Consulta las citas que tienes asignadas.</p>
          <p><Link to="/citas">Ver mi agenda</Link></p>
        </div>
      ) : (
        <p className="muted-text">El resumen está disponible para administradores y recepcionistas de un negocio.</p>
      )}
    </div>
  );
}
