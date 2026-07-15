import { useEffect, useState, useCallback } from "react";
import api from "../../../api/client";

export default function ConveniosPage() {
  const [convenios, setConvenios] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [mensaje, setMensaje] = useState("");

  // Modal
  const [showModal, setShowModal] = useState(false);
  const [editando, setEditando] = useState(null);
  const [form, setForm] = useState({ nombre: "", regimen: "", activo: true });
  const [saving, setSaving] = useState(false);

  // Import
  const [showImport, setShowImport] = useState(false);
  const [importFile, setImportFile] = useState(null);
  const [importResult, setImportResult] = useState(null);
  const [importing, setImporting] = useState(false);

  const cargar = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const res = await api.get("/api/convenios");
      setConvenios(res.data || []);
    } catch (err) {
      setError(err.response?.data?.detail || "Error cargando convenios.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { cargar(); }, [cargar]);

  const abrirNuevo = () => {
    setEditando(null);
    setForm({ nombre: "", regimen: "", activo: true });
    setShowModal(true);
  };

  const abrirEditar = (c) => {
    setEditando(c);
    setForm({ nombre: c.nombre, regimen: c.regimen || "", activo: c.activo });
    setShowModal(true);
  };

  const guardar = async (e) => {
    e.preventDefault();
    setSaving(true);
    setError("");
    try {
      if (editando) {
        await api.put(`/api/convenios/${editando.id}`, form);
        setMensaje("Convenio actualizado correctamente.");
      } else {
        await api.post("/api/convenios", form);
        setMensaje("Convenio creado correctamente.");
      }
      setShowModal(false);
      await cargar();
      setTimeout(() => setMensaje(""), 3000);
    } catch (err) {
      setError(err.response?.data?.detail || "Error guardando el convenio.");
    } finally {
      setSaving(false);
    }
  };

  const eliminar = async (c) => {
    if (!confirm(`¿Eliminar el convenio "${c.nombre}"?`)) return;
    setError("");
    try {
      await api.delete(`/api/convenios/${c.id}`);
      setMensaje(`Convenio "${c.nombre}" eliminado.`);
      await cargar();
      setTimeout(() => setMensaje(""), 3000);
    } catch (err) {
      setError(err.response?.data?.detail || "Error eliminando el convenio.");
    }
  };

  const handleImportFile = (e) => {
    setImportFile(e.target.files[0]);
    setImportResult(null);
  };

  const importar = async () => {
    if (!importFile) return;
    setImporting(true);
    setError("");
    try {
      const formData = new FormData();
      formData.append("file", importFile);
      const res = await api.post("/api/convenios/importar", formData, {
        headers: { "Content-Type": "multipart/form-data" },
      });
      setImportResult(res.data);
      await cargar();
    } catch (err) {
      setError(err.response?.data?.detail || "Error importando convenios.");
    } finally {
      setImporting(false);
    }
  };

  return (
    <>
      <div className="header">
        <div>
          <h1 className="title">Convenios / EPS</h1>
          <p className="subtitle">
            {convenios.length > 0
              ? `${convenios.length} convenios registrados`
              : "Gestión de las EPS y convenios del sistema"}
          </p>
        </div>
        <div className="header-actions">
          <button className="btn btn-outline" onClick={() => setShowImport(!showImport)}>
            📥 Importar CSV
          </button>
          <button className="btn btn-primary" onClick={abrirNuevo}>
            + Nuevo convenio
          </button>
        </div>
      </div>

      {mensaje && <div className="alert alert-success">{mensaje}</div>}
      {error && <div className="alert alert-error">{error}</div>}

      {/* Panel de importación */}
      {showImport && (
        <div className="card import-panel" style={{ marginBottom: 16 }}>
          <h3 style={{ marginBottom: 12 }}>Importar convenios desde CSV</h3>
          <p style={{ color: "#64748b", fontSize: 14, marginBottom: 12 }}>
            El CSV debe tener las columnas: <strong>nombre</strong>,{" "}
            <strong>regimen</strong> (opcional), <strong>activo</strong> (SI/NO).
          </p>
          {importResult ? (
            <div>
              <p style={{ color: "#166534", fontWeight: 600 }}>
                ✅ {importResult.insertados} insertados,{" "}
                {importResult.actualizados} actualizados
              </p>
              {importResult.detalle?.length > 0 && (
                <pre className="error-pre">{importResult.detalle.join("\n")}</pre>
              )}
              <button
                className="btn btn-outline btn-sm"
                onClick={() => {
                  setImportResult(null);
                  setImportFile(null);
                }}
              >
                Importar otro
              </button>
            </div>
          ) : (
            <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
              <input
                type="file"
                accept=".csv"
                onChange={handleImportFile}
                className="input"
                style={{ maxWidth: 300 }}
              />
              <button
                className="btn btn-primary"
                disabled={!importFile || importing}
                onClick={importar}
              >
                {importing ? "Importando..." : "Subir e importar"}
              </button>
            </div>
          )}
        </div>
      )}

      {/* Tabla */}
      <div className="card table-wrap">
        {loading ? (
          <div className="loading-screen" style={{ height: 200 }}>
            Cargando...
          </div>
        ) : convenios.length === 0 ? (
          <div className="empty-state">
            <p>No hay convenios registrados.</p>
            <button className="btn btn-primary" onClick={abrirNuevo}>
              + Crear primer convenio
            </button>
          </div>
        ) : (
          <table>
            <thead>
              <tr>
                <th>Nombre</th>
                <th>Régimen</th>
                <th>Estado</th>
                <th>Pacientes</th>
                <th>Acciones</th>
              </tr>
            </thead>
            <tbody>
              {convenios.map((c) => (
                <tr key={c.id}>
                  <td style={{ fontWeight: 600 }}>{c.nombre}</td>
                  <td>
                    <span
                      className={`badge ${
                        c.regimen === "CONTRIBUTIVO"
                          ? "badge-ok"
                          : c.regimen === "SUBSIDIADO"
                          ? "badge-pending"
                          : "badge-muted"
                      }`}
                    >
                      {c.regimen || "-"}
                    </span>
                  </td>
                  <td>
                    <span
                      className={`badge ${c.activo ? "badge-ok" : "badge-danger"}`}
                    >
                      {c.activo ? "Activo" : "Inactivo"}
                    </span>
                  </td>
                  <td>{c.total_pacientes?.toLocaleString() || 0}</td>
                  <td>
                    <div className="actions">
                      <button
                        className="btn btn-soft btn-sm"
                        onClick={() => abrirEditar(c)}
                      >
                        Editar
                      </button>
                      <button
                        className="btn btn-danger btn-sm"
                        onClick={() => eliminar(c)}
                        disabled={c.total_pacientes > 0}
                        title={
                          c.total_pacientes > 0
                            ? "No se puede eliminar: tiene pacientes vinculados"
                            : "Eliminar convenio"
                        }
                      >
                        Eliminar
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Modal crear/editar */}
      {showModal && (
        <div className="modal-overlay" onClick={() => setShowModal(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3>{editando ? "Editar convenio" : "Nuevo convenio"}</h3>
              <button
                type="button"
                className="btn btn-sm btn-outline"
                onClick={() => setShowModal(false)}
              >
                ✕
              </button>
            </div>
            <form className="modal-body form-grid" onSubmit={guardar}>
              <input
                required
                className="input full"
                placeholder="Nombre del convenio / EPS"
                value={form.nombre}
                onChange={(e) => setForm({ ...form, nombre: e.target.value })}
              />
              <select
                className="input"
                value={form.regimen}
                onChange={(e) => setForm({ ...form, regimen: e.target.value })}
              >
                <option value="">Sin régimen</option>
                <option value="CONTRIBUTIVO">Contributivo</option>
                <option value="SUBSIDIADO">Subsidiado</option>
                <option value="OTRO">Otro</option>
              </select>
              <label className="field full" style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                <input
                  type="checkbox"
                  checked={form.activo}
                  onChange={(e) => setForm({ ...form, activo: e.target.checked })}
                />
                <span style={{ fontWeight: 600, fontSize: 14 }}>Activo</span>
              </label>
              <div className="modal-actions full">
                <button
                  type="button"
                  className="btn btn-outline"
                  onClick={() => setShowModal(false)}
                >
                  Cancelar
                </button>
                <button disabled={saving} className="btn btn-primary">
                  {saving ? "Guardando..." : editando ? "Actualizar" : "Crear convenio"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      <style>{`
        .header-actions {
          display: flex;
          gap: 8px;
          flex-wrap: wrap;
        }
        .empty-state {
          padding: 40px 20px;
          text-align: center;
          color: #64748b;
        }
        .import-panel {
          background: #fffbeb;
          border-color: #fde68a;
        }
        .error-pre {
          background: #fef2f2;
          border: 1px solid #fecaca;
          border-radius: 10px;
          padding: 12px;
          font-size: 12px;
          max-height: 200px;
          overflow: auto;
          color: #991b1b;
          margin-top: 8px;
          white-space: pre-wrap;
        }
      `}</style>
    </>
  );
}
