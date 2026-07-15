import { useEffect, useState, useCallback } from "react";
import { Link } from "react-router-dom";
import api from "../../../api/client";

export default function PacientesPage() {
  const [pacientes, setPacientes] = useState([]);
  const [total, setTotal] = useState(0);
  const [query, setQuery] = useState("");
  const [limit, setLimit] = useState(50);
  const [offset, setOffset] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [mensaje, setMensaje] = useState("");

  const cargar = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const params = { limit, offset };
      if (query.trim()) params.q = query.trim();
      const res = await api.get("/api/pacientes", { params });
      setPacientes(res.data.pacientes || []);
      setTotal(res.data.total || 0);
    } catch (err) {
      setError(err.response?.data?.detail || "Error cargando pacientes.");
    } finally {
      setLoading(false);
    }
  }, [query, limit, offset]);

  useEffect(() => {
    cargar();
  }, [cargar]);

  // Debounce search
  const [searchInput, setSearchInput] = useState("");
  useEffect(() => {
    const t = setTimeout(() => {
      setQuery(searchInput);
      setOffset(0);
    }, 400);
    return () => clearTimeout(t);
  }, [searchInput]);

  const totalPaginas = Math.ceil(total / limit);
  const paginaActual = Math.floor(offset / limit) + 1;

  const irPagina = (pagina) => {
    setOffset((pagina - 1) * limit);
  };

  return (
    <>
      <div className="header">
        <div>
          <h1 className="title">Pacientes</h1>
          <p className="subtitle">
            {total > 0
              ? `${total.toLocaleString()} pacientes registrados`
              : "Gestión de pacientes del sistema"}
          </p>
        </div>
        <Link to="/pacientes/importar" className="btn btn-primary">
          + Importar CSV
        </Link>
      </div>

      {mensaje && <div className="alert alert-success">{mensaje}</div>}
      {error && <div className="alert alert-error">{error}</div>}

      <div className="toolbar">
        <input
          className="input"
          style={{ maxWidth: 360 }}
          placeholder="Buscar por nombre o documento..."
          value={searchInput}
          onChange={(e) => setSearchInput(e.target.value)}
        />
        <select
          className="input"
          style={{ maxWidth: 120 }}
          value={limit}
          onChange={(e) => {
            setLimit(Number(e.target.value));
            setOffset(0);
          }}
        >
          <option value={25}>25</option>
          <option value={50}>50</option>
          <option value={100}>100</option>
          <option value={200}>200</option>
        </select>
        <span className="pagination-info">
          {total > 0
            ? `${offset + 1}-${Math.min(offset + limit, total)} de ${total.toLocaleString()}`
            : ""}
        </span>
      </div>

      <div className="card table-wrap">
        {loading ? (
          <div className="loading-screen" style={{ height: 200 }}>
            Cargando...
          </div>
        ) : pacientes.length === 0 ? (
          <div className="empty-state">
            <p>No se encontraron pacientes.</p>
            <Link to="/pacientes/importar" className="btn btn-outline">
              Importar desde CSV
            </Link>
          </div>
        ) : (
          <table>
            <thead>
              <tr>
                <th>Documento</th>
                <th>Nombre</th>
                <th>Sexo</th>
                <th>Fecha Nac.</th>
                <th>Convenio</th>
                <th>Régimen</th>
                <th>Teléfono</th>
              </tr>
            </thead>
            <tbody>
              {pacientes.map((p) => (
                <tr key={p.id}>
                  <td>
                    <span className="badge badge-muted">
                      {p.tipo_documento} {p.numero_documento}
                    </span>
                  </td>
                  <td>{p.nombre}</td>
                  <td>{p.sexo === "M" ? "Masculino" : p.sexo === "F" ? "Femenino" : "Otro"}</td>
                  <td>{p.fecha_nacimiento || "-"}</td>
                  <td>{p.convenio}</td>
                  <td>
                    <span
                      className={`badge ${
                        p.regimen === "CONTRIBUTIVO"
                          ? "badge-ok"
                          : p.regimen === "SUBSIDIADO"
                          ? "badge-pending"
                          : "badge-muted"
                      }`}
                    >
                      {p.regimen}
                    </span>
                  </td>
                  <td>{p.telefono}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Paginación */}
      {totalPaginas > 1 && (
        <div className="pagination">
          <button
            className="btn btn-soft btn-sm"
            disabled={paginaActual <= 1}
            onClick={() => irPagina(1)}
          >
            ⏮
          </button>
          <button
            className="btn btn-soft btn-sm"
            disabled={paginaActual <= 1}
            onClick={() => irPagina(paginaActual - 1)}
          >
            ◀
          </button>
          <span className="pagination-pages">
            {Array.from({ length: Math.min(totalPaginas, 7) }, (_, i) => {
              let pagina;
              if (totalPaginas <= 7) {
                pagina = i + 1;
              } else if (paginaActual <= 4) {
                pagina = i + 1;
              } else if (paginaActual >= totalPaginas - 3) {
                pagina = totalPaginas - 6 + i;
              } else {
                pagina = paginaActual - 3 + i;
              }
              return (
                <button
                  key={pagina}
                  className={`btn btn-sm ${pagina === paginaActual ? "btn-primary" : "btn-soft"}`}
                  onClick={() => irPagina(pagina)}
                >
                  {pagina}
                </button>
              );
            })}
          </span>
          <button
            className="btn btn-soft btn-sm"
            disabled={paginaActual >= totalPaginas}
            onClick={() => irPagina(paginaActual + 1)}
          >
            ▶
          </button>
          <button
            className="btn btn-soft btn-sm"
            disabled={paginaActual >= totalPaginas}
            onClick={() => irPagina(totalPaginas)}
          >
            ⏭
          </button>
        </div>
      )}

      <style>{`
        .empty-state {
          padding: 40px 20px;
          text-align: center;
          color: #64748b;
        }
        .empty-state .btn { margin-top: 12px; }
        .pagination {
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 6px;
          margin-top: 16px;
          flex-wrap: wrap;
        }
        .pagination-info {
          color: #64748b;
          font-size: 14px;
          white-space: nowrap;
        }
        .pagination-pages {
          display: flex;
          gap: 4px;
        }
      `}</style>
    </>
  );
}
