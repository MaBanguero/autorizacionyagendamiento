import { useEffect, useState } from 'react';
import { dashboardService } from '../../api/services';
import PageHeader from '../../components/PageHeader';
import StatCard from '../../components/StatCard';
import ErrorBox from '../../components/ErrorBox';
import Loading from '../../components/Loading';

export default function DashboardPage() {
  const [data, setData] = useState(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    dashboardService.getResumen()
      .then(setData)
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, []);

  return (
    <section>
      <PageHeader title="Dashboard" subtitle="Resumen operativo del motor de autorizaciones, citas y documentos." />
      <ErrorBox error={error} />
      {loading ? <Loading /> : (
        <div className="grid stats-grid">
          <StatCard label="Total órdenes" value={data?.total_ordenes} />
          <StatCard label="Pendientes" value={data?.pendientes} helper="Por autorizar" />
          <StatCard label="Autorizadas" value={data?.autorizadas} />
          <StatCard label="Rechazadas" value={data?.rechazadas} />
          <StatCard label="Agendadas" value={data?.agendadas} />
          <StatCard label="PDF generados" value={data?.pdf_generados} />
          <StatCard label="PDF pendientes" value={data?.pdf_pendientes} helper="Autorizadas sin documento" />
        </div>
      )}
    </section>
  );
}
