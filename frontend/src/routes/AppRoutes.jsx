import { Navigate, Route, Routes } from "react-router-dom";
import Shell from "../layouts/Shell";
import ProtectedRoute from "../components/ProtectedRoute";
import LoginPage from "../modules/auth/LoginPage";
import DashboardPage from "../modules/dashboard/pages/DashboardPage";
import OrdersPage from "../modules/orders/pages/OrdersPage";
import CreateOrderPage from "../modules/orders/pages/CreateOrderPage";
import SchedulingPage from "../modules/scheduling/pages/SchedulingPage";
import DocumentsPage from "../modules/documents/pages/DocumentsPage";
import SedesPage from "../modules/sedes/pages/SedesPage";
import UsersPage from "../modules/users/pages/UsersPage";
import UbicacionesPage from "../modules/ubicaciones/pages/UbicacionesPage";

export default function AppRoutes() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route
        element={
          <ProtectedRoute>
            <Shell />
          </ProtectedRoute>
        }
      >
        <Route index element={<DashboardPage />} />
        <Route path="ordenes" element={<OrdersPage />} />
        <Route path="ordenes/nueva" element={
          <ProtectedRoute roles={["ordenar_citas", "super_usuario"]}>
            <CreateOrderPage />
          </ProtectedRoute>
        } />
        <Route path="agendamiento" element={
          <ProtectedRoute roles={["agendar_citas", "super_usuario"]}>
            <SchedulingPage />
          </ProtectedRoute>
        } />
        <Route path="documentos" element={<DocumentsPage />} />
        <Route path="sedes" element={<SedesPage />} />
        <Route path="ubicaciones" element={
          <ProtectedRoute roles={["super_usuario"]}>
            <UbicacionesPage />
          </ProtectedRoute>
        } />
        <Route path="usuarios" element={
          <ProtectedRoute roles={["super_usuario"]}>
            <UsersPage />
          </ProtectedRoute>
        } />
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
