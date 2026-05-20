import { useEffect, useState } from "react";
import api from "../../../api/client";
import { formatDateTime } from "../../../utils/date";

const API_BASE = import.meta.env.VITE_API_URL || "http://127.0.0.1:8081";
function downloadUrl(ordenId) {
  const token = localStorage.getItem("token");
  return `${API_BASE}/api/documentos/${ordenId}/descargar${token ? `?token=${encodeURIComponent(token)}` : ""}`;
}

export default function DocumentsPage() {
  const [pendientes, setPendientes] = useState([]);
  const [generados, setGenerados] = useState([]);
  const [mensaje, setMensaje] = useState("");

  const cargar = async () => {
    const [p, g] = await Promise.all([
      api.get("/api/documentos/pendientes"),
      api.get("/api/documentos/generados"),
    ]);
    setPendientes(p.data);
    setGenerados(g.data);
  };

  useEffect(() => { cargar().catch(() => setMensaje("No se pudieron cargar los documentos")); }, []);

  const generarMasivo = async () => {
    try {
      const res = await api.post("/api/documentos/generacion-masiva");
      alert(res.data?.mensaje || "Generación masiva iniciada");
    } catch (err) { alert(err.response?.data?.detail || "Error iniciando generación masiva"); }
  };

  const generarUno = async (id) => {
    try {
      await api.post(`/api/ordenes/${id}/generar-pdf`);
      await cargar();
    } catch (err) { alert(err.response?.data?.detail || "Error generando PDF"); }
  };

  return (
    <>
      <div className="header">
        <div><h1 className="title">Documentos</h1><p className="subtitle">Control de PDFs pendientes y generados.</p></div>
        <button className="btn btn-primary" onClick={generarMasivo}>Generación masiva</button>
      </div>
      {mensaje && <div className="alert alert-error">{mensaje}</div>}
      <div className="grid grid-2">
        <div className="card table-wrap">
          <h3 style={{marginTop: 0}}>Pendientes</h3>
          <table><thead><tr><th>Orden</th><th>Paciente</th><th>Estudio</th><th></th></tr></thead><tbody>
            {pendientes.map((d) => <tr key={d.orden_id}><td>{d.numero_orden}</td><td>{d.paciente}</td><td>{d.estudio}</td><td><button className="btn btn-soft" onClick={() => generarUno(d.orden_id)}>Generar</button></td></tr>)}
            {!pendientes.length && <tr><td colSpan="4">No hay documentos pendientes.</td></tr>}
          </tbody></table>
        </div>
        <div className="card table-wrap">
          <h3 style={{marginTop: 0}}>Generados</h3>
          <table><thead><tr><th>Orden</th><th>Paciente</th><th>Fecha</th><th></th></tr></thead><tbody>
            {generados.map((d) => <tr key={d.orden_id}><td>{d.numero_orden}</td><td>{d.paciente}</td><td>{formatDateTime(d.fecha_generacion)}</td><td><a className="btn btn-dark" href={downloadUrl(d.orden_id)} target="_blank">Descargar</a></td></tr>)}
            {!generados.length && <tr><td colSpan="4">No hay documentos generados.</td></tr>}
          </tbody></table>
        </div>
      </div>
    </>
  );
}
