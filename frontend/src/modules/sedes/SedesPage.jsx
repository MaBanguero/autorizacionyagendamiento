import { useEffect, useState } from 'react';
import { sedeService } from '../../api/services';
import PageHeader from '../../components/PageHeader';
import ErrorBox from '../../components/ErrorBox';
import Loading from '../../components/Loading';
import EmptyState from '../../components/EmptyState';

export default function SedesPage() {
  const [sedes, setSedes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    sedeService.list()
      .then(setSedes)
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, []);

  return (
    <section>
      <PageHeader title="Sedes" subtitle="Consulta horarios y capacidad configurada por sede." />
      <ErrorBox error={error} />
      {loading ? <Loading /> : sedes.length === 0 ? <EmptyState /> : (
        <div className="cards-list sedes-list">
          {sedes.map((s) => (
            <article className="doc-card" key={s.id}>
              <div>
                <strong>{s.nombre}</strong>
                <p>{s.hora_apertura} - {s.hora_cierre}</p>
                <small>Capacidad diaria: {s.capacidad_diaria}</small>
              </div>
              <span className="badge autorizada">Activa</span>
            </article>
          ))}
        </div>
      )}
    </section>
  );
}
