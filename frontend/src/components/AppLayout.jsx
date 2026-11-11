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
  const roleLabel = user?.barber_id ? "Peluquero" : ROLE_LABELS[user?.role] || user?.role;

  return (
    <div className="app-shell">
      <aside className="app-sidebar">
        <div className="app-brand">Manchas AI</div>

        <nav className="app-nav" aria-label="Módulos de Manchas AI">
          {NAV_ITEMS.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.end}
              className="app-nav-link"
            >
              <span aria-hidden="true">{item.icon}</span>
              {item.label}
            </NavLink>
          ))}
        </nav>

        <div className="app-account">
          <div className="app-account-details">
            <p className="app-account-name">{user?.name}</p>
            <p className="app-account-role">{roleLabel}</p>
          </div>
          <button type="button" onClick={logout} className="btn btn-ghost app-logout">
            Cerrar sesión
          </button>
        </div>
      </aside>

      <main className="app-main">
        <Outlet />
      </main>
    </div>
  );
}
