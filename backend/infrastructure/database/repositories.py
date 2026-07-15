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

    def listar_sedes(self) -> List[Sede]:
        sedes_db = self.db.query(SedeModel).order_by(SedeModel.nombre.asc()).all()

        return [
            Sede(
                id=str(s.id),
                nombre=s.nombre,
                hora_apertura=s.hora_apertura,
                hora_cierre=s.hora_cierre,
                capacidad_diaria=s.capacidad_diaria
            )
            for s in sedes_db
        ]

    def crear_sede(self, nombre: str, hora_apertura: str, hora_cierre: str, capacidad_diaria: int) -> Sede:
        from datetime import time as time_type
        from infrastructure.database.models import SedeModel

        nueva = SedeModel(
            nombre=nombre,
            hora_apertura=time_type.fromisoformat(hora_apertura),
            hora_cierre=time_type.fromisoformat(hora_cierre),
            capacidad_diaria=capacidad_diaria,
        )
        self.db.add(nueva)
        self.db.commit()
        self.db.refresh(nueva)

        return Sede(
            id=str(nueva.id),
            nombre=nueva.nombre,
            hora_apertura=nueva.hora_apertura,
            hora_cierre=nueva.hora_cierre,
            capacidad_diaria=nueva.capacidad_diaria,
        )

    def actualizar_sede(self, sede_id: str, nombre: str, hora_apertura: str, hora_cierre: str, capacidad_diaria: int) -> Sede:
        from datetime import time as time_type

        sede_db = self.db.query(SedeModel).filter(SedeModel.id == sede_id).first()
        if not sede_db:
            raise ValueError(f"Sede con ID {sede_id} no encontrada.")

        sede_db.nombre = nombre
        sede_db.hora_apertura = time_type.fromisoformat(hora_apertura)
        sede_db.hora_cierre = time_type.fromisoformat(hora_cierre)
        sede_db.capacidad_diaria = capacidad_diaria
        self.db.commit()
        self.db.refresh(sede_db)

        return Sede(
            id=str(sede_db.id),
            nombre=sede_db.nombre,
            hora_apertura=sede_db.hora_apertura,
            hora_cierre=sede_db.hora_cierre,
            capacidad_diaria=sede_db.capacidad_diaria,
        )

    def eliminar_sede(self, sede_id: str) -> None:
        sede_db = self.db.query(SedeModel).filter(SedeModel.id == sede_id).first()
        if not sede_db:
            raise ValueError(f"Sede con ID {sede_id} no encontrada.")
        self.db.delete(sede_db)
        self.db.commit()


class PostgresOrdenRepository(IOrdenRepository):
    def __init__(self, db_session: Session):
        self.db = db_session

    def crear_orden(self, orden: OrdenMedica) -> OrdenMedica:
        paciente_db = (
            self.db.query(PacienteModel)
            .filter(PacienteModel.numero_documento == orden.paciente.numero_documento)
            .first()
        )

        if not paciente_db:
            paciente_db = PacienteModel(
                tipo_documento=orden.paciente.tipo_documento,
                numero_documento=orden.paciente.numero_documento,
                nombre=orden.paciente.nombre,
                sexo=orden.paciente.sexo.value,
                direccion=orden.paciente.direccion,
                telefono=orden.paciente.telefono,
                fecha_nacimiento=orden.paciente.fecha_nacimiento,
                convenio=orden.paciente.convenio,
                regimen=orden.paciente.regimen,
            )

            self.db.add(paciente_db)
            self.db.flush()

        orden_db = OrdenMedicaModel(
            numero_orden=orden.numero_orden,
            paciente_id=paciente_db.id,
            estudio=orden.estudio,
            estado="PENDIENTE",
            documento_generado=False
        )

        self.db.add(orden_db)
        self.db.commit()
        self.db.refresh(orden_db)

        return self._to_domain(orden_db)

    def obtener_por_id(self, orden_id: str) -> OrdenMedica:
        # SQLAlchemy hará un join automático con paciente gracias a los relationships del modelo
        orden_db = self.db.query(OrdenMedicaModel).filter(OrdenMedicaModel.id == orden_id).first()
        if not orden_db:
            raise ValueError(f"Orden médica con ID {orden_id} no encontrada.")

        return self._to_domain(orden_db)

    def contar_citas_sede_dia(self, sede_id: str, fecha: date) -> int:
        inicio_dia = datetime.combine(fecha, datetime.min.time())
        fin_dia = datetime.combine(fecha, datetime.max.time())

        conteo = self.db.query(func.count(OrdenMedicaModel.id)) \
            .filter(OrdenMedicaModel.sede_id == sede_id) \
            .filter(OrdenMedicaModel.fecha_cita >= inicio_dia) \
            .filter(OrdenMedicaModel.fecha_cita <= fin_dia) \
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
        orden_db = (
            self.db.query(OrdenMedicaModel)
            .filter(OrdenMedicaModel.id == orden.id)
            .first()
        )

        if not orden_db:
            raise NotImplementedError("La creación de órdenes desde cero debe implementarse.")

        orden_db.estado = orden.estado
        orden_db.autorizado_por = orden.autorizado_por
        orden_db.fecha_autorizacion = orden.fecha_autorizacion

        orden_db.sede_id = orden.sede_id
        orden_db.fecha_cita = orden.fecha_cita

        orden_db.documento_generado = orden.documento_generado
        orden_db.fecha_generacion_pdf = orden.fecha_generacion_pdf
        orden_db.ruta_pdf = orden.ruta_pdf

        try:
            self.db.commit()
            self.db.refresh(orden_db)
        except Exception:
            self.db.rollback()
            raise

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
        municipio_id = str(model.paciente.municipio_id) if model.paciente.municipio_id else None
        paciente_domain = Paciente(
            nombre=model.paciente.nombre,
            tipo_documento=model.paciente.tipo_documento,
            numero_documento=model.paciente.numero_documento,
            sexo=SexoEnum(model.paciente.sexo),
            direccion=model.paciente.direccion,
            telefono=model.paciente.telefono,
            fecha_nacimiento=model.paciente.fecha_nacimiento.date() if model.paciente.fecha_nacimiento else None,
            convenio=model.paciente.convenio,
            regimen=model.paciente.regimen,
            municipio_id=municipio_id,
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

    def listar_ordenes(
            self,
            estado: Optional[str] = None,
            sede_id: Optional[str] = None,
            con_cita: Optional[bool] = None,
            documento_generado: Optional[bool] = None,
            limit: int = 50,
            offset: int = 0
    ) -> List[OrdenMedica]:

        query = self.db.query(OrdenMedicaModel)

        if estado:
            query = query.filter(OrdenMedicaModel.estado == estado)

        if sede_id:
            query = query.filter(OrdenMedicaModel.sede_id == sede_id)

        if con_cita is True:
            query = query.filter(OrdenMedicaModel.fecha_cita.isnot(None))
        elif con_cita is False:
            query = query.filter(OrdenMedicaModel.fecha_cita.is_(None))

        if documento_generado is not None:
            query = query.filter(OrdenMedicaModel.documento_generado == documento_generado)

        resultados = (
            query
            .order_by(OrdenMedicaModel.fecha_cita.desc().nullslast())
            .offset(offset)
            .limit(limit)
            .all()
        )

        return [self._to_domain(r) for r in resultados]

    def obtener_slots_ocupados_sede_dia(self, sede_id: str, fecha: date) -> List[datetime]:
        inicio_dia = datetime.combine(fecha, datetime.min.time())
        fin_dia = datetime.combine(fecha, datetime.max.time())

        resultados = (
            self.db.query(OrdenMedicaModel.fecha_cita)
            .filter(OrdenMedicaModel.sede_id == sede_id)
            .filter(OrdenMedicaModel.fecha_cita >= inicio_dia)
            .filter(OrdenMedicaModel.fecha_cita <= fin_dia)
            .filter(OrdenMedicaModel.fecha_cita.isnot(None))
            .all()
        )

        return [r[0] for r in resultados]

    def buscar_por_numero_orden(self, numero_orden: str) -> OrdenMedica:
        orden_db = (
            self.db.query(OrdenMedicaModel)
            .filter(OrdenMedicaModel.numero_orden == numero_orden)
            .first()
        )

        if not orden_db:
            raise ValueError(f"Orden con número {numero_orden} no encontrada.")

        return self._to_domain(orden_db)


class PostgresPacienteRepository:
    def __init__(self, db_session: Session):
        self.db = db_session

    def buscar_por_documento(self, numero_documento: str):
        paciente = (
            self.db.query(PacienteModel)
            .filter(PacienteModel.numero_documento == numero_documento.strip())
            .first()
        )
        if not paciente:
            return None
        return self._to_dict(paciente)

    def buscar_por_nombre(self, query: str, limit: int = 20):
        termino = f"%{query.strip()}%"
        pacientes = (
            self.db.query(PacienteModel)
            .filter(PacienteModel.nombre.ilike(termino))
            .order_by(PacienteModel.nombre.asc())
            .limit(limit)
            .all()
        )
        return [self._to_dict(p) for p in pacientes]

    def crear_paciente(self, data: dict):
        from datetime import datetime as dt

        paciente = PacienteModel(
            tipo_documento=data["tipo_documento"],
            numero_documento=data["numero_documento"].strip(),
            nombre=data["nombre"].strip(),
            sexo=data["sexo"],
            direccion=data.get("direccion", ""),
            telefono=data.get("telefono", ""),
            fecha_nacimiento=data["fecha_nacimiento"],
            convenio=data["convenio"],
            regimen=data["regimen"],
        )
        self.db.add(paciente)
        self.db.commit()
        self.db.refresh(paciente)
        return self._to_dict(paciente)

    def listar_pacientes(self, query: str = "", limit: int = 50, offset: int = 0):
        q = self.db.query(PacienteModel)

        if query:
            termino = f"%{query.strip()}%"
            q = q.filter(
                PacienteModel.nombre.ilike(termino)
                | PacienteModel.numero_documento.ilike(termino)
            )

        total = q.count()

        pacientes = (
            q
            .order_by(PacienteModel.nombre.asc())
            .offset(offset)
            .limit(limit)
            .all()
        )

        return {
            "total": total,
            "limit": limit,
            "offset": offset,
            "pacientes": [self._to_dict(p) for p in pacientes],
        }

    def importar_masivo(self, rows: list[dict]) -> dict:
        """
        Importa una lista de pacientes en batch.
        Cada row debe tener: tipo_documento, numero_documento, nombre, sexo,
        fecha_nacimiento, convenio, regimen.
        Opcional: direccion, telefono.
        """
        from datetime import datetime as dt

        # Obtener documentos existentes
        existentes = set(
            row[0] for row in self.db.query(PacienteModel.numero_documento).all()
        )

        insertados = 0
        omitidos = 0
        errores = []
        batch = []
        BATCH_SIZE = 500

        def extraer_regimen(nombre_convenio: str) -> str:
            n = nombre_convenio.upper() if nombre_convenio else ""
            if "CONTRIBUTIVO" in n or "CONT" in n:
                return "CONTRIBUTIVO"
            elif "SUBSIDIADO" in n or "SUB" in n:
                return "SUBSIDIADO"
            else:
                return "OTRO"

        for idx, row in enumerate(rows):
            try:
                num_doc = row.get("numero_documento", "").strip()
                if not num_doc:
                    errores.append(f"Fila {idx + 1}: número de documento vacío")
                    continue

                if num_doc in existentes:
                    omitidos += 1
                    continue

                fecha_nac = row.get("fecha_nacimiento")
                if isinstance(fecha_nac, str):
                    fecha_nac = dt.strptime(fecha_nac.strip(), "%Y-%m-%d")

                if fecha_nac and fecha_nac > dt.now():
                    fecha_nac = dt(1900, 1, 1)

                if not fecha_nac:
                    fecha_nac = dt(1900, 1, 1)

                sexo = row.get("sexo", "O").strip().upper()
                if sexo not in ("M", "F", "O"):
                    sexo = "O"

                tipo_doc = row.get("tipo_documento", "CC").strip().upper()
                validos = {"CC", "TI", "CE", "PT", "RC", "PA", "MS", "AS"}
                if tipo_doc not in validos:
                    tipo_doc = "CC"

                convenio = row.get("convenio", "SIN CONVENIO")
                regimen = row.get("regimen", "") or extraer_regimen(convenio)

                paciente = {
                    "tipo_documento": tipo_doc,
                    "numero_documento": num_doc,
                    "nombre": row.get("nombre", "").strip(),
                    "sexo": sexo,
                    "direccion": row.get("direccion", "SIN DIRECCION"),
                    "telefono": row.get("telefono", "0000000000"),
                    "fecha_nacimiento": fecha_nac,
                    "convenio": convenio,
                    "regimen": regimen,
                }

                batch.append(paciente)
                existentes.add(num_doc)

                if len(batch) >= BATCH_SIZE:
                    self.db.bulk_insert_mappings(PacienteModel, batch)
                    self.db.flush()
                    insertados += len(batch)
                    batch = []

            except Exception as e:
                errores.append(f"Fila {idx + 1}: {e}")

        if batch:
            self.db.bulk_insert_mappings(PacienteModel, batch)
            self.db.flush()
            insertados += len(batch)

        self.db.commit()

        return {
            "insertados": insertados,
            "omitidos_duplicados": omitidos,
            "errores": len(errores),
            "detalle_errores": errores[:20],
        }

    def listar_convenios(self, query: str = ""):
        q = self.db.query(PacienteModel.convenio).distinct()
        if query:
            q = q.filter(PacienteModel.convenio.ilike(f"%{query.strip()}%"))
        resultados = q.order_by(PacienteModel.convenio.asc()).all()
        return [r[0] for r in resultados if r[0]]

    def _to_dict(self, model):
        from datetime import datetime
        fn = model.fecha_nacimiento
        if isinstance(fn, datetime):
            fn = fn.date()
        return {
            "id": str(model.id),
            "tipo_documento": model.tipo_documento,
            "numero_documento": model.numero_documento,
            "nombre": model.nombre,
            "sexo": model.sexo,
            "direccion": model.direccion,
            "telefono": model.telefono,
            "fecha_nacimiento": fn.isoformat() if fn else None,
            "convenio": model.convenio,
            "regimen": model.regimen,
            "municipio_id": str(model.municipio_id) if model.municipio_id else None,
        }