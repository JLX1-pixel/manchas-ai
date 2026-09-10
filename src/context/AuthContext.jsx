import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
} from "react";
import {
  fetchCurrentUser,
  login as loginRequest,
} from "../api/auth";
import { getStoredToken, setStoredToken } from "../api/client";

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [isLoading, setIsLoading] = useState(true);

  const loadCurrentUser = useCallback(async () => {
    const token = getStoredToken();

    if (!token) {
      setUser(null);
      setIsLoading(false);
      return;
    }

    try {
      const currentUser = await fetchCurrentUser();
      setUser(currentUser);
    } catch (error) {
      setStoredToken(null);
      setUser(null);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    loadCurrentUser();

    // Si otra pestaña o una respuesta 401 invalida la sesión,
    // reflejamos ese logout aquí también.
    const handleUnauthorized = () => setUser(null);
    window.addEventListener("manchas-ai:unauthorized", handleUnauthorized);

    return () => {
      window.removeEventListener(
        "manchas-ai:unauthorized",
        handleUnauthorized
      );
    };
  }, [loadCurrentUser]);

  const login = useCallback(async (credentials) => {
    const { access_token: accessToken } = await loginRequest(credentials);
    setStoredToken(accessToken);

    const currentUser = await fetchCurrentUser();
    setUser(currentUser);

    return currentUser;
  }, []);

  const logout = useCallback(() => {
    setStoredToken(null);
    setUser(null);
  }, []);

  const value = {
    user,
    isAuthenticated: Boolean(user),
    isLoading,
    login,
    logout,
  };

  return (
    <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);

  if (!context) {
    throw new Error("useAuth debe usarse dentro de un AuthProvider");
  }

  return context;
}
