import { useEffect, useState } from "react";
import api from "../../../api/client";
import { Plus, Pencil, Trash2, X, Save, MapPin, Building2 } from "lucide-react";

export default function UbicacionesPage() {
  const [municipios, setMunicipios] = useState([]);
  const [sedes, setSedes] = useState([]);
  const [error, setError] = useState("");
  const [mensaje, setMensaje] = useState("");

  // Form municipio
  const [mostrarForm, setMostrarForm] = useState(false);
  const [editandoId, setEditandoId] = useState(null);
  const [form, setForm] = useState({ nombre: "" });

  // Asignacion sede-municipios
  const [asignandoSedeId, setAsignandoSedeId] = useState(null);
  const [sedeMunicipios, setSedeMunicipios] = useState([]);

  const cargarTodo = () => {
    api.get("/api/municipios").then((res) => setMunicipios(res.data)).catch(() => {});
    api.get("/api/sedes").then((res) => setSedes(res.data)).catch(() => {});
  };

  useEffect(() => { cargarTodo(); }, []);

  const resetForm = () => {
    setForm({ nombre: "" });
    setEditandoId(null);
    setMostrarForm(false);
  };

  const handleGuardar = async (e) => {
    e.preventDefault();
    setError("");
    if (!form.nombre.trim()) return setError("El nombre es obligatorio");
    try {
      if (editandoId) {
        await api.put(`/api/municipios/${editandoId}`, form);
      } else {
        await api.post("/api/municipios", form);
      }
      setMensaje(editandoId ? "Municipio actualizado" : "Municipio creado");
      resetForm();
      cargarTodo();
    } catch (err) {
      setError(err.response?.data?.detail || "Error al guardar");
    }
  };

  const handleEliminar = async (id) => {
    if (!confirm("¿Eliminar este municipio?")) return;
    try {
      await api.delete(`/api/municipios/${id}`);
      cargarTodo();
    } catch (err) {
      setError(err.response?.data?.detail || "Error al eliminar");
    }
  };

  const abrirAsignacion = async (sede) => {
    setAsignandoSedeId(sede.id);
    try {
      const res = await api.get(`/api/sedes/${sede.id}/municipios`);
      setSedeMunicipios(res.data.map((m) => m.id));
    } catch {
      setSedeMunicipios([]);
    }
  };

  const toggleMuniEnSede = (muniId) => {
    setSedeMunicipios((prev) =>
      prev.includes(muniId) ? prev.filter((id) => id !== muniId) : [...prev, muniId]
    );
  };

  const guardarAsignacion = async () => {
    try {
      await api.put(`/api/sedes/${asignandoSedeId}/municipios`, {
        municipio_ids: sedeMunicipios,
      });
      setMensaje("Municipios asignados a la sede");
      setAsignandoSedeId(null);
      cargarTodo();
    } catch (err) {
      setError(err.response?.data?.detail || "Error al asignar");
    }
  };

  return (
    <>
      <div className="header">
        <div>
          <h1 className="title">Municipios y Sedes</h1>
          <p className="subtitle">Gestioná los municipios y asignalos directamente a las sedes que los atienden.</p>
        </div>
        <button className="btn btn-primary" onClick={() => { resetForm(); setMostrarForm(!mostrarForm); }}>
          {mostrarForm ? <X size={18} /> : <Plus size={18} />}
          {mostrarForm ? "Cancelar" : "Nuevo municipio"}
        </button>
      </div>

      {mensaje && <div className="alert">{mensaje}</div>}
      {error && <div className="alert alert-error">{error}</div>}

      <div className="grid grid-2">
        {/* Columna: Municipios */}
        <div className="card">
          <h3 style={{ marginTop: 0 }}>
            <Building2 size={16} style={{ marginRight: 4 }} /> Municipios
          </h3>

          {mostrarForm && (
            <form onSubmit={handleGuardar} style={{ marginBottom: 12, padding: 12, background: "#f8fafc", borderRadius: 12 }}>
              <div className="field">
                <label>Nombre del municipio</label>
                <input className="input" type="text" value={form.nombre}
                  onChange={(e) => setForm({ ...form, nombre: e.target.value })} placeholder="Ej: Puerto Tejada" />
              </div>
              <button type="submit" className="btn btn-primary full-btn" style={{ marginTop: 4 }}>
                <Save size={14} /> {editandoId ? "Actualizar" : "Crear municipio"}
              </button>
            </form>
          )}

          {municipios.length === 0 && <p style={{ color: "#94a3b8" }}>No hay municipios creados.</p>}
          {municipios.map((m) => (
            <div key={m.id} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "10px 0", borderBottom: "1px solid #e2e8f0" }}>
              <span><MapPin size={14} style={{ marginRight: 4 }} />{m.nombre}</span>
              <div className="actions">
                <button className="btn btn-soft" style={{ padding: "4px 8px", fontSize: 12 }}
                  onClick={() => { setForm({ nombre: m.nombre }); setEditandoId(m.id); setMostrarForm(true); }}>
                  <Pencil size={12} />
                </button>
                <button className="btn btn-danger" style={{ padding: "4px 8px", fontSize: 12 }}
                  onClick={() => handleEliminar(m.id)}>
                  <Trash2 size={12} />
                </button>
              </div>
            </div>
          ))}
        </div>

        {/* Columna: Asignacion a sedes */}
        <div className="card">
          <h3 style={{ marginTop: 0 }}>
            <Building2 size={16} style={{ marginRight: 4 }} /> Sedes — ¿qué municipios atienden?
          </h3>
          <p className="subtitle">Seleccioná una sede y marcá los municipios que atiende.</p>
          {sedes.map((s) => {
            const asignando = asignandoSedeId === s.id;
            return (
              <div key={s.id} style={{ padding: "10px 0", borderBottom: "1px solid #e2e8f0" }}>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: asignando ? 8 : 0 }}>
                  <strong>{s.nombre}</strong>
                  <button className="btn btn-soft" style={{ padding: "4px 10px", fontSize: 12 }}
                    onClick={() => asignando ? setAsignandoSedeId(null) : abrirAsignacion(s)}>
                    <MapPin size={13} /> {asignando ? "Cerrar" : "Asignar"}
                  </button>
                </div>
                {asignando && (
                  <div>
                    <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: 8 }}>
                      {municipios.map((m) => (
                        <label key={m.id}
                          className={`role-chip ${sedeMunicipios.includes(m.id) ? "active" : ""}`}
                          onClick={() => toggleMuniEnSede(m.id)}>
                          {m.nombre}
                        </label>
                      ))}
                    </div>
                    <button className="btn btn-primary" style={{ padding: "6px 14px", fontSize: 13 }}
                      onClick={guardarAsignacion}>
                      <Save size={14} /> Guardar asignación
                    </button>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      <div className="card" style={{ marginTop: 16, background: "#f8fafc" }}>
        <p style={{ margin: 0, fontSize: 13, color: "#475569" }}>
          <strong>🔗 Flujo:</strong> Cada paciente tiene un municipio. Cada sede atiende ciertos municipios.
          Al agendar, el sistema muestra solo las sedes que atienden el municipio del paciente.
        </p>
      </div>
    </>
  );
}
