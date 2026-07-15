import { useState, useRef, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import api from "../../../api/client";
import { pacienteService } from "../../../api/services";
import SearchableSelect from "../../../components/SearchableSelect";

const initialForm = {
  numero_orden: "",
  estudio: "",
  paciente: {
    nombre: "",
    tipo_documento: "CC",
    numero_documento: "",
    sexo: "M",
    direccion: "",
    telefono: "",
    fecha_nacimiento: "",
    convenio: "",
    regimen: "Contributivo",
  },
};

const initialNewPaciente = {
  tipo_documento: "CC",
  numero_documento: "",
  nombre: "",
  sexo: "M",
  direccion: "",
  telefono: "",
  fecha_nacimiento: "",
  convenio: "",
  regimen: "Contributivo",
};

export default function CreateOrderPage() {
  const [form, setForm] = useState(initialForm);
  const [mensaje, setMensaje] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  // Búsqueda de pacientes
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState([]);
  const [searching, setSearching] = useState(false);
  const [showResults, setShowResults] = useState(false);
  const [pacienteSeleccionado, setPacienteSeleccionado] = useState(null);
  const searchRef = useRef(null);
  const debounceRef = useRef(null);

  // Modal nuevo paciente
  const [showNewPaciente, setShowNewPaciente] = useState(false);
  const [newPaciente, setNewPaciente] = useState(initialNewPaciente);
  const [creatingPaciente, setCreatingPaciente] = useState(false);

  // Similares (posibles duplicados por misspelling)
  const [similares, setSimilares] = useState([]);
  const [similaresLoading, setSimilaresLoading] = useState(false);

  const update = (field, value) => setForm({ ...form, [field]: value });
  const updatePaciente = (field, value) =>
    setForm({ ...form, paciente: { ...form.paciente, [field]: value } });

  // Buscar posibles duplicados por nombre similar
  const checkSimilares = useCallback(async (nombre) => {
    if (!nombre || nombre.trim().length < 5) {
      setSimilares([]);
      return;
    }
    setSimilaresLoading(true);
    try {
      const res = await api.get("/api/pacientes/similares", {
        params: { nombre: nombre.trim(), documento: form.paciente.numero_documento },
      });
      setSimilares(res.data || []);
    } catch {
      setSimilares([]);
    } finally {
      setSimilaresLoading(false);
    }
  }, [form.paciente.numero_documento]);

  // Búsqueda con debounce
  const handleSearch = (value) => {
    setSearchQuery(value);
    setPacienteSeleccionado(null);

    if (debounceRef.current) clearTimeout(debounceRef.current);

    if (value.trim().length < 3) {
      setSearchResults([]);
      setShowResults(false);
      return;
    }

    debounceRef.current = setTimeout(async () => {
      setSearching(true);
      try {
        // Buscar por documento primero
        const byDoc = await pacienteService.buscar(value.trim(), "documento");
        if (byDoc.length > 0) {
          setSearchResults(byDoc);
          setShowResults(true);
          setSearching(false);
          return;
        }

        // Si no, buscar por nombre
        const byName = await pacienteService.buscar(value.trim(), "nombre");
        setSearchResults(byName);
        setShowResults(byName.length > 0);
      } catch (err) {
        console.error("Error buscando pacientes:", err);
      } finally {
        setSearching(false);
      }
    }, 400);
  };

  const seleccionarPaciente = (paciente) => {
    setPacienteSeleccionado(paciente);
    setForm({
      ...form,
      paciente: {
        nombre: paciente.nombre || "",
        tipo_documento: paciente.tipo_documento || "CC",
        numero_documento: paciente.numero_documento || "",
        sexo: paciente.sexo || "M",
        direccion: paciente.direccion || "",
        telefono: paciente.telefono || "",
        fecha_nacimiento: paciente.fecha_nacimiento
          ? paciente.fecha_nacimiento.substring(0, 10)
          : "",
        convenio: paciente.convenio || "",
        regimen: paciente.regimen || "Contributivo",
      },
    });
    setSearchQuery(
      `${paciente.nombre} (${paciente.tipo_documento} ${paciente.numero_documento})`
    );
    setShowResults(false);
  };

  const limpiarBusqueda = () => {
    setSearchQuery("");
    setSearchResults([]);
    setShowResults(false);
    setPacienteSeleccionado(null);
    setForm({
      ...form,
      paciente: { ...initialForm.paciente },
    });
  };

  const abrirNuevoPaciente = () => {
    setNewPaciente(initialNewPaciente);
    // Si ya se escribió algo en la búsqueda, pre-rellenar
    if (searchQuery.trim() && !pacienteSeleccionado) {
      // Intentar detectar si es un número de documento
      const soloNumeros = searchQuery.replace(/[^0-9]/g, "");
      if (soloNumeros.length >= 4) {
        setNewPaciente((prev) => ({
          ...prev,
          numero_documento: soloNumeros,
        }));
      } else {
        setNewPaciente((prev) => ({
          ...prev,
          nombre: searchQuery.trim(),
        }));
      }
    }
    setShowNewPaciente(true);
  };

  const crearPacienteYSeleccionar = async (e) => {
    e.preventDefault();
    setCreatingPaciente(true);
    setError("");

    try {
      const paciente = await pacienteService.crear(newPaciente);
      seleccionarPaciente(paciente);
      setShowNewPaciente(false);
      setMensaje("Paciente creado correctamente.");
      setTimeout(() => setMensaje(""), 3000);
    } catch (err) {
      setError(
        err.response?.data?.detail || "Error creando el paciente."
      );
    } finally {
      setCreatingPaciente(false);
    }
  };

  // Cerrar resultados al hacer clic fuera
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (searchRef.current && !searchRef.current.contains(e.target)) {
        setShowResults(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const buscarConvenios = useCallback(async (q) => {
    const res = await api.get("/api/convenios", { params: { q } });
    return (res.data || []).filter((c) => c.activo).map((c) => c.nombre);
  }, []);

  // Cleanup del debounce
  useEffect(() => {
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, []);

  const crearOrden = async (e) => {
    e.preventDefault();
    setMensaje("");
    setError("");
    setLoading(true);

    try {
      await api.post("/api/ordenes", {
        id: crypto.randomUUID(),
        numero_orden: form.numero_orden.trim(),
        estudio: form.estudio.trim(),
        paciente: {
          ...form.paciente,
          // Si hay paciente seleccionado, los datos ya están correctos
        },
        estado: "PENDIENTE",
        documento_generado: false,
      });

      setMensaje("Orden creada correctamente.");
      setForm(initialForm);
      setPacienteSeleccionado(null);
      setSearchQuery("");
      setTimeout(() => navigate("/ordenes"), 700);
    } catch (err) {
      setError(
        err.response?.data?.detail ||
          "Error creando la orden. Verifica los datos."
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <div className="header">
        <div>
          <h1 className="title">Nueva orden</h1>
          <p className="subtitle">
            Busca un paciente existente o crea uno nuevo para registrar una
            orden médica.
          </p>
        </div>
      </div>

      {mensaje && <div className="alert alert-success">{mensaje}</div>}
      {error && <div className="alert alert-error">{error}</div>}

      {/* Buscador de pacientes */}
      <div className="card">
        <h3 style={{ marginBottom: "0.5rem" }}>Paciente</h3>
        <div className="paciente-search" ref={searchRef}>
          <div className="search-bar">
            <input
              className="input"
              placeholder="Buscar por documento o nombre (mín. 3 caracteres)..."
              value={searchQuery}
              onChange={(e) => handleSearch(e.target.value)}
              onFocus={() => {
                if (searchResults.length > 0) setShowResults(true);
              }}
            />
            {pacienteSeleccionado && (
              <button
                type="button"
                className="btn btn-outline btn-sm"
                onClick={limpiarBusqueda}
                title="Limpiar búsqueda"
              >
                ✕
              </button>
            )}
            {searching && <span className="search-spinner">⏳</span>}
          </div>

          {showResults && searchResults.length > 0 && (
            <div className="search-results">
              {searchResults.map((p) => (
                <div
                  key={p.id}
                  className="search-result-item"
                  onClick={() => seleccionarPaciente(p)}
                >
                  <strong>{p.nombre}</strong>
                  <span className="search-result-doc">
                    {p.tipo_documento} {p.numero_documento}
                  </span>
                  <span className="search-result-info">
                    {p.convenio} · {p.regimen}
                  </span>
                </div>
              ))}
            </div>
          )}

          {showResults && searchResults.length === 0 && !searching && (
            <div className="search-results search-results--empty">
              <p>No se encontraron pacientes.</p>
              <button
                type="button"
                className="btn btn-outline btn-sm"
                onClick={abrirNuevoPaciente}
              >
                + Crear nuevo paciente
              </button>
            </div>
          )}

          {!searchQuery && (
            <p className="search-helper">
              También puedes crear un paciente nuevo llenando el formulario
              abajo.
            </p>
          )}
        </div>

        {/* Indicador de paciente seleccionado */}
        {pacienteSeleccionado && (
          <div className="paciente-seleccionado-badge">
            ✅ Paciente seleccionado: <strong>{pacienteSeleccionado.nombre}</strong>{" "}
            ({pacienteSeleccionado.tipo_documento}{" "}
            {pacienteSeleccionado.numero_documento})
          </div>
        )}
      </div>

      {/* Formulario de orden */}
      <form className="card form-grid" onSubmit={crearOrden}>
        <input
          required
          className="input"
          placeholder="Número de orden"
          value={form.numero_orden}
          onChange={(e) => update("numero_orden", e.target.value)}
        />
        <input
          required
          className="input"
          placeholder="Estudio / procedimiento"
          value={form.estudio}
          onChange={(e) => update("estudio", e.target.value)}
        />

        <h4 className="full">Datos del paciente</h4>

        <div className="field full">
          <input
            required
            className="input"
            placeholder="Nombre completo del paciente"
            value={form.paciente.nombre}
            onChange={(e) => {
              updatePaciente("nombre", e.target.value);
              if (e.target.value.trim().length >= 5) {
                setTimeout(() => checkSimilares(e.target.value), 300);
              } else {
                setSimilares([]);
              }
            }}
            onBlur={() => {
              if (form.paciente.nombre.trim().length >= 5 && !pacienteSeleccionado) {
                checkSimilares(form.paciente.nombre);
              }
            }}
          />
          {similares.length > 0 && (
            <div className="similares-warning">
              <p className="similares-title">⚠️ Posibles duplicados encontrados:</p>
              {similares.map((s) => (
                <div
                  key={s.id}
                  className="similar-item"
                  onClick={() => seleccionarPaciente(s)}
                >
                  <strong>{s.nombre}</strong>
                  <span className="search-result-doc">
                    {s.tipo_documento} {s.numero_documento}
                  </span>
                  <span className="search-result-info">{s.convenio}</span>
                </div>
              ))}
              <p className="similares-hint">
                ¿Tal vez el paciente ya existe? Haz clic en uno para
                seleccionarlo, o ignora esta advertencia y continúa.
              </p>
            </div>
          )}
          {similaresLoading && (
            <span className="similares-loading">Verificando duplicados...</span>
          )}
        </div>
        <input
          required
          className="input"
          placeholder="Número de documento"
          value={form.paciente.numero_documento}
          onChange={(e) => updatePaciente("numero_documento", e.target.value)}
        />

        <select
          className="input"
          value={form.paciente.tipo_documento}
          onChange={(e) => updatePaciente("tipo_documento", e.target.value)}
        >
          <option value="CC">CC</option>
          <option value="TI">TI</option>
          <option value="CE">CE</option>
          <option value="PT">PT</option>
          <option value="RC">RC</option>
          <option value="PA">PA</option>
        </select>
        <select
          className="input"
          value={form.paciente.sexo}
          onChange={(e) => updatePaciente("sexo", e.target.value)}
        >
          <option value="M">Masculino</option>
          <option value="F">Femenino</option>
          <option value="O">Otro</option>
        </select>

        <input
          required
          className="input"
          type="date"
          value={form.paciente.fecha_nacimiento}
          onChange={(e) => updatePaciente("fecha_nacimiento", e.target.value)}
        />
        <input
          required
          className="input"
          placeholder="Teléfono"
          value={form.paciente.telefono}
          onChange={(e) => updatePaciente("telefono", e.target.value)}
        />
        <input
          required
          className="input full"
          placeholder="Dirección"
          value={form.paciente.direccion}
          onChange={(e) => updatePaciente("direccion", e.target.value)}
        />
        <SearchableSelect
          value={form.paciente.convenio}
          onChange={(val) => updatePaciente("convenio", val)}
          onSearch={buscarConvenios}
          placeholder="Buscar convenio / EPS..."
          className="full"
        />
        <select
          className="input"
          value={form.paciente.regimen}
          onChange={(e) => updatePaciente("regimen", e.target.value)}
        >
          <option value="Contributivo">Contributivo</option>
          <option value="Subsidiado">Subsidiado</option>
          <option value="Particular">Particular</option>
          <option value="OTRO">Otro</option>
        </select>
        <button disabled={loading} className="btn btn-primary full">
          {loading ? "Creando..." : "Crear orden"}
        </button>
      </form>

      {/* Modal: Nuevo paciente */}
      {showNewPaciente && (
        <div className="modal-overlay" onClick={() => setShowNewPaciente(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3>Crear nuevo paciente</h3>
              <button
                type="button"
                className="btn btn-sm btn-outline"
                onClick={() => setShowNewPaciente(false)}
              >
                ✕
              </button>
            </div>
            <form className="modal-body form-grid" onSubmit={crearPacienteYSeleccionar}>
              <input
                required
                className="input"
                placeholder="Nombre completo"
                value={newPaciente.nombre}
                onChange={(e) =>
                  setNewPaciente({ ...newPaciente, nombre: e.target.value })
                }
              />
              <input
                required
                className="input"
                placeholder="Número de documento"
                value={newPaciente.numero_documento}
                onChange={(e) =>
                  setNewPaciente({
                    ...newPaciente,
                    numero_documento: e.target.value,
                  })
                }
              />
              <select
                className="input"
                value={newPaciente.tipo_documento}
                onChange={(e) =>
                  setNewPaciente({
                    ...newPaciente,
                    tipo_documento: e.target.value,
                  })
                }
              >
                <option value="CC">CC</option>
                <option value="TI">TI</option>
                <option value="CE">CE</option>
                <option value="PT">PT</option>
                <option value="RC">RC</option>
              </select>
              <select
                className="input"
                value={newPaciente.sexo}
                onChange={(e) =>
                  setNewPaciente({ ...newPaciente, sexo: e.target.value })
                }
              >
                <option value="M">Masculino</option>
                <option value="F">Femenino</option>
                <option value="O">Otro</option>
              </select>
              <input
                required
                className="input"
                type="date"
                value={newPaciente.fecha_nacimiento}
                onChange={(e) =>
                  setNewPaciente({
                    ...newPaciente,
                    fecha_nacimiento: e.target.value,
                  })
                }
              />
              <input
                required
                className="input"
                placeholder="Teléfono"
                value={newPaciente.telefono}
                onChange={(e) =>
                  setNewPaciente({ ...newPaciente, telefono: e.target.value })
                }
              />
              <input
                required
                className="input full"
                placeholder="Dirección"
                value={newPaciente.direccion}
                onChange={(e) =>
                  setNewPaciente({
                    ...newPaciente,
                    direccion: e.target.value,
                  })
                }
              />
              <SearchableSelect
                value={newPaciente.convenio}
                onChange={(val) => setNewPaciente({ ...newPaciente, convenio: val })}
                onSearch={buscarConvenios}
                placeholder="Buscar convenio / EPS..."
                className="full"
              />
              <select
                className="input"
                value={newPaciente.regimen}
                onChange={(e) =>
                  setNewPaciente({ ...newPaciente, regimen: e.target.value })
                }
              >
                <option value="Contributivo">Contributivo</option>
                <option value="Subsidiado">Subsidiado</option>
                <option value="Particular">Particular</option>
                <option value="OTRO">Otro</option>
              </select>
              <div className="modal-actions full">
                <button
                  type="button"
                  className="btn btn-outline"
                  onClick={() => setShowNewPaciente(false)}
                >
                  Cancelar
                </button>
                <button
                  disabled={creatingPaciente}
                  className="btn btn-primary"
                >
                  {creatingPaciente
                    ? "Creando..."
                    : "Crear paciente y seleccionar"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
}
