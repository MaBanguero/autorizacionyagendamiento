import { useState, useRef, useEffect, useCallback } from "react";

/**
 * SearchableSelect — input con búsqueda y dropdown de opciones.
 * Props:
 *   value: string (valor actual)
 *   onChange: (value: string) => void
 *   onSearch: (query: string) => Promise<string[]> — función de búsqueda
 *   placeholder: string
 *   className: string
 *   initialOptions: string[] — opciones para mostrar antes de buscar
 */
export default function SearchableSelect({
  value,
  onChange,
  onSearch,
  placeholder = "Seleccionar...",
  className = "",
  initialOptions = [],
}) {
  const [open, setOpen] = useState(false);
  const [inputValue, setInputValue] = useState(value || "");
  const [options, setOptions] = useState(initialOptions);
  const [loading, setLoading] = useState(false);
  const ref = useRef(null);
  const debounceRef = useRef(null);
  const isFirstRender = useRef(true);

  // Sincronizar inputValue cuando value cambia externamente
  useEffect(() => {
    setInputValue(value || "");
  }, [value]);

  // Si hay initialOptions, cargarlas al montar
  useEffect(() => {
    if (isFirstRender.current && initialOptions.length > 0) {
      setOptions(initialOptions);
      isFirstRender.current = false;
    }
  }, [initialOptions]);

  const buscar = useCallback(
    async (q) => {
      if (!onSearch) return;
      setLoading(true);
      try {
        const result = await onSearch(q);
        setOptions(result);
      } catch {
        // silent
      } finally {
        setLoading(false);
      }
    },
    [onSearch]
  );

  // Buscar al escribir
  const handleInputChange = (e) => {
    const val = e.target.value;
    setInputValue(val);
    setOpen(true);

    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      buscar(val);
    }, 300);
  };

  // Al enfocar, si no hay opciones o el input está vacío, buscar
  const handleFocus = () => {
    setOpen(true);
    if (options.length === 0) {
      buscar(inputValue);
    }
  };

  const seleccionar = (opt) => {
    onChange(opt);
    setInputValue(opt);
    setOpen(false);
  };

  const handleKeyDown = (e) => {
    if (e.key === "Escape") setOpen(false);
    if (e.key === "Enter") {
      e.preventDefault();
      if (open && options.length > 0) {
        seleccionar(options[0]);
      }
    }
  };

  // Cerrar al hacer clic fuera
  useEffect(() => {
    const handler = (e) => {
      if (ref.current && !ref.current.contains(e.target)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  // Cleanup
  useEffect(() => {
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, []);

  return (
    <div className="searchable-select" ref={ref}>
      <input
        className={`input ${className}`}
        placeholder={placeholder}
        value={inputValue}
        onChange={handleInputChange}
        onFocus={handleFocus}
        onKeyDown={handleKeyDown}
        autoComplete="off"
      />
      {loading && <span className="searchable-spinner">⏳</span>}
      {open && (
        <div className="searchable-dropdown">
          {options.length === 0 && !loading && (
            <div className="searchable-empty">
              {inputValue ? "Sin resultados" : "Escribe para buscar..."}
            </div>
          )}
          {options.map((opt) => (
            <div
              key={opt}
              className={`searchable-option ${
                opt === value ? "searchable-option--selected" : ""
              }`}
              onClick={() => seleccionar(opt)}
              onMouseDown={(e) => e.preventDefault()}
            >
              {opt}
            </div>
          ))}
        </div>
      )}

      <style>{`
        .searchable-select {
          position: relative;
        }
        .searchable-spinner {
          position: absolute;
          right: 12px;
          top: 50%;
          transform: translateY(-50%);
          color: #94a3b8;
        }
        .searchable-dropdown {
          position: absolute;
          top: 100%;
          left: 0;
          right: 0;
          z-index: 100;
          background: white;
          border: 1px solid #e2e8f0;
          border-radius: 12px;
          box-shadow: 0 10px 30px rgba(15, 23, 42, 0.12);
          max-height: 240px;
          overflow-y: auto;
          margin-top: 4px;
        }
        .searchable-option {
          padding: 10px 14px;
          cursor: pointer;
          border-bottom: 1px solid #f1f5f9;
          font-size: 14px;
          line-height: 1.3;
        }
        .searchable-option:last-child { border-bottom: 0; }
        .searchable-option:hover { background: #f8fafc; }
        .searchable-option--selected {
          background: #eff6ff;
          color: #2563eb;
          font-weight: 600;
        }
        .searchable-empty {
          padding: 14px;
          color: #94a3b8;
          text-align: center;
          font-size: 13px;
        }
      `}</style>
    </div>
  );
}
