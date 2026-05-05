import { useEffect, useState } from 'react';
import { documentoService, sedeService } from '../../api/services';
import PageHeader from '../../components/PageHeader';
import ErrorBox from '../../components/ErrorBox';
import EmptyState from '../../components/EmptyState';
import Loading from '../../components/Loading';

export default function DocumentsPage() {
  const [tab, setTab] = useState('pendientes');
  const [sedes, setSedes] = useState([]);
  const [sedeId, setSedeId] = useState('');
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const load = async () => {
    setLoading(true); setError('');
    try {
      const params = sedeId ? { sede_id: sedeId } : {};
      const data = tab === 'pendientes' ? await documentoService.pendientes(params) : await documentoService.generados(params);
      setItems(data);
    } catch (e) { setError(e.message); }
    finally { setLoading(false); }
  };

  useEffect(() => { sedeService.list().then(setSedes).catch(() => {}); }, []);
  useEffect(() => { load(); }, [tab, sedeId]);

  const generarMasivo = async () => {
    setError(''); setSuccess('');
    try {
      const res = await documentoService.generarMasivo(sedeId || undefined);
      setSuccess(res.mensaje || 'Generación masiva iniciada.');
      await load();
    } catch (e) { setError(e.message); }
  };

  return (
    <section>
      <PageHeader
        title="Documentos PDF"
        subtitle="Administra documentos pendientes, generados y generación masiva."
        action={<button onClick={generarMasivo}>Generar masivo</button>}
      />
      <ErrorBox error={error} />
      {success && <div className="success-box">{success}</div>}

      <div className="panel doc-toolbar">
        <div className="tabs">
          <button className={tab === 'pendientes' ? 'active' : ''} onClick={() => setTab('pendientes')}>Pendientes</button>
          <button className={tab === 'generados' ? 'active' : ''} onClick={() => setTab('generados')}>Generados</button>
        </div>
        <select value={sedeId} onChange={(e) => setSedeId(e.target.value)}>
          <option value="">Todas las sedes</option>
          {sedes.map((s) => <option key={s.id} value={s.id}>{s.nombre}</option>)}
        </select>
      </div>

      {loading ? <Loading /> : items.length === 0 ? <EmptyState /> : (
        <div className="cards-list">
          {items.map((item) => (
            <article className="doc-card" key={item.orden_id}>
              <div>
                <strong>Orden {item.numero_orden}</strong>
                <p>{item.paciente}</p>
                {item.estudio && <small>{item.estudio}</small>}
                {item.fecha_generacion && <small>Generado: {new Date(item.fecha_generacion).toLocaleString()}</small>}
              </div>
              {tab === 'generados' && <a className="link-button" href={documentoService.descargarUrl(item.orden_id)} target="_blank">Descargar</a>}
            </article>
          ))}
        </div>
      )}
    </section>
  );
}
