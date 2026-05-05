export default function EmptyState({ message = 'No hay datos para mostrar.' }) {
  return <div className="empty-state">{message}</div>;
}
