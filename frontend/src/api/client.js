import axios from "axios";

// En desarrollo usa el VITE_API_URL del .env (localhost:8081)
// En produccion (nginx proxy reverso) usa cadena vacia → misma origen
const API_URL = import.meta.env.VITE_API_URL || "";

const api = axios.create({
  baseURL: API_URL,
  headers: {
    "Content-Type": "application/json",
  },
});

export const API_BASE_URL = API_URL;

export default api;
