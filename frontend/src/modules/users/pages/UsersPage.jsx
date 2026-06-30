import { useEffect, useState } from "react";
import api from "../../../api/client";
import { UserPlus, Shield, Key, ToggleLeft, ToggleRight, Plus } from "lucide-react";

export default function UsersPage() {
  const [usuarios, setUsuarios] = useState([]);
  const [rolesDisponibles, setRolesDisponibles] = useState([]);
  const [mostrarForm, setMostrarForm] = useState(false);
  const [mostrarFormRol, setMostrarFormRol] = useState(false);
  const [form, setForm] = useState({ username: "", password: "", nombre: "", roles: [] });
  const [formRol, setFormRol] = useState({ nombre: "", descripcion: "" });
  const [editandoId, setEditandoId] = useState(null);
  const [mensaje, setMensaje] = useState("");
  const [error, setError] = useState("");

  const cargarUsuarios = () => {
    api
      .get("/api/usuarios")
      .then((res) => setUsuarios(res.data))
      .catch(() => setError("No se pudieron cargar los usuarios"));
  };

  const cargarRoles = () => {
    api
      .get("/api/roles")
      .then((res) => setRolesDisponibles(res.data))
      .catch(() => {});
  };

  useEffect(() => {
    cargarUsuarios();
    cargarRoles();
  }, []);

  const resetForm = () => {
    setForm({ username: "", password: "", nombre: "", roles: [] });
    setEditandoId(null);
    setMostrarForm(false);
  };

  const toggleRol = (rolNombre) => {
    setForm((prev) => ({
      ...prev,
      roles: prev.roles.includes(rolNombre) ? prev.roles.filter((r) => r !== rolNombre) : [...prev.roles, rolNombre],
    }));
  };

  const handleCrear = async (e) => {
    e.preventDefault();
    setMensaje("");
    setError("");
    if (!form.username.trim() || !form.password.trim() || !form.nombre.trim()) {
      return setError("Todos los campos son obligatorios");
    }
    try {
      await api.post("/api/usuarios", form);
      setMensaje("Usuario creado correctamente");
      resetForm();
      cargarUsuarios();
    } catch (err) {
      setError(err.response?.data?.detail || "Error al crear usuario");
    }
  };

  const handleToggleActivo = async (usuario) => {
    try {
      await api.put(`/api/usuarios/${usuario.id}/toggle-activo`);
      cargarUsuarios();
    } catch (err) {
      setError(err.response?.data?.detail || "Error al cambiar estado");
    }
  };

  const handleAsignarRoles = async (usuario) => {
    setEditandoId(usuario.id);
  };

  const guardarRoles = async (usuarioId) => {
    setMensaje("");
    setError("");
    try {
      await api.put(`/api/usuarios/${usuarioId}/roles`, { roles: form.roles });
      setMensaje("Roles actualizados correctamente");
      setEditandoId(null);
      cargarUsuarios();
    } catch (err) {
      setError(err.response?.data?.detail || "Error al asignar roles");
    }
  };

  const abrirAsignarRoles = (usuario) => {
    setForm({ ...form, roles: usuario.roles || [] });
    setEditandoId(usuario.id);
  };

  return (
    <>
      <div className="header">
        <div>
          <h1 className="title">Usuarios</h1>
          <p className="subtitle">Gestión de usuarios y asignación de roles</p>
        </div>
        <button className="btn btn-primary" onClick={() => { resetForm(); setMostrarForm(!mostrarForm); }}>
          <UserPlus size={18} />
          {mostrarForm ? "Cancelar" : "Nuevo usuario"}
        </button>
      </div>

      {mensaje && <div className="alert">{mensaje}</div>}
      {error && <div className="alert alert-error">{error}</div>}

      {/* Formulario crear usuario */}
      {mostrarForm && (
        <div className="card" style={{ marginBottom: 20 }}>
          <h3 style={{ marginTop: 0 }}>Nuevo usuario</h3>
          <form onSubmit={handleCrear}>
            <div className="form-grid">
              <div className="field">
                <label>Nombre completo</label>
                <input className="input" type="text" value={form.nombre} onChange={(e) => setForm({ ...form, nombre: e.target.value })} placeholder="Ej: Dr. Juan Pérez" />
              </div>
              <div className="field">
                <label>Usuario</label>
                <input className="input" type="text" value={form.username} onChange={(e) => setForm({ ...form, username: e.target.value })} placeholder="Ej: jperez" />
              </div>
              <div className="field">
                <label>Contraseña</label>
                <input className="input" type="password" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} placeholder="••••••••" />
              </div>
              <div className="field full">
                <label>Roles</label>
                <div className="roles-picker">
                  {rolesDisponibles.length === 0 && <span style={{ color: '#94a3b8', fontSize: 13 }}>No hay roles disponibles</span>}
                  {rolesDisponibles.map((r) => (
                    <label key={r.nombre} className={`role-chip ${form.roles.includes(r.nombre) ? "active" : ""}`}>
                      <input type="checkbox" checked={form.roles.includes(r.nombre)} onChange={() => toggleRol(r.nombre)} />
                      {r.descripcion || r.nombre}
                    </label>
                  ))}
                </div>
              </div>
            </div>
            <button type="submit" className="btn btn-primary" style={{ marginTop: 12 }}>
              Crear usuario
            </button>
          </form>
        </div>
      )}

      {/* Tabla de usuarios */}
      <div className="card" style={{ padding: 0, overflow: "hidden" }}>
        <table>
          <thead>
            <tr>
              <th>Nombre</th>
              <th>Usuario</th>
              <th>Roles</th>
              <th>Estado</th>
              <th>Acciones</th>
            </tr>
          </thead>
          <tbody>
            {usuarios.length === 0 && (
              <tr><td colSpan={5} style={{ textAlign: "center", padding: 32, color: "#94a3b8" }}>No hay usuarios registrados</td></tr>
            )}
            {usuarios.map((u) => (
              <tr key={u.id}>
                <td><strong>{u.nombre}</strong></td>
                <td>{u.username}</td>
                <td>
                  {editandoId === u.id ? (
                    <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                      <div className="roles-picker" style={{ marginBottom: 6 }}>
                        {rolesDisponibles.map((r) => (
                          <label key={r.nombre} className={`role-chip ${(form.roles || u.roles).includes(r.nombre) ? "active" : ""}`}
                            onClick={() => {
                              const nuevos = (form.roles || u.roles).includes(r.nombre)
                                ? (form.roles || u.roles).filter((x) => x !== r.nombre)
                                : [...(form.roles || u.roles), r.nombre];
                              setForm({ ...form, roles: nuevos });
                            }}
                          >
                            {r.descripcion || r.nombre}
                          </label>
                        ))}
                      </div>
                      <div className="actions">
                        <button className="btn btn-success" style={{ padding: "6px 12px", fontSize: 13 }} onClick={() => guardarRoles(u.id)}>Guardar</button>
                        <button className="btn btn-soft" style={{ padding: "6px 12px", fontSize: 13 }} onClick={() => setEditandoId(null)}>Cancelar</button>
                      </div>
                    </div>
                  ) : (
                    <div className="roles-badges">
                      {u.roles?.length > 0
                        ? u.roles.map((r) => <span key={r} className="badge badge-muted" style={{ fontSize: 11 }}>{r}</span>)
                        : <span style={{ color: "#94a3b8", fontSize: 13 }}>Sin roles</span>
                      }
                    </div>
                  )}
                </td>
                <td>
                  <span className={`badge ${u.activo ? "badge-ok" : "badge-danger"}`}>
                    {u.activo ? "Activo" : "Inactivo"}
                  </span>
                </td>
                <td>
                  <div className="actions">
                    <button className="btn btn-soft" style={{ padding: "6px 10px", fontSize: 12 }} title="Asignar roles" onClick={() => abrirAsignarRoles(u)}>
                      <Shield size={14} /> Roles
                    </button>
                    <button className="btn btn-soft" style={{ padding: "6px 10px", fontSize: 12 }} title={u.activo ? "Desactivar" : "Activar"}
                      onClick={() => handleToggleActivo(u)}>
                      {u.activo ? <ToggleRight size={14} /> : <ToggleLeft size={14} />}
                      {u.activo ? "Desactivar" : "Activar"}
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Gestión de Roles */}
      <div style={{ marginTop: 32 }}>
        <div className="header" style={{ marginBottom: 12 }}>
          <h2 className="title" style={{ fontSize: 18 }}>Roles disponibles</h2>
          <button className="btn btn-soft" onClick={() => setMostrarFormRol(!mostrarFormRol)}>
            <Plus size={16} />
            {mostrarFormRol ? "Cancelar" : "Nuevo rol"}
          </button>
        </div>

        {mostrarFormRol && (
          <div className="card" style={{ marginBottom: 16 }}>
            <h4 style={{ marginTop: 0 }}>Crear nuevo rol</h4>
            <form onSubmit={async (e) => {
              e.preventDefault();
              setError("");
              setMensaje("");
              if (!formRol.nombre.trim()) return setError("El nombre del rol es obligatorio");
              try {
                await api.post("/api/roles", formRol);
                setMensaje(`Rol "${formRol.nombre}" creado correctamente`);
                setFormRol({ nombre: "", descripcion: "" });
                setMostrarFormRol(false);
                cargarRoles();
              } catch (err) {
                setError(err.response?.data?.detail || "Error al crear rol");
              }
            }}>
              <div className="form-grid" style={{ gridTemplateColumns: "1fr 2fr" }}>
                <div className="field">
                  <label>Nombre del rol</label>
                  <input className="input" type="text" value={formRol.nombre}
                    onChange={(e) => setFormRol({ ...formRol, nombre: e.target.value })}
                    placeholder="Ej: ver_reportes" />
                </div>
                <div className="field">
                  <label>Descripción</label>
                  <input className="input" type="text" value={formRol.descripcion}
                    onChange={(e) => setFormRol({ ...formRol, descripcion: e.target.value })}
                    placeholder="Ej: Visualización de reportes" />
                </div>
              </div>
              <button type="submit" className="btn btn-primary" style={{ marginTop: 12 }}>
                Crear rol
              </button>
            </form>
          </div>
        )}

        <div className="card" style={{ padding: 0, overflow: "hidden" }}>
          <table>
            <thead>
              <tr>
                <th>Nombre</th>
                <th>Descripción</th>
              </tr>
            </thead>
            <tbody>
              {rolesDisponibles.length === 0 && (
                <tr><td colSpan={2} style={{ textAlign: "center", padding: 32, color: "#94a3b8" }}>No hay roles creados</td></tr>
              )}
              {rolesDisponibles.map((r) => (
                <tr key={r.id}>
                  <td><span className="badge badge-muted">{r.nombre}</span></td>
                  <td>{r.descripcion || "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </>
  );
}
