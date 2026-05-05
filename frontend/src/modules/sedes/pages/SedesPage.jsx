import { useEffect, useState } from "react";
import api from "../../../api/client";

export default function SedesPage() {
  const [sedes, setSedes] = useState([]);
  const [error, setError] = useState("");

  useEffect(() => {
    api.get("/api/sedes")
      .then((res) => setSedes(res.data))
      .catch((err) => setError(err.response?.data?.detail || "No se pudieron cargar las sedes"));
  }, []);

  return (
    <>
      <div className="header"><div><h1 className="title">Sedes</h1><p className="subtitle">Centros disponibles para agendamiento.</p></div></div>
      {error && <div className="alert alert-error">{error}</div>}
      <div className="grid grid-2">
        {sedes.map((s) => <div className="card" key={s.id}><h3>{s.nombre}</h3><p>Horario: {s.hora_apertura} - {s.hora_cierre}</p><p>Capacidad diaria: <strong>{s.capacidad_diaria}</strong></p></div>)}
      </div>
    </>
  );
}
