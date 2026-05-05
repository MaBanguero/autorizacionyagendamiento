import { useEffect, useMemo, useState } from "react";
import api from "../../../api/client";
import { nowBogotaDate, todayBogotaISO } from "../../../utils/date";

export default function SchedulingPage() {
  const hoy = todayBogotaISO();
  const [sedes, setSedes] = useState([]);
  const [ordenes, setOrdenes] = useState([]);
  const [sedeId, setSedeId] = useState("");
  const [ordenId, setOrdenId] = useState("");
  const [fecha, setFecha] = useState(hoy);
  const [slots, setSlots] = useState([]);
  const [slotSeleccionado, setSlotSeleccionado] = useState(null);
  const [mensaje, setMensaje] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    api.get("/api/sedes").then((res) => {
      setSedes(res.data);
      if (res.data[0]) setSedeId(res.data[0].id);
    });

    api.get("/api/ordenes", { params: { estado: "AUTORIZADA", limit: 200 } })
      .then((res) => setOrdenes(res.data.filter((o) => !o.fecha_cita)))
      .catch(() => setOrdenes([]));
  }, []);

  useEffect(() => {
    if (!sedeId || !fecha) return;
    if (fecha < hoy) {
      setFecha(hoy);
      return;
    }

    setSlotSeleccionado(null);
    api.get(`/api/sedes/${sedeId}/disponibilidad`, { params: { fecha } })
      .then((res) => setSlots(res.data.slots || []))
      .catch((err) => setError(err.response?.data?.detail || "No se pudo cargar la disponibilidad"));
  }, [sedeId, fecha]);

  const slotsVisibles = useMemo(() => {
    const ahora = nowBogotaDate();
    return slots.filter((slot) => {
      const slotDate = new Date(slot.fecha_hora);
      if (fecha === hoy) return slotDate >= ahora;
      return fecha >= hoy;
    });
  }, [slots, fecha, hoy]);

  const agendar = async () => {
    setMensaje("");
    setError("");
    if (!ordenId) return setError("Selecciona una orden autorizada sin cita.");
    if (!slotSeleccionado) return setError("Selecciona un horario disponible.");

    try {
      await api.post(`/api/ordenes/${ordenId}/agendar`, {
        sede_id: sedeId,
        fecha_hora: slotSeleccionado.fecha_hora,
      });
      setMensaje("Cita agendada correctamente.");
      setOrdenes((prev) => prev.filter((o) => o.id !== ordenId));
      setOrdenId("");
      setSlotSeleccionado(null);
      const res = await api.get(`/api/sedes/${sedeId}/disponibilidad`, { params: { fecha } });
      setSlots(res.data.slots || []);
    } catch (err) {
      setError(err.response?.data?.detail || "Error al agendar la cita");
    }
  };

  return (
    <>
      <div className="header">
        <div>
          <h1 className="title">Agendamiento</h1>
          <p className="subtitle">Selecciona una orden autorizada, sede, fecha y slot disponible.</p>
        </div>
      </div>

      {mensaje && <div className="alert">{mensaje}</div>}
      {error && <div className="alert alert-error">{error}</div>}

      <div className="grid grid-2">
        <div className="card grid">
          <label>Orden autorizada sin cita</label>
          <select className="input" value={ordenId} onChange={(e) => setOrdenId(e.target.value)}>
            <option value="">Selecciona una orden</option>
            {ordenes.map((o) => <option key={o.id} value={o.id}>{o.numero_orden} - {o.paciente?.nombre} - {o.estudio}</option>)}
          </select>

          <label>Sede</label>
          <select className="input" value={sedeId} onChange={(e) => setSedeId(e.target.value)}>
            {sedes.map((s) => <option key={s.id} value={s.id}>{s.nombre}</option>)}
          </select>

          <label>Fecha</label>
          <input className="input" type="date" min={hoy} value={fecha} onChange={(e) => setFecha(e.target.value < hoy ? hoy : e.target.value)} />

          <button className="btn btn-primary" onClick={agendar}>Confirmar agendamiento</button>
        </div>

        <div className="card">
          <h3 style={{marginTop: 0}}>Slots disponibles</h3>
          <p className="subtitle">No se muestran días anteriores ni horarios que ya pasaron hoy.</p>
          <div className="slots">
            {slotsVisibles.map((slot) => {
              const disabled = !slot.disponible;
              const selected = slotSeleccionado?.fecha_hora === slot.fecha_hora;
              return (
                <button key={slot.fecha_hora} disabled={disabled} className={`slot ${disabled ? "busy" : ""} ${selected ? "selected" : ""}`} onClick={() => setSlotSeleccionado(slot)}>
                  {slot.hora}
                </button>
              );
            })}
            {!slotsVisibles.length && <p>No hay horarios disponibles para esta fecha.</p>}
          </div>
        </div>
      </div>
    </>
  );
}
