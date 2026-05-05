from fastapi import FastAPI, HTTPException, BackgroundTasks, Depends, Query
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse
import os
from pydantic import BaseModel
from datetime import datetime, date
from typing import Optional
from domain.models import OrdenMedica
from core.dependencies import (
    get_agendamiento_service,
    get_autorizacion_service,
    get_documento_service,
    get_consulta_service,
    get_orden_service
)

app = FastAPI(title="Motor de Agendamiento y Autorizaciones")
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:5173",
        "http://127.0.0.1:5173",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# --- DTOs (Data Transfer Objects) ---
class AgendarRequest(BaseModel):
    sede_id: str
    fecha_hora: datetime

class AutorizarRequest(BaseModel):
    usuario_id: str # En producción esto vendría del token JWT

# --- Endpoints ---

@app.post("/api/ordenes")
def crear_orden(
    orden: OrdenMedica,
    orden_service = Depends(get_orden_service)
):
    try:
        nueva_orden = orden_service.crear_orden(orden)

        return {
            "mensaje": "Orden creada correctamente",
            "orden": nueva_orden
        }

    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))
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
def generar_pdf_individual(
    orden_id: str,
    doc_service = Depends(get_documento_service)
):
    try:
        ruta = doc_service.generar_individual(orden_id)

        return {
            "mensaje": "PDF generado",
            "ruta": ruta,
            "descargar_url": f"/api/documentos/{orden_id}/descargar"
        }

    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))

@app.post("/api/documentos/generacion-masiva")
def generacion_masiva(background_tasks: BackgroundTasks, sede_id: str = None, doc_service = Depends(get_documento_service)):
    # Delegamos la carga pesada al background para no bloquear el Event Loop de FastAPI
    background_tasks.add_task(doc_service.generar_masivo_background, sede_id)
    return {"mensaje": "Proceso de generación masiva iniciado en segundo plano"}

@app.get("/api/health")
def health_check():
    return {"status": "ok", "service": "Motor de Agendamiento y Autorizaciones"}


@app.get("/api/dashboard/resumen")
def dashboard_resumen(consulta_service = Depends(get_consulta_service)):
    return consulta_service.dashboard_resumen()


@app.get("/api/sedes")
def listar_sedes(consulta_service = Depends(get_consulta_service)):
    return consulta_service.listar_sedes()


@app.get("/api/sedes/{sede_id}")
def obtener_sede(sede_id: str, consulta_service = Depends(get_consulta_service)):
    try:
        return consulta_service.obtener_sede(sede_id)
    except Exception as e:
        raise HTTPException(status_code=404, detail=str(e))


@app.get("/api/sedes/{sede_id}/disponibilidad")
def disponibilidad_sede(
    sede_id: str,
    fecha: date,
    consulta_service = Depends(get_consulta_service)
):
    try:
        return consulta_service.disponibilidad_sede_dia(sede_id, fecha)
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


@app.get("/api/ordenes")
def listar_ordenes(
    estado: Optional[str] = Query(default=None),
    sede_id: Optional[str] = Query(default=None),
    documento_generado: Optional[bool] = Query(default=None),
    limit: int = Query(default=50, ge=1, le=200),
    offset: int = Query(default=0, ge=0),
    consulta_service = Depends(get_consulta_service)
):
    return consulta_service.listar_ordenes(
        estado=estado,
        sede_id=sede_id,
        documento_generado=documento_generado,
        limit=limit,
        offset=offset
    )


@app.get("/api/ordenes/buscar")
def buscar_orden(
    numero_orden: str,
    consulta_service = Depends(get_consulta_service)
):
    try:
        return consulta_service.buscar_por_numero_orden(numero_orden)
    except Exception as e:
        raise HTTPException(status_code=404, detail=str(e))


@app.get("/api/ordenes/{orden_id}")
def obtener_orden(
    orden_id: str,
    consulta_service = Depends(get_consulta_service)
):
    try:
        return consulta_service.obtener_orden(orden_id)
    except Exception as e:
        raise HTTPException(status_code=404, detail=str(e))

class RechazarRequest(BaseModel):
    usuario_id: str
    motivo: str | None = None

@app.post("/api/ordenes/{orden_id}/rechazar")
def rechazar_orden(
    orden_id: str,
    req: RechazarRequest,
    auth_service = Depends(get_autorizacion_service)
):
    try:
        orden = auth_service.rechazar_orden(
            orden_id=orden_id,
            usuario_id=req.usuario_id,
            motivo=req.motivo
        )

        return {
            "mensaje": "Orden rechazada correctamente",
            "estado": orden.estado,
            "fecha": orden.fecha_autorizacion
        }

    except ValueError as e:
        raise HTTPException(status_code=422, detail=str(e))

    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))

@app.get("/api/documentos/{orden_id}/descargar")
def descargar_pdf(
    orden_id: str,
    consulta_service = Depends(get_consulta_service)
):
    try:
        orden = consulta_service.obtener_orden(orden_id)

        if not orden.documento_generado or not orden.ruta_pdf:
            raise HTTPException(status_code=404, detail="El PDF no ha sido generado.")

        if not os.path.exists(orden.ruta_pdf):
            raise HTTPException(status_code=404, detail="Archivo no encontrado en el servidor.")

        return FileResponse(
            path=orden.ruta_pdf,
            filename=f"orden_{orden.numero_orden}.pdf",
            media_type="application/pdf"
        )

    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))

@app.get("/api/documentos/pendientes")
def documentos_pendientes(
    sede_id: str | None = None,
    consulta_service = Depends(get_consulta_service)
):
    ordenes = consulta_service.listar_ordenes(
        estado="AUTORIZADA",
        documento_generado=False,
        limit=100
    )

    return [
        {
            "orden_id": o.id,
            "numero_orden": o.numero_orden,
            "paciente": o.paciente.nombre,
            "estudio": o.estudio
        }
        for o in ordenes
    ]

@app.get("/api/documentos/generados")
def documentos_generados(
    sede_id: str | None = None,
    consulta_service = Depends(get_consulta_service)
):
    ordenes = consulta_service.listar_ordenes(
        documento_generado=True,
        limit=100
    )

    return [
        {
            "orden_id": o.id,
            "numero_orden": o.numero_orden,
            "paciente": o.paciente.nombre,
            "ruta_pdf": o.ruta_pdf,
            "fecha_generacion": o.fecha_generacion_pdf
        }
        for o in ordenes
    ]