import { useAuth } from "../context/AuthContext";

export default function DashboardPage() {
  const { user } = useAuth();

  return (
    <div>
      <h1 style={{ fontSize: 24, marginBottom: 4 }}>
        Hola, {user?.name?.split(" ")[0]}
      </h1>
      <p style={{ color: "var(--text-secondary)", marginBottom: 32 }}>
        Este es el panel de tu negocio.
      </p>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))",
          gap: 16,
        }}
      >
        <div className="card">
          <p style={{ fontSize: 13, color: "var(--text-secondary)", margin: 0 }}>
            Citas de hoy
          </p>
          <p style={{ fontSize: 28, fontFamily: "var(--font-display)", margin: "8px 0 0" }}>
            —
          </p>
        </div>
        <div className="card">
          <p style={{ fontSize: 13, color: "var(--text-secondary)", margin: 0 }}>
            Clientes registrados
          </p>
          <p style={{ fontSize: 28, fontFamily: "var(--font-display)", margin: "8px 0 0" }}>
            —
          </p>
        </div>
        <div className="card">
          <p style={{ fontSize: 13, color: "var(--text-secondary)", margin: 0 }}>
            Peluqueros activos
          </p>
          <p style={{ fontSize: 28, fontFamily: "var(--font-display)", margin: "8px 0 0" }}>
            —
          </p>
        </div>
      </div>

      <p style={{ marginTop: 32, fontSize: 13, color: "var(--text-muted)" }}>
        Las cifras reales se conectan cuando construyamos las pantallas de
        Clientes, Servicios, Peluqueros y Citas.
      </p>
    </div>
  );
}
