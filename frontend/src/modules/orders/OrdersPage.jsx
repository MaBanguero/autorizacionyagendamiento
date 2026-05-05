import { useEffect, useState } from 'react';
import { documentoService, ordenService, sedeService } from '../../api/services';
import PageHeader from '../../components/PageHeader';
import StatusBadge from '../../components/StatusBadge';
import ErrorBox from '../../components/ErrorBox';
import EmptyState from '../../components/EmptyState';
import Loading from '../../components/Loading';

const usuarioIdDefault = 'admin-demo';

export default function OrdersPage() {
  const [ordenes, setOrdenes] = useState([]);
  const [sedes, setSedes] = useState([]);
  const [filters, setFilters] = useState({ estado: '', sede_id: '', documento_generado: '' });
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const loadOrdenes = async () => {
    setLoading(true);
    setError('');
    try {
      const params = {
        limit: 100,
        estado: filters.estado || undefined,
        sede_id: filters.sede_id || undefined,
        documento_generado: filters.documento_generado === '' ? undefined : filters.documento_generado === 'true',
      };
      setOrdenes(await ordenService.list(params));
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { sedeService.list().then(setSedes).catch(() => {}); }, []);
  useEffect(() => { loadOrdenes(); }, [filters]);

  const buscar = async (e) => {
    e.preventDefault();
    if (!search.trim()) return loadOrdenes();
    setLoading(true);
    setError('');
    try {
      const orden = await ordenService.buscar(search.trim());
      setOrdenes([orden]);
    } catch (e) {
      setError(e.message);
      setOrdenes([]);
    } finally {
      setLoading(false);
    }
  };

  const action = async (fn) => {
    setError('');
    try {
      await fn();
      await loadOrdenes();
    } catch (e) { setError(e.message); }
  };

  return (
    <section>
      <PageHeader title="Órdenes médicas" subtitle="Consulta, autoriza, rechaza, agenda y genera documentos." />
      <ErrorBox error={error} />

      <div className="panel filters-panel">
        <form onSubmit={buscar} className="search-form">
          <input placeholder="Buscar por número de orden" value={search} onChange={(e) => setSearch(e.target.value)} />
          <button>Buscar</button>
          <button type="button" className="secondary" onClick={() => { setSearch(''); loadOrdenes(); }}>Limpiar</button>
        </form>
        <div className="filters-row">
          <select value={filters.estado} onChange={(e) => setFilters({ ...filters, estado: e.target.value })}>
            <option value="">Todos los estados</option>
            <option value="PENDIENTE">Pendiente</option>
            <option value="AUTORIZADA">Autorizada</option>
            <option value="RECHAZADA">Rechazada</option>
          </select>
          <select value={filters.sede_id} onChange={(e) => setFilters({ ...filters, sede_id: e.target.value })}>
            <option value="">Todas las sedes</option>
            {sedes.map((s) => <option key={s.id} value={s.id}>{s.nombre}</option>)}
          </select>
          <select value={filters.documento_generado} onChange={(e) => setFilters({ ...filters, documento_generado: e.target.value })}>
            <option value="">PDF: todos</option>
            <option value="true">PDF generado</option>
            <option value="false">PDF pendiente</option>
          </select>
        </div>
      </div>

      {loading ? <Loading /> : ordenes.length === 0 ? <EmptyState /> : (
        <div className="table-card">
          <table>
            <thead><tr><th>Orden</th><th>Paciente</th><th>Estudio</th><th>Estado</th><th>Cita</th><th>PDF</th><th>Acciones</th></tr></thead>
            <tbody>
              {ordenes.map((o) => (
                <tr key={o.id}>
                  <td><strong>{o.numero_orden}</strong></td>
                  <td>{o.paciente?.nombre}</td>
                  <td>{o.estudio}</td>
                  <td><StatusBadge status={o.estado} /></td>
                  <td>{o.fecha_cita ? new Date(o.fecha_cita).toLocaleString() : 'Sin cita'}</td>
                  <td>{o.documento_generado ? 'Generado' : 'Pendiente'}</td>
                  <td className="actions">
                    <button className="mini" onClick={() => action(() => ordenService.autorizar(o.id, usuarioIdDefault))}>Autorizar</button>
                    <button className="mini danger" onClick={() => action(() => ordenService.rechazar(o.id, usuarioIdDefault, 'Rechazo desde frontend'))}>Rechazar</button>
                    <button className="mini" onClick={() => action(() => ordenService.generarPdf(o.id))}>PDF</button>
                    {o.documento_generado && <a className="mini link-button" href={documentoService.descargarUrl(o.id)} target="_blank">Descargar</a>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
