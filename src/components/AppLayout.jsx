import { NavLink, Outlet } from "react-router-dom";
import { useAuth } from "../context/AuthContext";

const NAV_ITEMS = [
  { to: "/", label: "Panel", icon: "◆", end: true },
  { to: "/citas", label: "Agenda", icon: "▤" },
  { to: "/clientes", label: "Clientes", icon: "●" },
  { to: "/servicios", label: "Servicios", icon: "✂" },
  { to: "/peluqueros", label: "Peluqueros", icon: "★" },
];

const ROLE_LABELS = {
  SUPER_ADMIN: "Super admin",
  ADMIN: "Administrador",
  RECEPCIONISTA: "Recepcionista",
  PELUQUERO: "Peluquero",
};

export default function AppLayout() {
  const { user, logout } = useAuth();

  return (
    <div style={{ display: "flex", minHeight: "100vh" }}>
      <aside
        style={{
          width: 240,
          background: "var(--surface-sidebar)",
          color: "var(--text-on-dark)",
          padding: "24px 16px",
          display: "flex",
          flexDirection: "column",
        }}
      >
        <div style={{ padding: "0 8px", marginBottom: 32 }}>
          <span
            style={{
              fontFamily: "var(--font-display)",
              fontSize: 20,
              fontWeight: 700,
            }}
          >
            Manchas AI
          </span>
        </div>

        <nav style={{ display: "flex", flexDirection: "column", gap: 4 }}>
          {NAV_ITEMS.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.end}
              style={({ isActive }) => ({
                display: "flex",
                alignItems: "center",
                gap: 10,
                padding: "10px 12px",
                borderRadius: "var(--radius)",
                fontSize: 14,
                fontWeight: 500,
                textDecoration: "none",
                color: isActive
                  ? "var(--text-on-dark)"
                  : "var(--text-on-dark-muted)",
                background: isActive
                  ? "var(--surface-sidebar-hover)"
                  : "transparent",
              })}
            >
              <span aria-hidden="true">{item.icon}</span>
              {item.label}
            </NavLink>
          ))}
        </nav>

        <div style={{ marginTop: "auto", paddingTop: 24 }}>
          <div
            style={{
              borderTop: "1px solid var(--surface-sidebar-hover)",
              paddingTop: 16,
            }}
          >
            <p
              style={{
                margin: 0,
                fontSize: 14,
                fontWeight: 500,
                color: "var(--text-on-dark)",
              }}
            >
              {user?.name}
            </p>
            <p
              style={{
                margin: "2px 0 12px",
                fontSize: 12,
                color: "var(--text-on-dark-muted)",
              }}
            >
              {ROLE_LABELS[user?.role] || user?.role}
            </p>
            <button
              onClick={logout}
              className="btn btn-ghost"
              style={{
                width: "100%",
                borderColor: "var(--surface-sidebar-hover)",
                color: "var(--text-on-dark)",
              }}
            >
              Cerrar sesión
            </button>
          </div>
        </div>
      </aside>

      <main style={{ flex: 1, padding: "32px 40px" }}>
        <Outlet />
      </main>
    </div>
  );
}
