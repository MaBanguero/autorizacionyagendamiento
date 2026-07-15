import { useState, useRef, useCallback } from "react";
import { useNavigate, Link } from "react-router-dom";
import api from "../../../api/client";

const COLUMNAS_ESPERADAS = [
  "tipodocu",
  "identificacion",
  "nombre1",
  "nombre2",
  "apellido1",
  "apellido2",
  "sexo",
  "fechanacimiento",
  "convenionombre",
];

export default function ImportPacientesPage() {
  const [file, setFile] = useState(null);
  const [preview, setPreview] = useState([]);
  const [dragOver, setDragOver] = useState(false);
  const [importing, setImporting] = useState(false);
  const [resultado, setResultado] = useState(null);
  const [error, setError] = useState("");
  const fileInputRef = useRef(null);
  const navigate = useNavigate();

  const procesarArchivo = useCallback((archivo) => {
    if (!archivo) return;

    // Validar extensión
    const ext = archivo.name.split(".").pop().toLowerCase();
    if (!["csv", "tsv", "txt"].includes(ext)) {
      setError("Solo se admiten archivos .csv, .tsv o .txt con formato tabular.");
      return;
    }

    setFile(archivo);
    setError("");
    setResultado(null);

    // Leer primeras líneas para preview
    const reader = new FileReader();
    reader.onload = (e) => {
      const text = e.target.result;
      const lines = text.split("\n").filter((l) => l.trim());
      const header = lines[0].split("\t");
      const data = lines.slice(1, 6).map((line) => {
        const cols = line.split("\t");
        return header.reduce((obj, h, i) => {
          obj[h.trim()] = (cols[i] || "").trim();
          return obj;
        }, {});
      });

      // Validar columnas esperadas
      const columnasArchivo = header.map((h) => h.trim());
      const faltantes = COLUMNAS_ESPERADAS.filter(
        (c) => !columnasArchivo.includes(c)
      );
      if (faltantes.length > 0) {
        setError(
          `El archivo no tiene las columnas esperadas. Faltan: ${faltantes.join(
            ", "
          )}. Las columnas deben ser separadas por TAB.`
        );
        setFile(null);
        setPreview([]);
        return;
      }

      setPreview({ header: columnasArchivo, rows: data, total: lines.length - 1 });
    };
    reader.readAsText(archivo.slice(0, 50000)); // solo primeras ~50KB
  }, []);

  const handleDrop = useCallback(
    (e) => {
      e.preventDefault();
      setDragOver(false);
      const archivo = e.dataTransfer.files[0];
      procesarArchivo(archivo);
    },
    [procesarArchivo]
  );

  const handleDragOver = (e) => {
    e.preventDefault();
    setDragOver(true);
  };

  const handleDragLeave = () => setDragOver(false);

  const handleFileSelect = (e) => {
    const archivo = e.target.files[0];
    procesarArchivo(archivo);
  };

  const importar = async () => {
    if (!file) return;

    setImporting(true);
    setError("");

    try {
      const formData = new FormData();
      formData.append("file", file);

      const res = await api.post("/api/pacientes/importar", formData, {
        headers: { "Content-Type": "multipart/form-data" },
        timeout: 120000, // 2 min para archivos grandes
      });

      setResultado(res.data);
    } catch (err) {
      setError(
        err.response?.data?.detail || "Error al importar el archivo."
      );
    } finally {
      setImporting(false);
    }
  };

  return (
    <>
      <div className="header">
        <div>
          <h1 className="title">Importar pacientes</h1>
          <p className="subtitle">
            Carga un archivo CSV/TSV con los datos de pacientes de ESENORTE3.
          </p>
        </div>
        <Link to="/pacientes" className="btn btn-outline">
          ← Volver
        </Link>
      </div>

      {error && <div className="alert alert-error">{error}</div>}

      {resultado ? (
        <div className="card">
          <h3>✅ Importación completada</h3>
          <div className="resultado-grid">
            <div className="resultado-item">
              <span className="resultado-valor">{resultado.insertados}</span>
              <span className="resultado-label">Insertados</span>
            </div>
            <div className="resultado-item">
              <span className="resultado-valor">{resultado.omitidos_duplicados}</span>
              <span className="resultado-label">Duplicados omitidos</span>
            </div>
            <div className="resultado-item">
              <span className="resultado-valor">{resultado.total_procesadas}</span>
              <span className="resultado-label">Filas procesadas</span>
            </div>
            <div className="resultado-item">
              <span className="resultado-valor">{resultado.errores + (resultado.errores_parse || 0)}</span>
              <span className="resultado-label">Errores</span>
            </div>
          </div>
          {resultado.detalle_errores?.length > 0 && (
            <details style={{ marginTop: 16 }}>
              <summary>Ver detalles de errores ({resultado.detalle_errores.length})</summary>
              <pre className="error-pre">
                {resultado.detalle_errores.join("\n")}
              </pre>
            </details>
          )}
          <div className="resultado-actions">
            <button
              className="btn btn-primary"
              onClick={() => navigate("/pacientes")}
            >
              Ver pacientes
            </button>
            <button
              className="btn btn-outline"
              onClick={() => {
                setResultado(null);
                setFile(null);
                setPreview([]);
              }}
            >
              Importar otro archivo
            </button>
          </div>
        </div>
      ) : (
        <>
          {/* Drop zone */}
          <div
            className={`dropzone ${dragOver ? "dropzone--active" : ""}`}
            onDrop={handleDrop}
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onClick={() => fileInputRef.current?.click()}
          >
            <input
              ref={fileInputRef}
              type="file"
              accept=".csv,.tsv,.txt"
              onChange={handleFileSelect}
              style={{ display: "none" }}
            />
            <div className="dropzone-icon">📄</div>
            {file ? (
              <div>
                <strong>{file.name}</strong>
                <p className="dropzone-size">
                  {(file.size / 1024 / 1024).toFixed(1)} MB
                </p>
              </div>
            ) : (
              <div>
                <p className="dropzone-text">
                  Arrastra el archivo aquí o haz clic para seleccionarlo
                </p>
                <p className="dropzone-hint">
                  Formato: TSV/CSV con columnas separadas por TAB · Columnas
                  esperadas: tipodocu, identificacion, nombre1, nombre2,
                  apellido1, apellido2, sexo, fechanacimiento, convenionombre
                </p>
              </div>
            )}
          </div>

          {/* Preview */}
          {preview.rows && preview.rows.length > 0 && (
            <div className="card" style={{ marginTop: 16 }}>
              <h3>
                Vista previa · {preview.total.toLocaleString()} filas totales
              </h3>
              <div className="table-wrap" style={{ marginTop: 12 }}>
                <table>
                  <thead>
                    <tr>
                      {preview.header.map((h) => (
                        <th key={h}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {preview.rows.map((row, i) => (
                      <tr key={i}>
                        {preview.header.map((h) => (
                          <td key={h}>{row[h] || ""}</td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {preview.total > 5 && (
                <p style={{ color: "#94a3b8", fontSize: 13, marginTop: 8 }}>
                  Mostrando las primeras 5 filas de {preview.total.toLocaleString()}
                </p>
              )}
              <button
                className="btn btn-primary"
                style={{ marginTop: 16 }}
                disabled={importing}
                onClick={importar}
              >
                {importing
                  ? "Importando... (puede tomar varios minutos)"
                  : `Importar ${preview.total.toLocaleString()} pacientes`}
              </button>
            </div>
          )}
        </>
      )}

      <style>{`
        .dropzone {
          border: 2px dashed #cbd5e1;
          border-radius: 18px;
          padding: 48px 24px;
          text-align: center;
          cursor: pointer;
          transition: all 0.2s;
          background: white;
        }
        .dropzone:hover,
        .dropzone--active {
          border-color: #2563eb;
          background: #eff6ff;
        }
        .dropzone-icon {
          font-size: 48px;
          margin-bottom: 12px;
        }
        .dropzone-text {
          color: #475569;
          font-size: 16px;
          font-weight: 600;
          margin: 0 0 8px;
        }
        .dropzone-hint {
          color: #94a3b8;
          font-size: 13px;
          max-width: 480px;
          margin: 0 auto;
          line-height: 1.5;
        }
        .dropzone-size {
          color: #94a3b8;
          font-size: 13px;
          margin: 4px 0 0;
        }
        .resultado-grid {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(140px, 1fr));
          gap: 16px;
          margin-top: 20px;
        }
        .resultado-item {
          background: #f8fafc;
          border-radius: 14px;
          padding: 20px;
          text-align: center;
        }
        .resultado-valor {
          display: block;
          font-size: 32px;
          font-weight: 850;
          color: #0f172a;
        }
        .resultado-label {
          display: block;
          font-size: 13px;
          color: #64748b;
          margin-top: 4px;
        }
        .resultado-actions {
          display: flex;
          gap: 10px;
          margin-top: 20px;
          flex-wrap: wrap;
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
