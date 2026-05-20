import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import { CalendarDays, FileText, Home, ClipboardList, Hospital, PlusCircle, LogOut, User, Users, MapPin, Stethoscope } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useMemo } from 'react';

export default function Shell() {
  const { user, logout, hasRole } = useAuth();
  const navigate = useNavigate();

  const items = useMemo(() => {
    const esAdmin = hasRole('super_usuario');
    const puedeOrdenar = hasRole('ordenar_citas');
    const puedeAgendar = hasRole('agendar_citas');

    return [
      { to: '/', label: 'Dashboard', icon: Home, show: true },
      { to: '/ordenes', label: 'Órdenes', icon: ClipboardList, show: true },
      { to: '/ordenes/nueva', label: 'Nueva orden', icon: PlusCircle, show: puedeOrdenar || esAdmin },
      { to: '/agendamiento', label: 'Agendamiento', icon: CalendarDays, show: puedeAgendar || esAdmin },
      { to: '/documentos', label: 'Documentos', icon: FileText, show: true },
      { to: '/sedes', label: 'Sedes', icon: Hospital, show: esAdmin },
      { to: '/ubicaciones', label: 'Municipios', icon: MapPin, show: esAdmin },
      { to: '/usuarios', label: 'Usuarios', icon: Users, show: esAdmin },
    ].filter((i) => i.show);
  }, [hasRole]);

  const handleLogout = () => {
    logout();
    navigate('/login', { replace: true });
  };

  return (
    <div className="layout">
      <aside className="sidebar">
        <div className="brand">
          <div className="brand-icon"><Stethoscope size={22} /></div>
          <div className="brand-text">
            <span className="brand-title">Autorización</span>
            <span className="brand-sub">y Agendamiento</span>
          </div>
        </div>
        <nav className="nav">
          {items.map(({ to, label, icon: Icon }) => (
            <NavLink key={to} to={to} end={to === '/'} className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}>
              <Icon size={19} />
              {label}
            </NavLink>
          ))}
        </nav>
        <div className="sidebar-footer">
          <div className="sidebar-user">
            <User size={16} />
            <div>
              <span>{user?.nombre || user?.username}</span>
              {user?.roles?.length > 0 && (
                <div style={{ fontSize: 11, color: '#94a3b8', marginTop: 2 }}>
                  {user.roles.join(', ')}
                </div>
              )}
            </div>
          </div>
          <button className="btn-logout" onClick={handleLogout}>
            <LogOut size={16} />
            Salir
          </button>
        </div>
      </aside>
      <main className="main">
        <Outlet />
      </main>
    </div>
  );
}
