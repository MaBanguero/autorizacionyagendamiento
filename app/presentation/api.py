from fastapi import FastAPI, HTTPException, BackgroundTasks, Depends
from pydantic import BaseModel
from datetime import datetime

# Asumiremos un contenedor de inyección de dependencias configurado
# from core.dependencies import get_agendamiento_service, get_autorizacion_service, get_documento_service
# Para este ejemplo, omitimos la implementación exacta del contenedor.

app = FastAPI(title="Motor de Agendamiento y Autorizaciones")

# --- DTOs (Data Transfer Objects) ---
class AgendarRequest(BaseModel):
    sede_id: str
    fecha_hora: datetime

class AutorizarRequest(BaseModel):
    usuario_id: str # En producción esto vendría del token JWT

# --- Endpoints ---
@app.post("/api/ordenes/{orden_id}/autorizar")
def autorizar_orden(orden_id: str, req: AutorizarRequest, auth_service = Depends(get_autorizacion_service)):
    try:
        orden = auth_service.autorizar_orden(orden_id, req.usuario_id)
        return {"mensaje": "Orden autorizada lógicamente", "fecha": orden.fecha_autorizacion}
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))

@app.post("/api/ordenes/{orden_id}/agendar")
def agendar_orden(orden_id: str, req: AgendarRequest, sched_service = Depends(get_agendamiento_service)):
    try:
        orden = sched_service.agendar_cita(orden_id, req.sede_id, req.fecha_hora)
        return {"mensaje": "Cita agendada con éxito", "fecha_cita": orden.fecha_cita}
    except ValueError as e:
        # Errores de negocio (Cupo lleno, fuera de horario, etc)
        raise HTTPException(status_code=422, detail=str(e))

@app.post("/api/ordenes/{orden_id}/generar-pdf")
def generar_pdf_individual(orden_id: str, doc_service = Depends(get_documento_service)):
    try:
        ruta = doc_service.generar_individual(orden_id)
        return {"mensaje": "PDF generado", "ruta": ruta}
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))

@app.post("/api/documentos/generacion-masiva")
def generacion_masiva(background_tasks: BackgroundTasks, sede_id: str = None, doc_service = Depends(get_documento_service)):
    # Delegamos la carga pesada al background para no bloquear el Event Loop de FastAPI
    background_tasks.add_task(doc_service.generar_masivo_background, sede_id)
    return {"mensaje": "Proceso de generación masiva iniciado en segundo plano"}