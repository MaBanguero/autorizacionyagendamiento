from sqlalchemy import Column, String, Integer, DateTime, Time, Boolean, ForeignKey, UniqueConstraint, CheckConstraint
from sqlalchemy.dialects.postgresql import UUID, ENUM
from sqlalchemy.orm import declarative_base, relationship
import uuid

Base = declarative_base()


class SedeModel(Base):
    __tablename__ = "sedes"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    nombre = Column(String(100), nullable=False)
    hora_apertura = Column(Time, nullable=False)
    hora_cierre = Column(Time, nullable=False)
    capacidad_diaria = Column(Integer, nullable=False, default=150)

    # Relación inversa
    ordenes = relationship("OrdenMedicaModel", back_populates="sede")


class PacienteModel(Base):
    __tablename__ = "pacientes"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    tipo_documento = Column(String(10), nullable=False)
    numero_documento = Column(String(50), nullable=False, unique=True, index=True)
    nombre = Column(String(150), nullable=False)
    sexo = Column(ENUM('M', 'F', 'O', name='sexo_enum', create_type=True), nullable=False)
    direccion = Column(String(200), nullable=False)
    telefono = Column(String(20), nullable=False)
    fecha_nacimiento = Column(DateTime, nullable=False)
    convenio = Column(String(100), nullable=False)
    regimen = Column(String(50), nullable=False)


class OrdenMedicaModel(Base):
    __tablename__ = "ordenes_medicas"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    numero_orden = Column(String(50), unique=True, index=True, nullable=False)
    paciente_id = Column(UUID(as_uuid=True), ForeignKey("pacientes.id"), nullable=False)
    estudio = Column(String(200), nullable=False)

    # Flujo de Autorización
    estado = Column(String(20), nullable=False, default="PENDIENTE")
    autorizado_por = Column(String(100), nullable=True)
    fecha_autorizacion = Column(DateTime, nullable=True)

    # Flujo de Agendamiento
    sede_id = Column(UUID(as_uuid=True), ForeignKey("sedes.id"), nullable=True)
    fecha_cita = Column(DateTime, nullable=True)

    # Flujo Documental (PDF)
    documento_generado = Column(Boolean, default=False, nullable=False)
    fecha_generacion_pdf = Column(DateTime, nullable=True)
    ruta_pdf = Column(String(255), nullable=True)

    # Relaciones
    paciente = relationship("PacienteModel")
    sede = relationship("SedeModel", back_populates="ordenes")

    __table_args__ = (
        # REGLA DE ORO 1: Evitar el Double-Booking a nivel de Base de Datos.
        # Nadie puede agendar la misma hora exacta en la misma sede.
        UniqueConstraint('sede_id', 'fecha_cita', name='uq_sede_fecha_cita'),

        # REGLA DE ORO 2: Consistencia de estados
        # Si está autorizada, debe tener un usuario autorizador
        CheckConstraint(
            "(estado = 'AUTORIZADA' AND autorizado_por IS NOT NULL) OR (estado != 'AUTORIZADA')",
            name='chk_autorizacion_valida'
        )
    )