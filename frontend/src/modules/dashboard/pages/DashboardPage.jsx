import { useEffect, useState } from "react";
import api from "../../../api/client";

const metrics = [
  ["total_ordenes", "Total órdenes"],
  ["pendientes", "Pendientes"],
  ["autorizadas", "Autorizadas"],
  ["rechazadas", "Rechazadas"],
  ["agendadas", "Agendadas"],
  ["pdf_generados", "PDF generados"],
  ["pdf_pendientes", "PDF pendientes"],
];

export default function DashboardPage() {
  const [data, setData] = useState({});
  const [error, setError] = useState("");

  useEffect(() => {
    api.get("/api/dashboard/resumen")
      .then((res) => setData(res.data))
      .catch((err) => setError(err.response?.data?.detail || "No se pudo cargar el dashboard"));
  }, []);

  return (
    <>
      <div className="header">
        <div>
          <h1 className="title">Dashboard</h1>
          <p className="subtitle">Resumen general de autorizaciones, citas y documentos.</p>
        </div>
      </div>
      {error && <div className="alert alert-error">{error}</div>}
      <div className="grid grid-4">
        {metrics.map(([key, label]) => (
          <div className="card" key={key}>
            <div className="metric-label">{label}</div>
            <div className="metric-value">{data[key] ?? 0}</div>
          </div>
        ))}
      </div>
    </>
  );
}
