import { Navigate, Route, Routes } from "react-router-dom";
import Layout from "../components/Layout";
import DashboardPage from "../modules/dashboard/pages/DashboardPage";
import OrdersPage from "../modules/orders/pages/OrdersPage";
import CreateOrderPage from "../modules/orders/pages/CreateOrderPage";
import SchedulingPage from "../modules/scheduling/pages/SchedulingPage";
import DocumentsPage from "../modules/documents/pages/DocumentsPage";
import SedesPage from "../modules/sedes/pages/SedesPage";

export default function AppRoutes() {
  return (
    <Routes>
      <Route element={<Layout />}>
        <Route index element={<DashboardPage />} />
        <Route path="ordenes" element={<OrdersPage />} />
        <Route path="ordenes/nueva" element={<CreateOrderPage />} />
        <Route path="agendamiento" element={<SchedulingPage />} />
        <Route path="documentos" element={<DocumentsPage />} />
        <Route path="sedes" element={<SedesPage />} />
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
