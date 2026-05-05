import { useEffect, useState } from 'react';
import { ordenService, sedeService } from '../../api/services';
import PageHeader from '../../components/PageHeader';
import ErrorBox from '../../components/ErrorBox';
import Loading from '../../components/Loading';

function today() {
  return new Date().toISOString().slice(0, 10);
}

export default function SchedulingPage() {
  const [sedes, setSedes] = useState([]);
  const [sedeId, setSedeId] = useState('');
  const [fecha, setFecha] = useState(today());
  const [ordenId, setOrdenId] = useState('');
  const [data, setData] = useState(null);
  const [selectedSlot, setSelectedSlot] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  useEffect(() => {
    sedeService.list().then((items) => {
      setSedes(items);
      if (items[0]) setSedeId(items[0].id);
    }).catch((e) => setError(e.message));
  }, []);

  useEffect(() => {
    if (!sedeId || !fecha) return;
    setLoading(true);
    setError('');
    setSelectedSlot(null);
    sedeService.disponibilidad(sedeId, fecha)
      .then(setData)
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, [sedeId, fecha]);

  const agendar = async () => {
    if (!ordenId.trim() || !selectedSlot) {
      setError('Debes escribir el ID de la orden y seleccionar un horario disponible.');
      return;
    }
    setError('');
    setSuccess('');
    try {
      await ordenService.agendar(ordenId.trim(), sedeId, selectedSlot.fecha_hora);
      setSuccess('Cita agendada correctamente.');
      const refreshed = await sedeService.disponibilidad(sedeId, fecha);
      setData(refreshed);
      setSelectedSlot(null);
    } catch (e) { setError(e.message); }
  };

  return (
    <section>
      <PageHeader title="Agendamiento" subtitle="Selecciona sede, fecha y slot de 3 minutos para asignar una cita." />
      <ErrorBox error={error} />
      {success && <div className="success-box">{success}</div>}

      <div className="panel scheduling-toolbar">
        <label>Sede
          <select value={sedeId} onChange={(e) => setSedeId(e.target.value)}>
            {sedes.map((s) => <option key={s.id} value={s.id}>{s.nombre}</option>)}
          </select>
        </label>
        <label>Fecha
          <input type="date" value={fecha} onChange={(e) => setFecha(e.target.value)} />
        </label>
        <label>ID de orden
          <input placeholder="UUID de la orden" value={ordenId} onChange={(e) => setOrdenId(e.target.value)} />
        </label>
        <button onClick={agendar}>Agendar slot</button>
      </div>

      {data && (
        <div className="grid stats-grid small">
          <div className="stat-card"><span>Capacidad diaria</span><strong>{data.capacidad_diaria}</strong></div>
          <div className="stat-card"><span>Total slots</span><strong>{data.total_slots}</strong></div>
          <div className="stat-card"><span>Disponibles</span><strong>{data.slots_disponibles}</strong></div>
          <div className="stat-card"><span>Ocupados</span><strong>{data.slots_ocupados}</strong></div>
        </div>
      )}

      {loading ? <Loading /> : data && (
        <div className="slots-panel">
          <h3>{data.sede} · {fecha}</h3>
          <div className="slots-grid">
            {data.slots?.map((slot) => (
              <button
                key={slot.fecha_hora}
                disabled={!slot.disponible}
                onClick={() => setSelectedSlot(slot)}
                className={`slot ${slot.disponible ? 'available' : 'busy'} ${selectedSlot?.fecha_hora === slot.fecha_hora ? 'selected' : ''}`}
              >
                {slot.hora}
              </button>
            ))}
          </div>
        </div>
      )}
    </section>
  );
}
