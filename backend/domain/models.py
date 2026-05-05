from pydantic import BaseModel, Field
from datetime import date, datetime, time
from typing import Optional
from enum import Enum


class SexoEnum(str, Enum):
    M = "M"
    F = "F"
    O = "O"


class Paciente(BaseModel):
    nombre: str
    tipo_documento: str
    numero_documento: str
    sexo: SexoEnum
    direccion: str
    telefono: str
    fecha_nacimiento: date
    convenio: str
    regimen: str


class Sede(BaseModel):
    id: str
    nombre: str
    hora_apertura: time
    hora_cierre: time
    capacidad_diaria: int = 150


class OrdenMedica(BaseModel):
    id: str
    numero_orden: str  # Identificador para sistemas externos
    paciente: Paciente
    estudio: str

    # Estados lógicos
    estado: str = "PENDIENTE"  # PENDIENTE, AUTORIZADA, RECHAZADA
    autorizado_por: Optional[str] = None
    fecha_autorizacion: Optional[datetime] = None  # Generada por el sistema

    # Agendamiento
    sede_id: Optional[str] = None
    fecha_cita: Optional[datetime] = None

    # Control Documental
    documento_generado: bool = False
    fecha_generacion_pdf: Optional[datetime] = None  # Generada por el sistema
    ruta_pdf: Optional[str] = None