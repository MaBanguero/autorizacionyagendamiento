import { NavLink, Outlet } from "react-router-dom";

export default function Layout() {
  return (
    <div className="layout">
      <aside className="sidebar">
        <div className="brand">Motor Médico<br />Autorizaciones</div>
        <nav className="nav">
          <NavLink to="/">Dashboard</NavLink>
          <NavLink to="/ordenes">Órdenes</NavLink>
          <NavLink to="/ordenes/nueva">Nueva orden</NavLink>
          <NavLink to="/agendamiento">Agendamiento</NavLink>
          <NavLink to="/documentos">Documentos</NavLink>
          <NavLink to="/sedes">Sedes</NavLink>
        </nav>
      </aside>
      <main className="main">
        <Outlet />
      </main>
    </div>
  );
}
