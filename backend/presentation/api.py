from fastapi import FastAPI, HTTPException, BackgroundTasks, Depends, Query, Request, UploadFile, File
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse, RedirectResponse
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
import os
import csv
import io
from pydantic import BaseModel
from datetime import datetime, date
from typing import Optional, List
from domain.models import OrdenMedica
from core.dependencies import (
    get_agendamiento_service,
    get_autorizacion_service,
    get_documento_service,
    get_consulta_service,
    get_orden_service,
    get_sede_repository,
    get_paciente_repository,
    get_db
)
from infrastructure.auth_service import hash_password, verify_password, create_token, decode_token, tiene_cualquier_rol
from infrastructure.database.models import UserModel, RoleModel, SedeModel, MunicipioModel, sede_municipios
from infrastructure.database.config import SessionLocal
from sqlalchemy.orm import Session
from contextlib import asynccontextmanager


@asynccontextmanager
async def lifespan(app: FastAPI):
    ROLES_POR_DEFECTO = {
        "super_usuario": "Acceso total al sistema: gestion de usuarios, sedes, roles y configuracion",
        "ordenar_citas": "Creacion de ordenes medicas (ingreso de pacientes y estudios)",
        "agendar_citas": "Agendamiento, cancelacion y reagendamiento de citas",
    }
    db = SessionLocal()
    try:
        for nombre, descripcion in ROLES_POR_DEFECTO.items():
            existe = db.query(RoleModel).filter(RoleModel.nombre == nombre).first()
            if not existe:
                db.add(RoleModel(nombre=nombre, descripcion=descripcion))
                print(f"  ✓ Rol creado: {nombre}")
        db.commit()
    except Exception as e:
        print(f"  ⚠ Error al seedear roles: {e}")
        db.rollback()
    finally:
        db.close()
    yield


app = FastAPI(title="Motor de Agendamiento y Autorizaciones", lifespan=lifespan)

# Middleware que remueve el prefijo del gateway (/api/v1/authorization-and-scheduling)
# y restaura /api interno que las rutas internas esperan
@app.middleware("http")
async def strip_gateway_prefix(request: Request, call_next):
    path = request.url.path
    prefix = "/api/v1/authorization-and-scheduling"
    if path.startswith(prefix):
        rest = path[len(prefix):]
        if not rest.startswith("/api"):
            rest = "/api" + rest
        new_path = rest or "/"
        request.scope["path"] = new_path
        request.scope["root_path"] = prefix
    response = await call_next(request)
    return response

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:5173",
        "http://127.0.0.1:5173",
        "https://agendamiento.esenorte3.lat",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

security = HTTPBearer()

# --- DTOs (Data Transfer Objects) ---
class AgendarRequest(BaseModel):
    sede_id: str
    fecha_hora: datetime

class AutorizarRequest(BaseModel):
    usuario_id: str

class RechazarRequest(BaseModel):
    usuario_id: str
    motivo: str | None = None

class LoginRequest(BaseModel):
    username: str
    password: str

class CrearUsuarioRequest(BaseModel):
    username: str
    password: str
    nombre: str
    roles: list[str] = []

class AsignarRolesRequest(BaseModel):
    roles: list[str]

class CambiarPasswordRequest(BaseModel):
    nueva_password: str

class ReagendarRequest(BaseModel):
    sede_id: str
    fecha_hora: datetime

class CrearPacienteRequest(BaseModel):
    tipo_documento: str = "CC"
    numero_documento: str
    nombre: str
    sexo: str = "M"
    direccion: str = ""
    telefono: str = ""
    fecha_nacimiento: date
    convenio: str
    regimen: str = "Contributivo"
    convenio_id: Optional[str] = None


class FilaPacienteCSV(BaseModel):
    tipo_documento: str = "CC"
    numero_documento: str
    nombre: str
    sexo: str = "O"
    fecha_nacimiento: date
    convenio: str = ""
    regimen: str = ""
    direccion: str = ""
    telefono: str = ""


class CrearSedeRequest(BaseModel):
    nombre: str
    hora_apertura: str
    hora_cierre: str
    capacidad_diaria: int

class ActualizarSedeRequest(BaseModel):
    nombre: str
    hora_apertura: str
    hora_cierre: str
    capacidad_diaria: int

class CrearMunicipioRequest(BaseModel):
    nombre: str

class AsignarMunicipiosSedeRequest(BaseModel):
    municipio_ids: list[str]


# --- JWT Auth Dependency ---
def get_current_user(credentials: HTTPAuthorizationCredentials = Depends(security)) -> dict:
    payload = decode_token(credentials.credentials)
    if payload is None:
        raise HTTPException(status_code=401, detail="Token inválido o expirado")
    return payload


# --- Role-based Access Control ---
def require_roles(*roles: str):
    """Dependency factory: verifica que el usuario tenga al menos uno de los roles indicados."""
    def verifier(user: dict = Depends(get_current_user)):
        if not tiene_cualquier_rol(user, list(roles)):
            raise HTTPException(status_code=403, detail="No tienes permiso para realizar esta acción")
        return user
    return verifier


# --- Auth Endpoints ---
@app.post("/api/auth/login")
def login(req: LoginRequest, db: Session = Depends(get_db)):
    user = db.query(UserModel).filter(UserModel.username == req.username, UserModel.activo == True).first()
    if not user or not verify_password(req.password, user.hashed_password):
        raise HTTPException(status_code=401, detail="Credenciales inválidas")

    roles = [r.nombre for r in user.roles]
    token = create_token(str(user.id), user.username, user.nombre, roles)
    return {
        "token": token,
        "usuario": {
            "id": str(user.id),
            "username": user.username,
            "nombre": user.nombre,
            "roles": roles,
        }
    }

@app.get("/api/auth/me")
def me(user: dict = Depends(get_current_user)):
    return user


# --- User Management (solo super_usuario) ---

@app.get("/api/usuarios")
def listar_usuarios(
    db: Session = Depends(get_db),
    user: dict = Depends(require_roles("super_usuario"))
):
    usuarios = db.query(UserModel).order_by(UserModel.nombre).all()
    return [
        {
            "id": str(u.id),
            "username": u.username,
            "nombre": u.nombre,
            "activo": u.activo,
            "roles": [r.nombre for r in u.roles],
        }
        for u in usuarios
    ]

@app.post("/api/usuarios")
def crear_usuario(
    req: CrearUsuarioRequest,
    db: Session = Depends(get_db),
    user: dict = Depends(require_roles("super_usuario"))
):
    if db.query(UserModel).filter(UserModel.username == req.username).first():
        raise HTTPException(status_code=400, detail="El nombre de usuario ya existe")

    nuevo = UserModel(
        username=req.username,
        nombre=req.nombre,
        hashed_password=hash_password(req.password),
    )

    if req.roles:
        roles = db.query(RoleModel).filter(RoleModel.nombre.in_(req.roles)).all()
        nuevo.roles = roles

    db.add(nuevo)
    db.commit()
    db.refresh(nuevo)

    return {
        "id": str(nuevo.id),
        "username": nuevo.username,
        "nombre": nuevo.nombre,
        "activo": nuevo.activo,
        "roles": [r.nombre for r in nuevo.roles],
    }

@app.put("/api/usuarios/{usuario_id}/roles")
def asignar_roles(
    usuario_id: str,
    req: AsignarRolesRequest,
    db: Session = Depends(get_db),
    user: dict = Depends(require_roles("super_usuario"))
):
    usuario = db.query(UserModel).filter(UserModel.id == usuario_id).first()
    if not usuario:
        raise HTTPException(status_code=404, detail="Usuario no encontrado")

    roles = db.query(RoleModel).filter(RoleModel.nombre.in_(req.roles)).all()
    usuario.roles = roles
    db.commit()
    db.refresh(usuario)

    return {
        "id": str(usuario.id),
        "username": usuario.username,
        "nombre": usuario.nombre,
        "activo": usuario.activo,
        "roles": [r.nombre for r in usuario.roles],
    }

@app.put("/api/usuarios/{usuario_id}/password")
def cambiar_password(
    usuario_id: str,
    req: CambiarPasswordRequest,
    db: Session = Depends(get_db),
    user: dict = Depends(require_roles("super_usuario"))
):
    usuario = db.query(UserModel).filter(UserModel.id == usuario_id).first()
    if not usuario:
        raise HTTPException(status_code=404, detail="Usuario no encontrado")

    usuario.hashed_password = hash_password(req.nueva_password)
    db.commit()
    return {"mensaje": "Contraseña actualizada correctamente"}

@app.put("/api/usuarios/{usuario_id}/toggle-activo")
def toggle_activo(
    usuario_id: str,
    db: Session = Depends(get_db),
    user: dict = Depends(require_roles("super_usuario"))
):
    usuario = db.query(UserModel).filter(UserModel.id == usuario_id).first()
    if not usuario:
        raise HTTPException(status_code=404, detail="Usuario no encontrado")

    if user["sub"] == usuario_id:
        raise HTTPException(status_code=400, detail="No puedes desactivarte a ti mismo")

    usuario.activo = not usuario.activo
    db.commit()
    return {
        "id": str(usuario.id),
        "activo": usuario.activo,
    }

@app.get("/api/roles")
def listar_roles(
    db: Session = Depends(get_db),
    user: dict = Depends(require_roles("super_usuario"))
):
    roles = db.query(RoleModel).order_by(RoleModel.nombre).all()
    return [{"id": str(r.id), "nombre": r.nombre, "descripcion": r.descripcion} for r in roles]


# --- Existing Endpoints (protected) ---

@app.post("/api/ordenes")
def crear_orden(
    orden: OrdenMedica,
    orden_service = Depends(get_orden_service),
    user: dict = Depends(require_roles("ordenar_citas", "super_usuario"))
):
    try:
        nueva_orden = orden_service.crear_orden(orden)
        return {"mensaje": "Orden creada correctamente", "orden": nueva_orden}
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))

@app.post("/api/ordenes/{orden_id}/autorizar")
def autorizar_orden(
    orden_id: str,
    req: AutorizarRequest,
    auth_service = Depends(get_autorizacion_service),
    user: dict = Depends(get_current_user)
):
    try:
        orden = auth_service.autorizar_orden(orden_id, req.usuario_id)
        return {"mensaje": "Orden autorizada lógicamente", "fecha": orden.fecha_autorizacion}
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))

@app.post("/api/ordenes/{orden_id}/agendar")
def agendar_orden(
    orden_id: str,
    req: AgendarRequest,
    sched_service = Depends(get_agendamiento_service),
    user: dict = Depends(require_roles("agendar_citas", "super_usuario"))
):
    try:
        orden = sched_service.agendar_cita(orden_id, req.sede_id, req.fecha_hora)
        return {"mensaje": "Cita agendada con éxito", "fecha_cita": orden.fecha_cita}
    except ValueError as e:
        raise HTTPException(status_code=422, detail=str(e))

@app.post("/api/ordenes/{orden_id}/cancelar-cita")
def cancelar_cita(
    orden_id: str,
    sched_service = Depends(get_agendamiento_service),
    user: dict = Depends(require_roles("agendar_citas", "super_usuario"))
):
    try:
        orden = sched_service.cancelar_cita(orden_id)
        return {"mensaje": "Cita cancelada correctamente", "orden": orden.model_dump(mode="json")}
    except ValueError as e:
        raise HTTPException(status_code=422, detail=str(e))

@app.put("/api/ordenes/{orden_id}/reagendar")
def reagendar_cita(
    orden_id: str,
    req: ReagendarRequest,
    sched_service = Depends(get_agendamiento_service),
    user: dict = Depends(require_roles("agendar_citas", "super_usuario"))
):
    try:
        orden = sched_service.reagendar_cita(orden_id, req.sede_id, req.fecha_hora)
        return {"mensaje": "Cita reagendada correctamente", "fecha_cita": orden.fecha_cita}
    except ValueError as e:
        raise HTTPException(status_code=422, detail=str(e))

@app.get("/api/ordenes/agendadas")
def listar_agendadas(
    sede_id: Optional[str] = Query(default=None),
    fecha: Optional[date] = Query(default=None),
    limit: int = Query(default=100, ge=1, le=200),
    offset: int = Query(default=0, ge=0),
    consulta_service = Depends(get_consulta_service),
    user: dict = Depends(get_current_user)
):
    """Retorna órdenes que tienen cita programada."""
    return consulta_service.listar_ordenes(
        con_cita=True, sede_id=sede_id, limit=limit, offset=offset
    )

@app.post("/api/ordenes/{orden_id}/generar-pdf")
def generar_pdf_individual(
    orden_id: str,
    doc_service = Depends(get_documento_service),
    user: dict = Depends(get_current_user)
):
    try:
        ruta = doc_service.generar_individual(orden_id)
        return {"mensaje": "PDF generado", "ruta": ruta, "descargar_url": f"/api/documentos/{orden_id}/descargar"}
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))

@app.post("/api/documentos/generacion-masiva")
def generacion_masiva(
    background_tasks: BackgroundTasks,
    sede_id: str = None,
    doc_service = Depends(get_documento_service),
    user: dict = Depends(get_current_user)
):
    background_tasks.add_task(doc_service.generar_masivo_background, sede_id)
    return {"mensaje": "Proceso de generación masiva iniciado en segundo plano"}

@app.get("/api/dashboard/resumen")
def dashboard_resumen(
    consulta_service = Depends(get_consulta_service),
    user: dict = Depends(get_current_user)
):
    return consulta_service.dashboard_resumen()

@app.get("/api/sedes")
def listar_sedes(
    consulta_service = Depends(get_consulta_service),
    user: dict = Depends(get_current_user)
):
    return consulta_service.listar_sedes()

@app.get("/api/sedes/{sede_id}")
def obtener_sede(
    sede_id: str,
    consulta_service = Depends(get_consulta_service),
    user: dict = Depends(get_current_user)
):
    try:
        return consulta_service.obtener_sede(sede_id)
    except Exception as e:
        raise HTTPException(status_code=404, detail=str(e))

@app.post("/api/sedes")
def crear_sede(
    req: CrearSedeRequest,
    sede_repo = Depends(get_sede_repository),
    user: dict = Depends(require_roles("super_usuario"))
):
    try:
        sede = sede_repo.crear_sede(req.nombre, req.hora_apertura, req.hora_cierre, req.capacidad_diaria)
        return {"mensaje": "Sede creada correctamente", "sede": sede.model_dump()}
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))

@app.put("/api/sedes/{sede_id}")
def actualizar_sede(
    sede_id: str,
    req: ActualizarSedeRequest,
    sede_repo = Depends(get_sede_repository),
    user: dict = Depends(require_roles("super_usuario"))
):
    try:
        sede = sede_repo.actualizar_sede(sede_id, req.nombre, req.hora_apertura, req.hora_cierre, req.capacidad_diaria)
        return {"mensaje": "Sede actualizada correctamente", "sede": sede.model_dump()}
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))

@app.delete("/api/sedes/{sede_id}")
def eliminar_sede(
    sede_id: str,
    sede_repo = Depends(get_sede_repository),
    user: dict = Depends(require_roles("super_usuario"))
):
    try:
        sede_repo.eliminar_sede(sede_id)
        return {"mensaje": "Sede eliminada correctamente"}
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))

# --- Municipios (solo super_usuario) ---

@app.get("/api/municipios")
def listar_municipios(
    db: Session = Depends(get_db),
    user: dict = Depends(require_roles("super_usuario"))
):
    municipios = db.query(MunicipioModel).order_by(MunicipioModel.nombre).all()
    return [{"id": str(m.id), "nombre": m.nombre} for m in municipios]

@app.post("/api/municipios")
def crear_municipio(
    req: CrearMunicipioRequest,
    db: Session = Depends(get_db),
    user: dict = Depends(require_roles("super_usuario"))
):
    if db.query(MunicipioModel).filter(MunicipioModel.nombre == req.nombre).first():
        raise HTTPException(status_code=400, detail="Ya existe un municipio con ese nombre")
    nuevo = MunicipioModel(nombre=req.nombre)
    db.add(nuevo)
    db.commit()
    db.refresh(nuevo)
    return {"id": str(nuevo.id), "nombre": nuevo.nombre}

@app.put("/api/municipios/{municipio_id}")
def actualizar_municipio(
    municipio_id: str,
    req: CrearMunicipioRequest,
    db: Session = Depends(get_db),
    user: dict = Depends(require_roles("super_usuario"))
):
    muni = db.query(MunicipioModel).filter(MunicipioModel.id == municipio_id).first()
    if not muni:
        raise HTTPException(status_code=404, detail="Municipio no encontrado")
    muni.nombre = req.nombre
    db.commit()
    db.refresh(muni)
    return {"id": str(muni.id), "nombre": muni.nombre}

@app.delete("/api/municipios/{municipio_id}")
def eliminar_municipio(
    municipio_id: str,
    db: Session = Depends(get_db),
    user: dict = Depends(require_roles("super_usuario"))
):
    muni = db.query(MunicipioModel).filter(MunicipioModel.id == municipio_id).first()
    if not muni:
        raise HTTPException(status_code=404, detail="Municipio no encontrado")
    db.delete(muni)
    db.commit()
    return {"mensaje": "Municipio eliminado correctamente"}

# --- Asignación de municipios a sedes (solo super_usuario) ---

@app.get("/api/sedes/{sede_id}/municipios")
def obtener_municipios_sede(
    sede_id: str,
    db: Session = Depends(get_db),
    user: dict = Depends(require_roles("super_usuario"))
):
    sede = db.query(SedeModel).filter(SedeModel.id == sede_id).first()
    if not sede:
        raise HTTPException(status_code=404, detail="Sede no encontrada")
    return [{"id": str(m.id), "nombre": m.nombre} for m in sede.municipios]

@app.put("/api/sedes/{sede_id}/municipios")
def asignar_municipios_sede(
    sede_id: str,
    req: AsignarMunicipiosSedeRequest,
    db: Session = Depends(get_db),
    user: dict = Depends(require_roles("super_usuario"))
):
    sede = db.query(SedeModel).filter(SedeModel.id == sede_id).first()
    if not sede:
        raise HTTPException(status_code=404, detail="Sede no encontrada")
    municipios = db.query(MunicipioModel).filter(MunicipioModel.id.in_(req.municipio_ids)).all()
    sede.municipios = municipios
    db.commit()
    return {
        "mensaje": "Municipios asignados correctamente",
        "municipios": [{"id": str(m.id), "nombre": m.nombre} for m in municipios]
    }

# --- Endpoint público: sedes filtradas por municipio ---

@app.get("/api/sedes/por-municipio/{municipio_id}")
def sedes_por_municipio(
    municipio_id: str,
    db: Session = Depends(get_db),
    user: dict = Depends(get_current_user)
):
    muni = db.query(MunicipioModel).filter(MunicipioModel.id == municipio_id).first()
    if not muni:
        raise HTTPException(status_code=404, detail="Municipio no encontrado")
    return [
        {
            "id": str(s.id),
            "nombre": s.nombre,
            "hora_apertura": s.hora_apertura.isoformat() if s.hora_apertura else None,
            "hora_cierre": s.hora_cierre.isoformat() if s.hora_cierre else None,
            "capacidad_diaria": s.capacidad_diaria,
        }
        for s in muni.sedes
    ]

@app.get("/api/sedes/{sede_id}/disponibilidad")
def disponibilidad_sede(
    sede_id: str,
    fecha: date,
    consulta_service = Depends(get_consulta_service),
    user: dict = Depends(get_current_user)
):
    try:
        return consulta_service.disponibilidad_sede_dia(sede_id, fecha)
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))

# --- Paciente Endpoints ---

@app.get("/api/pacientes/similares")
def buscar_pacientes_similares(
    nombre: str = Query(default="", min_length=3),
    documento: str = Query(default=""),
    paciente_repo = Depends(get_paciente_repository),
    user: dict = Depends(get_current_user)
):
    """
    Busca pacientes con nombres similares para detectar posibles duplicados
    por misspelling. Retorna lista vacía si no encuentra coincidencias.
    """
    return paciente_repo.buscar_similares(nombre, numero_documento=documento, limit=10)


# --- Convenios CRUD ---

class CrearConvenioRequest(BaseModel):
    nombre: str
    regimen: str = ""
    activo: bool = True

class ActualizarConvenioRequest(BaseModel):
    nombre: str
    regimen: str = ""
    activo: bool = True


@app.get("/api/convenios")
def listar_convenios(
    q: str = Query(default=""),
    top: int = Query(default=0, ge=0, le=50),
    db: Session = Depends(get_db),
    user: dict = Depends(get_current_user)
):
    """
    Lista convenios con búsqueda opcional.
    top=N: retorna los N más usados (por cantidad de pacientes).
    Sin q ni top: ordenados alfabéticamente.
    """
    from infrastructure.database.models import ConvenioModel, PacienteModel
    from sqlalchemy import func

    query = db.query(
        ConvenioModel,
        func.count(PacienteModel.id).label("total")
    ).outerjoin(PacienteModel, PacienteModel.convenio_id == ConvenioModel.id)

    if q:
        query = query.filter(ConvenioModel.nombre.ilike(f"%{q.strip()}%"))

    query = query.group_by(ConvenioModel.id)

    if top:
        # Más usados primero
        query = query.order_by(func.count(PacienteModel.id).desc())
    else:
        query = query.order_by(ConvenioModel.nombre.asc())

    resultados = query.limit(50 if top else None).all()

    return [
        {
            "id": str(c.id),
            "nombre": c.nombre,
            "regimen": c.regimen or "",
            "activo": c.activo,
            "total_pacientes": total,
        }
        for c, total in resultados
    ]


@app.post("/api/convenios")
def crear_convenio(
    req: CrearConvenioRequest,
    db: Session = Depends(get_db),
    user: dict = Depends(require_roles("super_usuario"))
):
    from infrastructure.database.models import ConvenioModel
    existe = db.query(ConvenioModel).filter(ConvenioModel.nombre == req.nombre.strip()).first()
    if existe:
        raise HTTPException(status_code=409, detail=f"Ya existe un convenio con nombre '{req.nombre}'")
    convenio = ConvenioModel(nombre=req.nombre.strip(), regimen=req.regimen.strip(), activo=req.activo)
    db.add(convenio)
    db.commit()
    db.refresh(convenio)
    return {"id": str(convenio.id), "nombre": convenio.nombre, "regimen": convenio.regimen, "activo": convenio.activo}


@app.put("/api/convenios/{convenio_id}")
def actualizar_convenio(
    convenio_id: str,
    req: ActualizarConvenioRequest,
    db: Session = Depends(get_db),
    user: dict = Depends(require_roles("super_usuario"))
):
    from infrastructure.database.models import ConvenioModel
    convenio = db.query(ConvenioModel).filter(ConvenioModel.id == convenio_id).first()
    if not convenio:
        raise HTTPException(status_code=404, detail="Convenio no encontrado")
    duplicado = db.query(ConvenioModel).filter(
        ConvenioModel.nombre == req.nombre.strip(),
        ConvenioModel.id != convenio_id
    ).first()
    if duplicado:
        raise HTTPException(status_code=409, detail=f"Ya existe otro convenio con nombre '{req.nombre}'")
    convenio.nombre = req.nombre.strip()
    convenio.regimen = req.regimen.strip()
    convenio.activo = req.activo
    db.commit()
    db.refresh(convenio)
    return {"id": str(convenio.id), "nombre": convenio.nombre, "regimen": convenio.regimen, "activo": convenio.activo}


@app.delete("/api/convenios/{convenio_id}")
def eliminar_convenio(
    convenio_id: str,
    db: Session = Depends(get_db),
    user: dict = Depends(require_roles("super_usuario"))
):
    from infrastructure.database.models import ConvenioModel
    from sqlalchemy import text
    # Verificar pacientes vinculados
    vinculados = db.execute(
        text("SELECT COUNT(*) FROM pacientes WHERE convenio_id = :cid"),
        {"cid": convenio_id}
    ).scalar()
    if vinculados and vinculados > 0:
        raise HTTPException(
            status_code=400,
            detail=f"No se puede eliminar: {vinculados} pacientes están vinculados a este convenio. Desactívalo en su lugar."
        )
    convenio = db.query(ConvenioModel).filter(ConvenioModel.id == convenio_id).first()
    if not convenio:
        raise HTTPException(status_code=404, detail="Convenio no encontrado")
    db.delete(convenio)
    db.commit()
    return {"mensaje": "Convenio eliminado correctamente"}


@app.post("/api/convenios/importar")
def importar_convenios(
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
    user: dict = Depends(require_roles("super_usuario"))
):
    """Importa convenios desde CSV (nombre, regimen, activo)."""
    from infrastructure.database.models import ConvenioModel
    content = file.file.read().decode("utf-8-sig")
    reader = csv.DictReader(io.StringIO(content))

    insertados = 0
    actualizados = 0
    errores = []

    for idx, row in enumerate(reader, start=2):
        try:
            nombre = row.get("nombre", "").strip()
            if not nombre:
                continue
            regimen = row.get("regimen", "").strip()
            activo_str = row.get("activo", "SI").strip().upper()
            activo = activo_str in ("SI", "TRUE", "1", "S")

            existe = db.query(ConvenioModel).filter(ConvenioModel.nombre == nombre).first()
            if existe:
                existe.regimen = regimen
                existe.activo = activo
                actualizados += 1
            else:
                db.add(ConvenioModel(nombre=nombre, regimen=regimen, activo=activo))
                insertados += 1
        except Exception as e:
            errores.append(f"Fila {idx}: {e}")

    db.commit()
    return {
        "insertados": insertados,
        "actualizados": actualizados,
        "errores": len(errores),
        "detalle": errores[:10],
    }


@app.get("/api/pacientes/convenios")
def listar_convenios_antiguo(
    q: str = Query(default=""),
    paciente_repo = Depends(get_paciente_repository),
    user: dict = Depends(get_current_user)
):
    """Retorna la lista de nombres de convenios desde la tabla maestra."""
    from infrastructure.database.models import ConvenioModel
    db = next(get_db())
    try:
        query = db.query(ConvenioModel).filter(ConvenioModel.activo == True)
        if q:
            query = query.filter(ConvenioModel.nombre.ilike(f"%{q.strip()}%"))
        resultados = query.order_by(ConvenioModel.nombre.asc()).all()
        return [c.nombre for c in resultados]
    finally:
        db.close()


@app.get("/api/pacientes/buscar")
def buscar_pacientes(
    q: str = Query(default="", min_length=1),
    tipo: str = Query(default="documento"),
    paciente_repo = Depends(get_paciente_repository),
    user: dict = Depends(get_current_user)
):
    """Busca pacientes por número de documento o por nombre."""
    if tipo == "documento":
        resultado = paciente_repo.buscar_por_documento(q)
        if resultado:
            return [resultado]
        return []
    else:
        return paciente_repo.buscar_por_nombre(q, limit=20)


@app.post("/api/pacientes")
def crear_paciente(
    req: CrearPacienteRequest,
    paciente_repo = Depends(get_paciente_repository),
    user: dict = Depends(get_current_user)
):
    """Crea un nuevo paciente en el sistema."""
    # Verificar si ya existe
    existe = paciente_repo.buscar_por_documento(req.numero_documento)
    if existe:
        raise HTTPException(status_code=409, detail=f"Ya existe un paciente con documento {req.numero_documento}")

    data = req.model_dump()
    # fecha_nacimiento viene como date, convertir a datetime para el modelo
    data["fecha_nacimiento"] = datetime.combine(data["fecha_nacimiento"], datetime.min.time())
    paciente = paciente_repo.crear_paciente(data)
    return paciente


@app.get("/api/pacientes")
def listar_pacientes(
    q: str = Query(default=""),
    limit: int = Query(default=50, ge=1, le=200),
    offset: int = Query(default=0, ge=0),
    paciente_repo = Depends(get_paciente_repository),
    user: dict = Depends(get_current_user)
):
    """Lista pacientes con búsqueda y paginación."""
    return paciente_repo.listar_pacientes(query=q, limit=limit, offset=offset)


@app.post("/api/pacientes/importar")
def importar_pacientes(
    file: UploadFile = File(...),
    paciente_repo = Depends(get_paciente_repository),
    user: dict = Depends(get_current_user)
):
    """Importa pacientes desde un archivo CSV/TSV."""
    content = file.file.read().decode("utf-8-sig")
    reader = csv.DictReader(io.StringIO(content), delimiter="\t")

    rows = []
    errores_parse = []

    for idx, row in enumerate(reader, start=2):
        try:
            fecha_nac = row.get("fechanacimiento", "").strip()
            if fecha_nac:
                try:
                    fecha_nac = datetime.strptime(fecha_nac, "%Y-%m-%d")
                except ValueError:
                    fecha_nac = datetime(1900, 1, 1)
            else:
                fecha_nac = datetime(1900, 1, 1)

            rows.append({
                "tipo_documento": row.get("tipodocu", "CC").strip(),
                "numero_documento": row.get("identificacion", "").strip(),
                "nombre": " ".join(filter(None, [
                    row.get("nombre1", "").strip(),
                    row.get("nombre2", "").strip(),
                    row.get("apellido1", "").strip(),
                    row.get("apellido2", "").strip(),
                ])),
                "sexo": row.get("sexo", "O").strip(),
                "fecha_nacimiento": fecha_nac,
                "convenio": row.get("convenionombre", "").strip(),
                "regimen": "",  # se auto-detectará en el repositorio
            })
        except Exception as e:
            errores_parse.append(f"Fila {idx}: {e}")

    if not rows:
        raise HTTPException(status_code=400, detail="No se encontraron filas válidas en el archivo")

    resultado = paciente_repo.importar_masivo(rows)
    resultado["total_procesadas"] = len(rows)
    resultado["errores_parse"] = len(errores_parse)
    resultado["detalle_errores"] = (resultado.get("detalle_errores", []) + errores_parse)[:30]

    return resultado


@app.get("/api/ordenes")
def listar_ordenes(
    estado: Optional[str] = Query(default=None),
    sede_id: Optional[str] = Query(default=None),
    con_cita: Optional[bool] = Query(default=None),
    documento_generado: Optional[bool] = Query(default=None),
    limit: int = Query(default=50, ge=1, le=200),
    offset: int = Query(default=0, ge=0),
    consulta_service = Depends(get_consulta_service),
    user: dict = Depends(get_current_user)
):
    return consulta_service.listar_ordenes(
        estado=estado, sede_id=sede_id, con_cita=con_cita,
        documento_generado=documento_generado,
        limit=limit, offset=offset
    )

@app.get("/api/ordenes/buscar")
def buscar_orden(
    numero_orden: str,
    consulta_service = Depends(get_consulta_service),
    user: dict = Depends(get_current_user)
):
    try:
        return consulta_service.buscar_por_numero_orden(numero_orden)
    except Exception as e:
        raise HTTPException(status_code=404, detail=str(e))

@app.get("/api/ordenes/{orden_id}")
def obtener_orden(
    orden_id: str,
    consulta_service = Depends(get_consulta_service),
    user: dict = Depends(get_current_user)
):
    try:
        return consulta_service.obtener_orden(orden_id)
    except Exception as e:
        raise HTTPException(status_code=404, detail=str(e))

@app.post("/api/ordenes/{orden_id}/rechazar")
def rechazar_orden(
    orden_id: str,
    req: RechazarRequest,
    auth_service = Depends(get_autorizacion_service),
    user: dict = Depends(get_current_user)
):
    try:
        orden = auth_service.rechazar_orden(orden_id=orden_id, usuario_id=req.usuario_id, motivo=req.motivo)
        return {"mensaje": "Orden rechazada correctamente", "estado": orden.estado, "fecha": orden.fecha_autorizacion}
    except ValueError as e:
        raise HTTPException(status_code=422, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))

@app.get("/api/documentos/{orden_id}/descargar")
def descargar_pdf(
    orden_id: str,
    token: str | None = Query(None),
    credentials: HTTPAuthorizationCredentials | None = Depends(HTTPBearer(auto_error=False)),
    consulta_service = Depends(get_consulta_service),
):
    if credentials:
        user = get_current_user(credentials)
    elif token:
        user = decode_token(token)
        if user is None:
            raise HTTPException(status_code=401, detail="Token inválido o expirado")
    else:
        raise HTTPException(status_code=401, detail="Not authenticated")
    try:
        orden = consulta_service.obtener_orden(orden_id)
        if not orden.documento_generado or not orden.ruta_pdf:
            raise HTTPException(status_code=404, detail="El PDF no ha sido generado.")
        if not os.path.exists(orden.ruta_pdf):
            raise HTTPException(status_code=404, detail="Archivo no encontrado en el servidor.")
        return FileResponse(path=orden.ruta_pdf, filename=f"orden_{orden.numero_orden}.pdf", media_type="application/pdf")
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))

@app.get("/api/documentos/pendientes")
def documentos_pendientes(
    sede_id: str | None = None,
    consulta_service = Depends(get_consulta_service),
    user: dict = Depends(get_current_user)
):
    ordenes = consulta_service.listar_ordenes(estado="AUTORIZADA", documento_generado=False, limit=100)
    return [{"orden_id": o.id, "numero_orden": o.numero_orden, "paciente": o.paciente.nombre, "estudio": o.estudio} for o in ordenes]

@app.get("/api/documentos/generados")
def documentos_generados(
    sede_id: str | None = None,
    consulta_service = Depends(get_consulta_service),
    user: dict = Depends(get_current_user)
):
    ordenes = consulta_service.listar_ordenes(documento_generado=True, limit=100)
    return [{"orden_id": o.id, "numero_orden": o.numero_orden, "paciente": o.paciente.nombre, "ruta_pdf": o.ruta_pdf, "fecha_generacion": o.fecha_generacion_pdf} for o in ordenes]
