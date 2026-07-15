import axios from "axios";

const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || "http://127.0.0.1:8081",
  headers: {
    "Content-Type": "application/json",
  },
});

export const API_BASE_URL = import.meta.env.VITE_API_URL || "http://127.0.0.1:8081";

export default api;
