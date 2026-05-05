from sqlalchemy.orm import Session
from sqlalchemy import func
from datetime import datetime, date
from typing import List, Optional

from domain.interfaces import IOrdenRepository, ISedeRepository
from domain.models import OrdenMedica, Sede, Paciente, SexoEnum
from infrastructure.database.models import OrdenMedicaModel, SedeModel, PacienteModel


class PostgresSedeRepository(ISedeRepository):
    def __init__(self, db_session: Session):
        self.db = db_session

    def obtener_sede(self, sede_id: str) -> Sede:
        sede_db = self.db.query(SedeModel).filter(SedeModel.id == sede_id).first()
        if not sede_db:
            raise ValueError(f"Sede con ID {sede_id} no encontrada en el sistema.")

        return Sede(
            id=str(sede_db.id),
            nombre=sede_db.nombre,
            hora_apertura=sede_db.hora_apertura,
            hora_cierre=sede_db.hora_cierre,
            capacidad_diaria=sede_db.capacidad_diaria
        )


class PostgresOrdenRepository(IOrdenRepository):
    def __init__(self, db_session: Session):
        self.db = db_session

    def obtener_por_id(self, orden_id: str) -> OrdenMedica:
        # SQLAlchemy hará un join automático con paciente gracias a los relationships del modelo
        orden_db = self.db.query(OrdenMedicaModel).filter(OrdenMedicaModel.id == orden_id).first()
        if not orden_db:
            raise ValueError(f"Orden médica con ID {orden_id} no encontrada.")

        return self._to_domain(orden_db)

    def contar_citas_sede_dia(self, sede_id: str, fecha: date) -> int:
        """
        Cuenta las citas de un día específico aplicando un bloqueo FOR UPDATE.
        Esto garantiza que si dos transacciones intentan contar y agendar al mismo
        tiempo para la misma sede y día, PostgreSQL procesará una después de la otra.
        """
        inicio_dia = datetime.combine(fecha, datetime.min.time())
        fin_dia = datetime.combine(fecha, datetime.max.time())

        conteo = self.db.query(func.count(OrdenMedicaModel.id)) \
            .filter(OrdenMedicaModel.sede_id == sede_id) \
            .filter(OrdenMedicaModel.fecha_cita >= inicio_dia) \
            .filter(OrdenMedicaModel.fecha_cita <= fin_dia) \
            .with_for_update() \
            .scalar()

        return conteo or 0

    def existe_cita_en_slot(self, sede_id: str, fecha_hora: datetime) -> bool:
        """
        Verifica si el bloque exacto de 3 minutos ya está ocupado en esa sede.
        """
        existe = self.db.query(OrdenMedicaModel.id).filter(
            OrdenMedicaModel.sede_id == sede_id,
            OrdenMedicaModel.fecha_cita == fecha_hora
        ).first()

        return existe is not None

    def guardar(self, orden: OrdenMedica):
        """
        Sincroniza los cambios del modelo de dominio hacia la base de datos.
        """
        orden_db = self.db.query(OrdenMedicaModel).filter(OrdenMedicaModel.id == orden.id).first()

        if orden_db:
            # Actualizamos únicamente los campos que pueden mutar en nuestros flujos
            orden_db.estado = orden.estado
            orden_db.autorizado_por = orden.autorizado_por
            orden_db.fecha_autorizacion = orden.fecha_autorizacion

            orden_db.sede_id = orden.sede_id
            orden_db.fecha_cita = orden.fecha_cita

            orden_db.documento_generado = orden.documento_generado
            orden_db.fecha_generacion_pdf = orden.fecha_generacion_pdf
            orden_db.ruta_pdf = orden.ruta_pdf

            self.db.commit()
            # Opcional: self.db.refresh(orden_db) si tuviéramos triggers en la BD que modifiquen la data
        else:
            # La lógica actual asume que las órdenes ya ingresaron al sistema (PENDIENTES).
            # Si el sistema también va a CREAR órdenes nuevas, aquí instanciaríamos un OrdenMedicaModel.
            raise NotImplementedError("La creación de órdenes desde cero debe implementarse.")

    def obtener_autorizadas_sin_pdf(self, sede_id: Optional[str] = None) -> List[OrdenMedica]:
        """
        Query diseñada específicamente para el Background Worker / Cron Job.
        """
        query = self.db.query(OrdenMedicaModel).filter(
            OrdenMedicaModel.estado == "AUTORIZADA",
            OrdenMedicaModel.documento_generado == False
        )

        if sede_id:
            query = query.filter(OrdenMedicaModel.sede_id == sede_id)

        # Límite de 100 para procesamiento por lotes (evita desbordamientos de memoria)
        resultados = query.limit(100).all()
        return [self._to_domain(r) for r in resultados]

    def _to_domain(self, model: OrdenMedicaModel) -> OrdenMedica:
        """
        Data Mapper: Convierte el modelo acoplado a SQLAlchemy en una entidad
        pura de Pydantic para la capa de Casos de Uso.
        """
        paciente_domain = Paciente(
            nombre=model.paciente.nombre,
            tipo_documento=model.paciente.tipo_documento,
            sexo=SexoEnum(model.paciente.sexo),
            direccion=model.paciente.direccion,
            telefono=model.paciente.telefono,
            fecha_nacimiento=model.paciente.fecha_nacimiento.date() if model.paciente.fecha_nacimiento else None,
            convenio=model.paciente.convenio,
            regimen=model.paciente.regimen
        )

        return OrdenMedica(
            id=str(model.id),
            numero_orden=model.numero_orden,
            paciente=paciente_domain,
            estudio=model.estudio,
            estado=model.estado,
            autorizado_por=model.autorizado_por,
            fecha_autorizacion=model.fecha_autorizacion,
            sede_id=str(model.sede_id) if model.sede_id else None,
            fecha_cita=model.fecha_cita,
            documento_generado=model.documento_generado,
            fecha_generacion_pdf=model.fecha_generacion_pdf,
            ruta_pdf=model.ruta_pdf
        )