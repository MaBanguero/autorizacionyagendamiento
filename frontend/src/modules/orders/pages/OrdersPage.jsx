import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import api from "../../../api/client";
import { formatDateTime } from "../../../utils/date";

function statusClass(status) {
  if (status === "AUTORIZADA") return "badge badge-ok";
  if (status === "RECHAZADA") return "badge badge-danger";
  return "badge badge-pending";
}

export default function OrdersPage() {
  const [ordenes, setOrdenes] = useState([]);
  const [estado, setEstado] = useState("");
  const [numero, setNumero] = useState("");
  const [mensaje, setMensaje] = useState("");

  const cargar = async () => {
    setMensaje("");
    try {
      const params = { limit: 100 };
      if (estado) params.estado = estado;
      const res = await api.get("/api/ordenes", { params });
      setOrdenes(res.data);
    } catch (err) {
      setMensaje(err.response?.data?.detail || "No se pudieron cargar las órdenes");
    }
  };

  useEffect(() => { cargar(); }, [estado]);

  const buscar = async () => {
    if (!numero.trim()) return cargar();
    try {
      const res = await api.get("/api/ordenes/buscar", { params: { numero_orden: numero.trim() } });
      setOrdenes([res.data]);
    } catch (err) {
      setMensaje(err.response?.data?.detail || "Orden no encontrada");
    }
  };

  const autorizar = async (id) => {
    try {
      await api.post(`/api/ordenes/${id}/autorizar`, { usuario_id: "admin" });
      await cargar();
    } catch (err) { alert(err.response?.data?.detail || "Error autorizando"); }
  };

  const rechazar = async (id) => {
    const motivo = prompt("Motivo del rechazo", "No cumple criterios");
    if (motivo === null) return;
    try {
      await api.post(`/api/ordenes/${id}/rechazar`, { usuario_id: "admin", motivo });
      await cargar();
    } catch (err) { alert(err.response?.data?.detail || "Error rechazando"); }
  };

  const generarPdf = async (id) => {
    try {
      const res = await api.post(`/api/ordenes/${id}/generar-pdf`);
      alert(res.data?.mensaje || "PDF generado");
      await cargar();
    } catch (err) { alert(err.response?.data?.detail || "Error generando PDF"); }
  };

  return (
    <>
      <div className="header">
        <div>
          <h1 className="title">Órdenes médicas</h1>
          <p className="subtitle">Autoriza, rechaza, agenda y genera documentos.</p>
        </div>
        <Link className="btn btn-primary" to="/ordenes/nueva">+ Nueva orden</Link>
      </div>

      {mensaje && <div className="alert alert-error">{mensaje}</div>}

      <div className="toolbar">
        <input className="input" style={{maxWidth: 260}} placeholder="Buscar número de orden" value={numero} onChange={(e) => setNumero(e.target.value)} />
        <button className="btn btn-dark" onClick={buscar}>Buscar</button>
        <select className="input" style={{maxWidth: 220}} value={estado} onChange={(e) => setEstado(e.target.value)}>
          <option value="">Todos los estados</option>
          <option value="PENDIENTE">Pendiente</option>
          <option value="AUTORIZADA">Autorizada</option>
          <option value="RECHAZADA">Rechazada</option>
        </select>
      </div>

      <div className="card table-wrap">
        <table>
          <thead><tr><th>Orden</th><th>Paciente</th><th>Estudio</th><th>Estado</th><th>Cita</th><th>PDF</th><th>Acciones</th></tr></thead>
          <tbody>
            {ordenes.map((o) => (
              <tr key={o.id}>
                <td>{o.numero_orden}</td>
                <td>{o.paciente?.nombre}<br/><small>{o.paciente?.tipo_documento} {o.paciente?.numero_documento}</small></td>
                <td>{o.estudio}</td>
                <td><span className={statusClass(o.estado)}>{o.estado}</span></td>
                <td>{formatDateTime(o.fecha_cita)}</td>
                <td>{o.documento_generado ? <span className="badge badge-ok">Generado</span> : <span className="badge badge-muted">Pendiente</span>}</td>
                <td>
                  <div className="actions">
                    {o.estado === "PENDIENTE" && <button className="btn btn-success" onClick={() => autorizar(o.id)}>Autorizar</button>}
                    {o.estado === "PENDIENTE" && <button className="btn btn-danger" onClick={() => rechazar(o.id)}>Rechazar</button>}
                    {o.estado === "AUTORIZADA" && !o.documento_generado && <button className="btn btn-soft" onClick={() => generarPdf(o.id)}>Generar PDF</button>}
                    {o.documento_generado && <a className="btn btn-dark" href={`${import.meta.env.VITE_API_URL || "http://127.0.0.1:8081"}/api/documentos/${o.id}/descargar`} target="_blank">Descargar</a>}
                  </div>
                </td>
              </tr>
            ))}
            {!ordenes.length && <tr><td colSpan="7">No hay órdenes para mostrar.</td></tr>}
          </tbody>
        </table>
      </div>
    </>
  );
}
