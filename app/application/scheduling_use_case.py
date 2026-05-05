from datetime import datetime, date
from dateutil.relativedelta import relativedelta
from domain.interfaces import IOrdenRepository, ISedeRepository


class AgendamientoService:
    def __init__(self, orden_repo: IOrdenRepository, sede_repo: ISedeRepository):
        self.orden_repo = orden_repo
        self.sede_repo = sede_repo

    def _validar_reglas_negocio(self, sede_id: str, fecha_hora: datetime):
        # 1. Regla de los 3 meses (Ventana de tiempo)
        hoy = date.today()
        limite_superior = hoy + relativedelta(months=3)
        if not (hoy <= fecha_hora.date() <= limite_superior):
            raise ValueError("La fecha debe estar entre hoy y los próximos 3 meses.")

        # 2. Regla de intervalos de 3 minutos
        if fecha_hora.minute % 3 != 0:
            raise ValueError("Las citas solo pueden agendarse en intervalos de 3 minutos (ej: 00, 03, 06).")

        # 3. Regla de Horario de Sede
        sede = self.sede_repo.obtener_sede(sede_id)
        if not (sede.hora_apertura <= fecha_hora.time() <= sede.hora_cierre):
            raise ValueError(f"La hora está fuera del horario de la sede ({sede.hora_apertura} - {sede.hora_cierre}).")

        # 4. Regla de Capacidad Máxima (ej. 150)
        citas_dia = self.orden_repo.contar_citas_sede_dia(sede_id, fecha_hora.date())
        if citas_dia >= sede.capacidad_diaria:
            raise ValueError(
                f"La sede ha alcanzado su capacidad máxima de {sede.capacidad_diaria} citas para este día.")

        # 5. Regla de Concurrencia (Slot ocupado)
        if self.orden_repo.existe_cita_en_slot(sede_id, fecha_hora):
            raise ValueError("Este horario exacto ya está reservado por otro paciente.")

    def agendar_cita(self, orden_id: str, sede_id: str, fecha_hora: datetime):
        orden = self.orden_repo.obtener_por_id(orden_id)
        if orden.estado != "AUTORIZADA":
            raise ValueError("Solo se pueden agendar órdenes previamente autorizadas.")

        self._validar_reglas_negocio(sede_id, fecha_hora)

        orden.sede_id = sede_id
        orden.fecha_cita = fecha_hora
        self.orden_repo.guardar(orden)

        return orden