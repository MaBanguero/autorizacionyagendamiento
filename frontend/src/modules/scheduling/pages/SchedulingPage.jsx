import { useEffect, useMemo, useState } from "react";
import api from "../../../api/client";
import { nowBogotaDate, todayBogotaISO } from "../../../utils/date";
import { X, Calendar, RotateCcw, Trash2 } from "lucide-react";

export default function SchedulingPage() {
  const hoy = todayBogotaISO();
  const [sedes, setSedes] = useState([]);
  const [ordenes, setOrdenes] = useState([]);
  const [agendadas, setAgendadas] = useState([]);
  const [sedeId, setSedeId] = useState("");
  const [ordenId, setOrdenId] = useState("");
  const [todasSedes, setTodasSedes] = useState([]);
  const [fecha, setFecha] = useState(hoy);
  const [slots, setSlots] = useState([]);
  const [slotSeleccionado, setSlotSeleccionado] = useState(null);
  const [mensaje, setMensaje] = useState("");
  const [error, setError] = useState("");

  // Estado para reagendar
  const [reagendandoId, setReagendandoId] = useState(null);
  const [reSedes, setReSedes] = useState([]);
  const [reSedeId, setReSedeId] = useState("");
  const [reFecha, setReFecha] = useState(hoy);
  const [reSlots, setReSlots] = useState([]);
  const [reSlotSeleccionado, setReSlotSeleccionado] = useState(null);

  const cargarSedes = (ubiId) => {
    const url = ubiId ? `/api/sedes/por-ubicacion/${ubiId}` : "/api/sedes";
    api.get(url).then((res) => {
      const lista = Array.isArray(res.data) ? res.data : [];
      setSedes(lista);
      if (lista.length > 0 && !lista.find((s) => s.id === sedeId)) {
        setSedeId(lista[0].id);
      } else if (lista.length === 0) {
        setSedeId("");
      }
    });
  };

  const cargarTodasSedes = () =>
    api.get("/api/sedes").then((res) => setTodasSedes(res.data)).catch(() => {});

  const cargarOrdenesSinCita = () =>
    api
      .get("/api/ordenes", { params: { estado: "AUTORIZADA", con_cita: false, limit: 200 } })
      .then((res) => setOrdenes(res.data))
      .catch(() => setOrdenes([]));

  const cargarAgendadas = () =>
    api
      .get("/api/ordenes/agendadas", { params: { limit: 200 } })
      .then((res) => setAgendadas(res.data))
      .catch(() => setAgendadas([]));

  const cargarSlots = (sId, f, setter) => {
    if (!sId || !f) return;
    setter([]);
    api
      .get(`/api/sedes/${sId}/disponibilidad`, { params: { fecha: f } })
      .then((res) => setter(res.data.slots || []))
      .catch(() => {});
  };

  // Cuando cambia la orden seleccionada, filtrar sedes por municipio del paciente
  useEffect(() => {
    if (!ordenId) {
      cargarSedes(); // sin filtro
      return;
    }
    const orden = ordenes.find((o) => o.id === ordenId);
    const muniId = orden?.paciente?.municipio_id;
    if (muniId) {
      const url = `/api/sedes/por-municipio/${muniId}`;
      api.get(url).then((res) => {
        const lista = Array.isArray(res.data) ? res.data : [];
        setSedes(lista);
        if (lista.length > 0 && !lista.find((s) => s.id === sedeId)) {
          setSedeId(lista[0].id);
        } else if (lista.length === 0) {
          setSedeId("");
        }
      });
    } else {
      cargarSedes();
    }
  }, [ordenId]);

  useEffect(() => {
    cargarTodasSedes();
    cargarOrdenesSinCita();
    cargarAgendadas();
  }, []);

  // Slots para agendar nuevo
  useEffect(() => {
    if (!sedeId || !fecha) return;
    if (fecha < hoy) {
      setFecha(hoy);
      return;
    }
    setSlotSeleccionado(null);
    cargarSlots(sedeId, fecha, setSlots);
  }, [sedeId, fecha]);

  // Slots para reagendar
  useEffect(() => {
    if (!reagendandoId || !reSedeId || !reFecha) return;
    setReSlotSeleccionado(null);
    cargarSlots(reSedeId, reFecha, setReSlots);
  }, [reagendandoId, reSedeId, reFecha]);

  const slotsVisibles = useMemo(() => {
    const ahora = nowBogotaDate();
    return slots.filter((slot) => {
      const slotDate = new Date(slot.fecha_hora);
      if (fecha === hoy) return slotDate >= ahora;
      return fecha >= hoy;
    });
  }, [slots, fecha, hoy]);

  const reSlotsVisibles = useMemo(() => {
    const ahora = nowBogotaDate();
    return reSlots.filter((slot) => {
      const slotDate = new Date(slot.fecha_hora);
      if (reFecha === hoy) return slotDate >= ahora;
      return reFecha >= hoy;
    });
  }, [reSlots, reFecha, hoy]);

  const slotOcupado = (slot, ordenIdAExcluir) => {
    // Un slot está ocupado si otra orden agendada ya lo tiene
    return agendadas.some((a) => a.id !== ordenIdAExcluir && a.fecha_cita === slot.fecha_hora);
  };

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
      setOrdenId("");
      setSlotSeleccionado(null);
      await Promise.all([cargarOrdenesSinCita(), cargarAgendadas()]);
      cargarSlots(sedeId, fecha, setSlots);
    } catch (err) {
      setError(err.response?.data?.detail || "Error al agendar la cita");
    }
  };

  const cancelarCita = async (ordenId) => {
    if (!confirm("¿Cancelar esta cita? Se liberará el horario.")) return;
    setMensaje("");
    setError("");
    try {
      await api.post(`/api/ordenes/${ordenId}/cancelar-cita`);
      setMensaje("Cita cancelada correctamente.");
      await Promise.all([cargarOrdenesSinCita(), cargarAgendadas()]);
      if (reagendandoId === ordenId) setReagendandoId(null);
    } catch (err) {
      setError(err.response?.data?.detail || "Error al cancelar la cita");
    }
  };

  const iniciarReagendar = (orden) => {
    setReagendandoId(orden.id);
    setReFecha(orden.fecha_cita?.split("T")[0] || hoy);
    setReSlotSeleccionado(null);

    // Cargar sedes según municipio del paciente
    const muniId = orden?.paciente?.municipio_id;
    const url = muniId ? `/api/sedes/por-municipio/${muniId}` : "/api/sedes";
    api.get(url).then((res) => {
      const lista = Array.isArray(res.data) ? res.data : [];
      setReSedes(lista);
      if (lista.length > 0) {
        // Mantener sede actual si está en la lista, si no usar la primera
        const sedeActualValida = orden.sede_id && lista.find((s) => s.id === orden.sede_id);
        setReSedeId(sedeActualValida ? orden.sede_id : lista[0].id);
      } else {
        setReSedeId("");
      }
    });
  };

  const confirmarReagendar = async () => {
    setMensaje("");
    setError("");
    if (!reSlotSeleccionado) return setError("Selecciona un nuevo horario.");

    try {
      await api.put(`/api/ordenes/${reagendandoId}/reagendar`, {
        sede_id: reSedeId,
        fecha_hora: reSlotSeleccionado.fecha_hora,
      });
      setMensaje("Cita reagendada correctamente.");
      setReagendandoId(null);
      setReSlotSeleccionado(null);
      await Promise.all([cargarOrdenesSinCita(), cargarAgendadas()]);
      cargarSlots(sedeId, fecha, setSlots);
    } catch (err) {
      setError(err.response?.data?.detail || "Error al reagendar la cita");
    }
  };

  return (
    <>
      <div className="header">
        <div>
          <h1 className="title">Agendamiento</h1>
          <p className="subtitle">Agenda nuevas citas, consulta, cancela o cambia el horario de las programadas.</p>
        </div>
      </div>

      {mensaje && <div className="alert">{mensaje}</div>}
      {error && <div className="alert alert-error">{error}</div>}

      {/* Formulario nuevo agendamiento */}
      <div className="grid grid-2" style={{ marginBottom: 24 }}>
        <div className="card form-card">
          <h3 style={{ marginTop: 0 }}>Nueva cita</h3>
          <div className="field">
            <label>Orden autorizada sin cita</label>
            <select className="input" value={ordenId} onChange={(e) => setOrdenId(e.target.value)}>
              <option value="">Selecciona una orden</option>
              {ordenes.map((o) => (
                <option key={o.id} value={o.id}>
                  {o.numero_orden} - {o.paciente?.nombre} - {o.estudio}
                </option>
              ))}
            </select>
          </div>

          <div className="field">
            <label>Sede</label>
            <select className="input" value={sedeId} onChange={(e) => setSedeId(e.target.value)}>
              {sedes.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.nombre}
                </option>
              ))}
            </select>
          </div>

          <div className="field">
            <label>Fecha</label>
            <input
              className="input"
              type="date"
              min={hoy}
              value={fecha}
              onChange={(e) => setFecha(e.target.value < hoy ? hoy : e.target.value)}
            />
          </div>

          <button className="btn btn-primary full-btn" onClick={agendar}>
            <Calendar size={16} />
            Confirmar agendamiento
          </button>
        </div>

        <div className="card">
          <h3 style={{ marginTop: 0 }}>Slots disponibles</h3>
          <p className="subtitle">
            {sedes.find((s) => s.id === sedeId)?.nombre || "Sede"} — {fecha}
          </p>
          <div className="slots">
            {slotsVisibles.map((slot) => {
              const disabled = !slot.disponible;
              const selected = slotSeleccionado?.fecha_hora === slot.fecha_hora;
              return (
                <button
                  key={slot.fecha_hora}
                  disabled={disabled}
                  className={`slot ${disabled ? "busy" : ""} ${selected ? "selected" : ""}`}
                  onClick={() => setSlotSeleccionado(slot)}
                >
                  {slot.hora}
                </button>
              );
            })}
            {!slotsVisibles.length && <p>No hay horarios disponibles para esta fecha.</p>}
          </div>
        </div>
      </div>

      {/* Citas programadas */}
      <div className="card" style={{ padding: 0, overflow: "hidden" }}>
        <div style={{ padding: "16px 18px 0", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <h3 style={{ margin: 0 }}>Citas programadas</h3>
          <span style={{ fontSize: 13, color: "#64748b" }}>{agendadas.length} cita{agendadas.length !== 1 ? "s" : ""}</span>
        </div>
        <table>
          <thead>
            <tr>
              <th>Paciente</th>
              <th>Estudio</th>
              <th>Sede</th>
              <th>Fecha / Hora</th>
              <th style={{ width: 160 }}>Acciones</th>
            </tr>
          </thead>
          <tbody>
            {agendadas.length === 0 && (
              <tr>
                <td colSpan={5} style={{ textAlign: "center", padding: 32, color: "#94a3b8" }}>
                  No hay citas programadas.
                </td>
              </tr>
            )}
            {agendadas.map((a) => {
              const esSedeActual = todasSedes.find((s) => s.id === a.sede_id);
              const fechaCita = a.fecha_cita ? new Date(a.fecha_cita) : null;
              return (
                <tr key={a.id}>
                  <td>
                    <strong>{a.paciente?.nombre}</strong>
                    <br />
                    <span style={{ fontSize: 12, color: "#64748b" }}>{a.numero_orden}</span>
                  </td>
                  <td>{a.estudio}</td>
                  <td>{esSedeActual?.nombre || "—"}</td>
                  <td>
                    {fechaCita ? (
                      <>
                        <div>{fechaCita.toLocaleDateString("es-CO")}</div>
                        <div style={{ fontSize: 12, color: "#2563eb", fontWeight: 700 }}>
                          {fechaCita.toLocaleTimeString("es-CO", { hour: "2-digit", minute: "2-digit" })}
                        </div>
                      </>
                    ) : (
                      "—"
                    )}
                  </td>
                  <td>
                    <div className="actions">
                      <button
                        className="btn btn-soft"
                        style={{ padding: "6px 10px", fontSize: 12 }}
                        onClick={() => iniciarReagendar(a)}
                      >
                        <RotateCcw size={14} /> Cambiar
                      </button>
                      <button
                        className="btn btn-danger"
                        style={{ padding: "6px 10px", fontSize: 12 }}
                        onClick={() => cancelarCita(a.id)}
                      >
                        <Trash2 size={14} /> Cancelar
                      </button>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Panel de reagendar */}
      {reagendandoId && (
        <div className="card" style={{ marginTop: 16, border: "2px solid #2563eb" }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
            <h3 style={{ margin: 0 }}>
              <RotateCcw size={16} style={{ marginRight: 6 }} />
              Cambiar horario
            </h3>
            <button className="btn btn-soft" style={{ padding: "6px 10px", fontSize: 12 }} onClick={() => setReagendandoId(null)}>
              <X size={14} /> Cerrar
            </button>
          </div>
          <div className="grid grid-2">
            <div className="form-card" style={{ gap: 12 }}>
              <div className="field">
                <label>Sede</label>
                <select className="input" value={reSedeId} onChange={(e) => setReSedeId(e.target.value)}>
                  {reSedes.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.nombre}
                    </option>
                  ))}
                </select>
              </div>
              <div className="field">
                <label>Nueva fecha</label>
                <input
                  className="input"
                  type="date"
                  min={hoy}
                  value={reFecha}
                  onChange={(e) => setReFecha(e.target.value < hoy ? hoy : e.target.value)}
                />
              </div>
              <button className="btn btn-primary full-btn" onClick={confirmarReagendar}>
                <Calendar size={16} />
                Confirmar cambio
              </button>
            </div>
            <div className="card" style={{ padding: 14 }}>
              <h4 style={{ margin: "0 0 8px", fontSize: 14 }}>Nuevo horario</h4>
              <div className="slots" style={{ maxHeight: 200 }}>
                {reSlotsVisibles.map((slot) => {
                  const ocupado = slotOcupado(slot, reagendandoId);
                  const disabled = !slot.disponible || ocupado;
                  const selected = reSlotSeleccionado?.fecha_hora === slot.fecha_hora;
                  return (
                    <button
                      key={slot.fecha_hora}
                      disabled={disabled}
                      className={`slot ${disabled ? "busy" : ""} ${selected ? "selected" : ""}`}
                      onClick={() => setReSlotSeleccionado(slot)}
                    >
                      {slot.hora}
                    </button>
                  );
                })}
                {!reSlotsVisibles.length && <p>No hay horarios disponibles.</p>}
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
