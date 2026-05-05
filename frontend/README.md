# Frontend Médico - Autorización y Agendamiento

## Instalar

```bash
npm install
cp .env.example .env
npm run dev
```

## Configuración

En `.env` ajusta la URL del backend:

```env
VITE_API_URL=http://127.0.0.1:8000
```

## Incluye

- Dashboard
- Listado de órdenes
- Crear nueva orden
- Autorizar y rechazar
- Agendamiento con bloqueo de días anteriores y slots pasados
- Documentos pendientes/generados
- Descarga de PDF
- Sedes
