import { useEffect, useState } from "react";
import api from "../../../api/client";
import { useAuth } from "../../../context/AuthContext";
import { Plus, Pencil, Trash2, X, Save } from "lucide-react";

export default function SedesPage() {
  const { hasRole } = useAuth();
  const esAdmin = hasRole("super_usuario");

  const [sedes, setSedes] = useState([]);
  const [error, setError] = useState("");
  const [mostrarForm, setMostrarForm] = useState(false);
  const [editandoId, setEditandoId] = useState(null);
  const [form, setForm] = useState({ nombre: "", hora_apertura: "08:00", hora_cierre: "18:00", capacidad_diaria: 150 });

  const cargarSedes = () => {
    api
      .get("/api/sedes")
      .then((res) => setSedes(res.data))
      .catch((err) => setError(err.response?.data?.detail || "No se pudieron cargar las sedes"));
  };

  useEffect(() => {
    cargarSedes();
  }, []);

  const resetForm = () => {
    setForm({ nombre: "", hora_apertura: "08:00", hora_cierre: "18:00", capacidad_diaria: 150 });
    setEditandoId(null);
    setMostrarForm(false);
  };

  const abrirEditar = (sede) => {
    const apertura = sede.hora_apertura ? sede.hora_apertura.slice(0, 5) : "08:00";
    const cierre = sede.hora_cierre ? sede.hora_cierre.slice(0, 5) : "18:00";
    setForm({ nombre: sede.nombre, hora_apertura: apertura, hora_cierre: cierre, capacidad_diaria: sede.capacidad_diaria });
    setEditandoId(sede.id);
    setMostrarForm(true);
  };

  const handleGuardar = async (e) => {
    e.preventDefault();
    setError("");
    if (!form.nombre.trim()) return setError("El nombre es obligatorio");

    try {
      if (editandoId) {
        await api.put(`/api/sedes/${editandoId}`, form);
      } else {
        await api.post("/api/sedes", form);
      }
      resetForm();
      cargarSedes();
    } catch (err) {
      setError(err.response?.data?.detail || "Error al guardar la sede");
    }
  };

  const handleEliminar = async (id) => {
    if (!confirm("¿Estás seguro de eliminar esta sede?")) return;
    try {
      await api.delete(`/api/sedes/${id}`);
      cargarSedes();
    } catch (err) {
      setError(err.response?.data?.detail || "Error al eliminar la sede");
    }
  };

  return (
    <>
      <div className="header">
        <div>
          <h1 className="title">Sedes</h1>
          <p className="subtitle">
            {esAdmin ? "Centros disponibles — gestiona horarios y capacidad de citas" : "Centros disponibles para agendamiento."}
          </p>
        </div>
        {esAdmin && (
          <button className="btn btn-primary" onClick={() => { resetForm(); setMostrarForm(!mostrarForm); }}>
            {mostrarForm ? <X size={18} /> : <Plus size={18} />}
            {mostrarForm ? "Cancelar" : "Nueva sede"}
          </button>
        )}
      </div>

      {error && <div className="alert alert-error">{error}</div>}

      {/* Formulario crear/editar sede (solo super_usuario) */}
      {mostrarForm && esAdmin && (
        <div className="card" style={{ marginBottom: 20 }}>
          <h3 style={{ marginTop: 0 }}>{editandoId ? "Editar sede" : "Nueva sede"}</h3>
          <form onSubmit={handleGuardar}>
            <div className="form-grid">
              <div className="field full">
                <label>Nombre</label>
                <input className="input" type="text" value={form.nombre} onChange={(e) => setForm({ ...form, nombre: e.target.value })} placeholder="Nombre de la sede" />
              </div>
              <div className="field">
                <label>Hora apertura</label>
                <input className="input" type="time" value={form.hora_apertura} onChange={(e) => setForm({ ...form, hora_apertura: e.target.value })} />
              </div>
              <div className="field">
                <label>Hora cierre</label>
                <input className="input" type="time" value={form.hora_cierre} onChange={(e) => setForm({ ...form, hora_cierre: e.target.value })} />
              </div>
              <div className="field">
                <label>Cupo diario de citas</label>
                <input className="input" type="number" min={1} max={500} value={form.capacidad_diaria} onChange={(e) => setForm({ ...form, capacidad_diaria: parseInt(e.target.value) || 1 })} />
              </div>
            </div>
            <div className="actions" style={{ marginTop: 12 }}>
              <button type="submit" className="btn btn-primary">
                <Save size={16} />
                {editandoId ? "Actualizar" : "Crear sede"}
              </button>
              <button type="button" className="btn btn-soft" onClick={resetForm}>Cancelar</button>
            </div>
          </form>
        </div>
      )}

      {/* Grid de sedes */}
      <div className="grid grid-2">
        {sedes.length === 0 && <p style={{ color: "#94a3b8", gridColumn: "1 / -1" }}>No hay sedes registradas.</p>}
        {sedes.map((s) => (
          <div className="card" key={s.id} style={{ position: "relative" }}>
            {esAdmin && (
              <div style={{ position: "absolute", top: 12, right: 12, display: "flex", gap: 6 }}>
                <button className="btn btn-soft" style={{ padding: "6px 8px", fontSize: 12 }} title="Editar" onClick={() => abrirEditar(s)}>
                  <Pencil size={14} />
                </button>
                <button className="btn btn-danger" style={{ padding: "6px 8px", fontSize: 12 }} title="Eliminar" onClick={() => handleEliminar(s.id)}>
                  <Trash2 size={14} />
                </button>
              </div>
            )}
            <h3 style={{ marginTop: 0, paddingRight: esAdmin ? 60 : 0 }}>{s.nombre}</h3>
            <div className="grid" style={{ gap: 6, fontSize: 14, color: "#475569" }}>
              <p style={{ margin: 0 }}>🕐 {s.hora_apertura?.slice(0, 5)} — {s.hora_cierre?.slice(0, 5)}</p>
              <p style={{ margin: 0 }}>📋 Capacidad diaria: <strong>{s.capacidad_diaria} citas</strong></p>
            </div>
          </div>
        ))}
      </div>
    </>
  );
}
