export default function StatCard({ label, value, helper }) {
  return (
    <div className="stat-card">
      <span>{label}</span>
      <strong>{value ?? 0}</strong>
      {helper && <small>{helper}</small>}
    </div>
  );
}
