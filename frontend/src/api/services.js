import api, { API_BASE_URL } from './client';

export const dashboardService = {
  getResumen: async () => (await api.get('/api/dashboard/resumen')).data,
};

export const sedeService = {
  list: async () => (await api.get('/api/sedes')).data,
  get: async (sedeId) => (await api.get(`/api/sedes/${sedeId}`)).data,
  disponibilidad: async (sedeId, fecha) =>
    (await api.get(`/api/sedes/${sedeId}/disponibilidad`, { params: { fecha } })).data,
};

export const ordenService = {
  list: async (params = {}) => (await api.get('/api/ordenes', { params })).data,
  get: async (ordenId) => (await api.get(`/api/ordenes/${ordenId}`)).data,
  buscar: async (numeroOrden) =>
    (await api.get('/api/ordenes/buscar', { params: { numero_orden: numeroOrden } })).data,
  autorizar: async (ordenId, usuarioId) =>
    (await api.post(`/api/ordenes/${ordenId}/autorizar`, { usuario_id: usuarioId })).data,
  rechazar: async (ordenId, usuarioId, motivo = '') =>
    (await api.post(`/api/ordenes/${ordenId}/rechazar`, { usuario_id: usuarioId, motivo })).data,
  agendar: async (ordenId, sedeId, fechaHora) =>
    (await api.post(`/api/ordenes/${ordenId}/agendar`, { sede_id: sedeId, fecha_hora: fechaHora })).data,
  generarPdf: async (ordenId) => (await api.post(`/api/ordenes/${ordenId}/generar-pdf`)).data,
};

export const documentoService = {
  pendientes: async (params = {}) => (await api.get('/api/documentos/pendientes', { params })).data,
  generados: async (params = {}) => (await api.get('/api/documentos/generados', { params })).data,
  generarMasivo: async (sedeId) =>
    (await api.post('/api/documentos/generacion-masiva', null, { params: { sede_id: sedeId || undefined } })).data,
  descargarUrl: (ordenId) => {
    const token = localStorage.getItem('token');
    return `${API_BASE_URL}/api/documentos/${ordenId}/descargar${token ? `?token=${encodeURIComponent(token)}` : ''}`;
  },
};
