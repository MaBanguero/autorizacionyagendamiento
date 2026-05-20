import { Navigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";

export default function ProtectedRoute({ children, roles }) {
  const { user, loading, hasRole } = useAuth();

  if (loading) {
    return <div className="loading-screen">Cargando...</div>;
  }

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  // Si se especificaron roles requeridos, verificar
  if (roles && roles.length > 0) {
    const tieneAcceso = roles.some((r) => hasRole(r));
    if (!tieneAcceso) {
      return <Navigate to="/" replace />;
    }
  }

  return children;
}
