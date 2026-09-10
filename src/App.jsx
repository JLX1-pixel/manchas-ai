import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import { AuthProvider } from "./context/AuthContext";
import ProtectedRoute from "./components/ProtectedRoute";
import AppLayout from "./components/AppLayout";
import LoginPage from "./pages/LoginPage";
import DashboardPage from "./pages/DashboardPage";
import ClientsPage from "./pages/ClientsPage";
import ServicesPage from "./pages/ServicesPage";
import ComingSoonPage from "./pages/ComingSoonPage";

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <Routes>
          <Route path="/login" element={<LoginPage />} />

          <Route element={<ProtectedRoute />}>
            <Route element={<AppLayout />}>
              <Route path="/" element={<DashboardPage />} />
              <Route path="/clientes" element={<ClientsPage />} />
              <Route path="/servicios" element={<ServicesPage />} />
              <Route
                path="/peluqueros"
                element={<ComingSoonPage title="Peluqueros" />}
              />
              <Route
                path="/citas"
                element={<ComingSoonPage title="Agenda" />}
              />
            </Route>
          </Route>

          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </AuthProvider>
    </BrowserRouter>
  );
}
