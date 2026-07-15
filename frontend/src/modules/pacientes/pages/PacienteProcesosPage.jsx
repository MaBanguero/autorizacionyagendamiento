import { useEffect, useState, useCallback } from "react";
import { useParams, Link, useNavigate } from "react-router-dom";
import api from "../../../api/client";
import { formatDateTime } from "../../../utils/date";

const TIPOS_RIAS = [
  "CONSULTA",
  "PROMOCION",
  "PREVENCION",
  "DIAGNOSTICO",
  "TRATAMIENTO",
  "SEGUIMIENTO",
  "REHABILITACION",
  "PROCEDIMIENTO",
];

const COLORES_TIPO = {
  CONSULTA: "badge-ok",
  PROMOCION: "badge-pending",
  PREVENCION: "badge-pending",
  DIAGNOSTICO: "badge-ok",
  TRATAMIENTO: "badge-danger",
  SEGUIMIENTO: "badge-muted",
  REHABILITACION: "badge-ok",
  PROCEDIMIENTO: "badge-muted",
};

export default function PacienteProcesosPage() {
  const { pacienteId } = useParams();
  const navigate = useNavigate();
  const [paciente, setPaciente] = useState(null);
  const [procesos, setProcesos] = useState([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  // Modal nuevo proceso
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({
    tipo: "PROCEDIMIENTO",
    codigo: "",
    nombre: "",
    descripcion: "",
    resultado: "",
    profesional: "",
    fecha_proceso: new Date().toISOString().slice(0, 16),
  });
  const [saving, setSaving] = useState(false);

  const cargarPaciente = useCallback(async () => {
    try {
      const res = await api.get(`/api/pacientes/buscar`, {
        params: { q: pacienteId, tipo: "documento" },
      });
      // Buscar por id
      const all = await api.get("/api/pacientes", { params: { limit: 1, offset: 0 } });
      // Try to find by id
      const r = await api.get(`/api/ordenes/${pacienteId}`).catch(() => null);
      // Best effort: search pacientes
      const searchRes = await api.get("/api/pacientes", {
        params: { q: pacienteId, limit: 1 },
      });
      if (searchRes.data?.pacientes?.length > 0) {
        setPaciente(searchRes.data.pacientes[0]);
      }
    } catch {
      // Try direct fetch all and find
    }
  }, [pacienteId]);

  const cargarProcesos = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.get(`/api/pacientes/${pacienteId}/procesos`);
      setProcesos(res.data.procesos || []);
      setTotal(res.data.total || 0);
    } catch (err) {
      setError(err.response?.data?.detail || "Error cargando procesos.");
    } finally {
      setLoading(false);
    }
  }, [pacienteId]);

  useEffect(() => {
    cargarProcesos();
  }, [cargarProcesos]);

  // Buscar datos del paciente cargando la lista completa
  useEffect(() => {
    api.get("/api/pacientes", { params: { limit: 1, offset: 0, q: "" } }).then(() => {
      api.get("/api/pacientes", { params: { limit: 200, offset: 0 } }).then((res) => {
        const p = (res.data?.pacientes || []).find((p) => p.id === pacienteId);
        if (p) setPaciente(p);
      });
    }).catch(() => {});
  }, [pacienteId]);

  const guardarProceso = async (e) => {
    e.preventDefault();
    setSaving(true);
    setError("");
    try {
      const payload = {
        ...form,
        fecha_proceso: new Date(form.fecha_proceso).toISOString(),
        codigo: form.codigo || null,
      };
      await api.post(`/api/pacientes/${pacienteId}/procesos`, payload);
      setShowForm(false);
      setForm({
        tipo: "PROCEDIMIENTO",
        codigo: "",
        nombre: "",
        descripcion: "",
        resultado: "",
        profesional: "",
        fecha_proceso: new Date().toISOString().slice(0, 16),
      });
      await cargarProcesos();
    } catch (err) {
      setError(err.response?.data?.detail || "Error guardando el proceso.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <>
      <div className="header">
        <div>
          <h1 className="title">
            {paciente ? `Procesos: ${paciente.nombre}` : "Historial del paciente"}
          </h1>
          <p className="subtitle">
            {paciente
              ? `${paciente.tipo_documento} ${paciente.numero_documento} · ${total} procesos registrados`
              : `Resolución 3280 · ${total} procesos`}
          </p>
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          <Link to="/pacientes" className="btn btn-outline">
            ← Pacientes
          </Link>
          <button className="btn btn-primary" onClick={() => setShowForm(true)}>
            + Nuevo proceso
          </button>
        </div>
      </div>

      {error && <div className="alert alert-error">{error}</div>}

      {/* Timeline */}
      <div className="card">
        {loading ? (
          <div className="loading-screen" style={{ height: 200 }}>
            Cargando...
          </div>
        ) : procesos.length === 0 ? (
          <div className="timeline-empty">
            <p>No hay procesos registrados para este paciente.</p>
            <button className="btn btn-primary" onClick={() => setShowForm(true)}>
              Registrar primer proceso
            </button>
          </div>
        ) : (
          <div className="timeline">
            {procesos.map((p) => (
              <div key={p.id} className="timeline-item">
                <div className="timeline-dot"></div>
                <div className="timeline-content">
                  <div className="timeline-header">
                    <span className={`badge ${COLORES_TIPO[p.tipo] || "badge-muted"}`}>
                      {p.tipo}
                    </span>
                    <span className="timeline-date">
                      {new Date(p.fecha_proceso).toLocaleDateString("es-CO", {
                        year: "numeric",
                        month: "long",
                        day: "numeric",
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </span>
                  </div>
                  <h4 className="timeline-title">
                    {p.codigo && <span className="timeline-code">[{p.codigo}]</span>}{" "}
                    {p.nombre}
                  </h4>
                  {p.descripcion && (
                    <p className="timeline-desc">{p.descripcion}</p>
                  )}
                  {p.resultado && (
                    <div className="timeline-resultado">
                      <strong>Resultado:</strong> {p.resultado}
                    </div>
                  )}
                  {p.profesional && (
                    <div className="timeline-profesional">
                      👨‍⚕️ {p.profesional}
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Modal formulario */}
      {showForm && (
        <div className="modal-overlay" onClick={() => setShowForm(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3>Registrar nuevo proceso</h3>
              <button className="btn btn-sm btn-outline" onClick={() => setShowForm(false)}>
                ✕
              </button>
            </div>
            <form className="modal-body form-grid" onSubmit={guardarProceso}>
              <select
                className="input"
                value={form.tipo}
                onChange={(e) => setForm({ ...form, tipo: e.target.value })}
              >
                {TIPOS_RIAS.map((t) => (
                  <option key={t} value={t}>
                    {t.charAt(0) + t.slice(1).toLowerCase()}
                  </option>
                ))}
              </select>
              <input
                className="input"
                placeholder="Código CUPS (opcional)"
                value={form.codigo}
                onChange={(e) => setForm({ ...form, codigo: e.target.value })}
              />
              <input
                required
                className="input full"
                placeholder="Nombre del proceso / procedimiento"
                value={form.nombre}
                onChange={(e) => setForm({ ...form, nombre: e.target.value })}
              />
              <textarea
                className="input full"
                placeholder="Descripción"
                rows={3}
                value={form.descripcion}
                onChange={(e) => setForm({ ...form, descripcion: e.target.value })}
              />
              <textarea
                className="input full"
                placeholder="Resultado / Hallazgos"
                rows={3}
                value={form.resultado}
                onChange={(e) => setForm({ ...form, resultado: e.target.value })}
              />
              <input
                className="input"
                placeholder="Profesional"
                value={form.profesional}
                onChange={(e) => setForm({ ...form, profesional: e.target.value })}
              />
              <input
                required
                className="input"
                type="datetime-local"
                value={form.fecha_proceso}
                onChange={(e) => setForm({ ...form, fecha_proceso: e.target.value })}
              />
              <div className="modal-actions full">
                <button type="button" className="btn btn-outline" onClick={() => setShowForm(false)}>
                  Cancelar
                </button>
                <button disabled={saving} className="btn btn-primary">
                  {saving ? "Guardando..." : "Registrar proceso"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      <style>{`
        .timeline {
          position: relative;
          padding-left: 32px;
        }
        .timeline::before {
          content: '';
          position: absolute;
          left: 11px;
          top: 0;
          bottom: 0;
          width: 2px;
          background: #e2e8f0;
        }
        .timeline-item {
          position: relative;
          padding-bottom: 24px;
        }
        .timeline-dot {
          position: absolute;
          left: -24px;
          top: 4px;
          width: 14px;
          height: 14px;
          border-radius: 50%;
          background: #2563eb;
          border: 3px solid #dbeafe;
        }
        .timeline-content {
          background: #f8fafc;
          border-radius: 12px;
          padding: 14px;
          border: 1px solid #e2e8f0;
        }
        .timeline-header {
          display: flex;
          align-items: center;
          gap: 10px;
          margin-bottom: 6px;
          flex-wrap: wrap;
        }
        .timeline-date {
          font-size: 12px;
          color: #94a3b8;
        }
        .timeline-title {
          margin: 4px 0;
          font-size: 15px;
          font-weight: 700;
        }
        .timeline-code {
          color: #2563eb;
          font-weight: 600;
        }
        .timeline-desc {
          margin: 4px 0;
          color: #475569;
          font-size: 14px;
        }
        .timeline-resultado {
          margin: 6px 0;
          padding: 8px 10px;
          background: #f0fdf4;
          border-radius: 8px;
          font-size: 13px;
          color: #166534;
        }
        .timeline-profesional {
          margin-top: 4px;
          font-size: 13px;
          color: #64748b;
        }
        .timeline-empty {
          padding: 40px 20px;
          text-align: center;
          color: #64748b;
        }
        .timeline-empty .btn { margin-top: 12px; }
      `}</style>
    </>
  );
}
