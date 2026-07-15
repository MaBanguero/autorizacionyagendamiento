from sqlalchemy import Column, String, Integer, DateTime, Time, Boolean, ForeignKey, UniqueConstraint, CheckConstraint, Table
from sqlalchemy.dialects.postgresql import UUID, ENUM
from sqlalchemy.orm import declarative_base, relationship
import uuid

Base = declarative_base()


# --- Tabla pivote: roles de cada usuario (muchos a muchos) ---
user_roles = Table(
    "user_roles",
    Base.metadata,
    Column("user_id", UUID(as_uuid=True), ForeignKey("usuarios.id", ondelete="CASCADE"), primary_key=True),
    Column("role_id", UUID(as_uuid=True), ForeignKey("roles.id", ondelete="CASCADE"), primary_key=True),
)


class RoleModel(Base):
    __tablename__ = "roles"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    nombre = Column(String(50), unique=True, nullable=False, index=True)
    descripcion = Column(String(200), nullable=True)

    usuarios = relationship("UserModel", secondary=user_roles, back_populates="roles")


# --- Tabla pivote: municipios que atiende cada sede ---
sede_municipios = Table(
    "sede_municipios",
    Base.metadata,
    Column("sede_id", UUID(as_uuid=True), ForeignKey("sedes.id", ondelete="CASCADE"), primary_key=True),
    Column("municipio_id", UUID(as_uuid=True), ForeignKey("municipios.id", ondelete="CASCADE"), primary_key=True),
)


class SedeModel(Base):
    __tablename__ = "sedes"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    nombre = Column(String(100), nullable=False)
    hora_apertura = Column(Time, nullable=False)
    hora_cierre = Column(Time, nullable=False)
    capacidad_diaria = Column(Integer, nullable=False, default=150)

    # Relaciones
    ordenes = relationship("OrdenMedicaModel", back_populates="sede")
    municipios = relationship("MunicipioModel", secondary=sede_municipios, back_populates="sedes", lazy="joined")


class MunicipioModel(Base):
    __tablename__ = "municipios"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    nombre = Column(String(100), unique=True, nullable=False, index=True)

    sedes = relationship("SedeModel", secondary=sede_municipios, back_populates="municipios")


class ConvenioModel(Base):
    __tablename__ = "convenios"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    nombre = Column(String(150), unique=True, nullable=False, index=True)
    regimen = Column(String(50), nullable=True)
    activo = Column(Boolean, default=True, nullable=False)


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
    municipio_id = Column(UUID(as_uuid=True), ForeignKey("municipios.id"), nullable=True)


class UserModel(Base):
    __tablename__ = "usuarios"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    username = Column(String(50), unique=True, nullable=False, index=True)
    nombre = Column(String(150), nullable=False)
    hashed_password = Column(String(255), nullable=False)
    activo = Column(Boolean, default=True, nullable=False)

    roles = relationship("RoleModel", secondary=user_roles, back_populates="usuarios", lazy="joined")


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
        UniqueConstraint('sede_id', 'fecha_cita', name='uq_sede_fecha_cita'),
        CheckConstraint(
            "(estado = 'AUTORIZADA' AND autorizado_por IS NOT NULL) OR (estado != 'AUTORIZADA')",
            name='chk_autorizacion_valida'
        )
    )
