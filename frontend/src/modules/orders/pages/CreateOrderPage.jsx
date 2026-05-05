import { useState } from "react";
import { useNavigate } from "react-router-dom";
import api from "../../../api/client";

const initialForm = {
  numero_orden: "",
  estudio: "",
  paciente: {
    nombre: "",
    tipo_documento: "CC",
    numero_documento: "",
    sexo: "M",
    direccion: "",
    telefono: "",
    fecha_nacimiento: "",
    convenio: "",
    regimen: "Contributivo",
  },
};

export default function CreateOrderPage() {
  const [form, setForm] = useState(initialForm);
  const [mensaje, setMensaje] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  const update = (field, value) => setForm({ ...form, [field]: value });
  const updatePaciente = (field, value) => setForm({ ...form, paciente: { ...form.paciente, [field]: value } });

  const crearOrden = async (e) => {
    e.preventDefault();
    setMensaje("");
    setError("");
    setLoading(true);

    try {
      await api.post("/api/ordenes", {
        id: crypto.randomUUID(),
        numero_orden: form.numero_orden.trim(),
        estudio: form.estudio.trim(),
        paciente: form.paciente,
        estado: "PENDIENTE",
        documento_generado: false,
      });

      setMensaje("Orden creada correctamente.");
      setForm(initialForm);
      setTimeout(() => navigate("/ordenes"), 700);
    } catch (err) {
      setError(err.response?.data?.detail || "Error creando la orden. Verifica los datos.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <div className="header">
        <div>
          <h1 className="title">Nueva orden</h1>
          <p className="subtitle">Registra una orden médica nueva en estado pendiente.</p>
        </div>
      </div>

      {mensaje && <div className="alert">{mensaje}</div>}
      {error && <div className="alert alert-error">{error}</div>}

      <form className="card form-grid" onSubmit={crearOrden}>
        <input required className="input" placeholder="Número de orden" value={form.numero_orden} onChange={(e) => update("numero_orden", e.target.value)} />
        <input required className="input" placeholder="Estudio / procedimiento" value={form.estudio} onChange={(e) => update("estudio", e.target.value)} />

        <input required className="input" placeholder="Nombre completo del paciente" value={form.paciente.nombre} onChange={(e) => updatePaciente("nombre", e.target.value)} />
        <input required className="input" placeholder="Número de documento" value={form.paciente.numero_documento} onChange={(e) => updatePaciente("numero_documento", e.target.value)} />

        <select className="input" value={form.paciente.tipo_documento} onChange={(e) => updatePaciente("tipo_documento", e.target.value)}>
          <option value="CC">CC</option><option value="TI">TI</option><option value="CE">CE</option><option value="PAS">PAS</option>
        </select>
        <select className="input" value={form.paciente.sexo} onChange={(e) => updatePaciente("sexo", e.target.value)}>
          <option value="M">Masculino</option><option value="F">Femenino</option><option value="O">Otro</option>
        </select>

        <input required className="input" type="date" value={form.paciente.fecha_nacimiento} onChange={(e) => updatePaciente("fecha_nacimiento", e.target.value)} />
        <input required className="input" placeholder="Teléfono" value={form.paciente.telefono} onChange={(e) => updatePaciente("telefono", e.target.value)} />
        <input required className="input full" placeholder="Dirección" value={form.paciente.direccion} onChange={(e) => updatePaciente("direccion", e.target.value)} />
        <input required className="input" placeholder="Convenio / EPS" value={form.paciente.convenio} onChange={(e) => updatePaciente("convenio", e.target.value)} />
        <select className="input" value={form.paciente.regimen} onChange={(e) => updatePaciente("regimen", e.target.value)}>
          <option value="Contributivo">Contributivo</option><option value="Subsidiado">Subsidiado</option><option value="Particular">Particular</option>
        </select>
        <button disabled={loading} className="btn btn-primary full">{loading ? "Creando..." : "Crear orden"}</button>
      </form>
    </>
  );
}
