import { createContext, useContext, useState, useEffect, useCallback } from "react";
import api from "../api/client";

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  const saveToken = (token) => {
    localStorage.setItem("token", token);
    api.defaults.headers.common["Authorization"] = `Bearer ${token}`;
  };

  const clearToken = () => {
    localStorage.removeItem("token");
    delete api.defaults.headers.common["Authorization"];
  };

  const login = async (username, password) => {
    const res = await api.post("/api/auth/login", { username, password });
    const { token, usuario } = res.data;
    saveToken(token);
    setUser(usuario);
    return usuario;
  };

  const logout = useCallback(() => {
    clearToken();
    setUser(null);
  }, []);

  const hasRole = useCallback((rol) => {
    return user?.roles?.includes(rol) ?? false;
  }, [user]);

  useEffect(() => {
    const token = localStorage.getItem("token");
    if (!token) {
      setLoading(false);
      return;
    }
    api.defaults.headers.common["Authorization"] = `Bearer ${token}`;
    api
      .get("/api/auth/me")
      .then((res) => setUser(res.data))
      .catch(() => {
        clearToken();
      })
      .finally(() => setLoading(false));
  }, []);

  return (
    <AuthContext.Provider value={{ user, loading, login, logout, hasRole }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
