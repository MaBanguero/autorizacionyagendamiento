import { NavLink } from 'react-router-dom';
import { CalendarDays, FileText, Home, Hospital, ClipboardList } from 'lucide-react';

const items = [
  { to: '/dashboard', label: 'Dashboard', icon: Home },
  { to: '/ordenes', label: 'Órdenes', icon: ClipboardList },
  { to: '/agendamiento', label: 'Agendamiento', icon: CalendarDays },
  { to: '/documentos', label: 'Documentos', icon: FileText },
  { to: '/sedes', label: 'Sedes', icon: Hospital },
];

export default function Shell({ children }) {
  return (
    <div className="app-shell">
      <aside className="sidebar">
        <div className="brand">
          <div className="brand-icon">M</div>
          <div>
            <strong>Motor Médico</strong>
            <span>Autorizaciones</span>
          </div>
        </div>
        <nav>
          {items.map(({ to, label, icon: Icon }) => (
            <NavLink key={to} to={to} className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}>
              <Icon size={19} />
              {label}
            </NavLink>
          ))}
        </nav>
      </aside>
      <main className="main-content">{children}</main>
    </div>
  );
}
