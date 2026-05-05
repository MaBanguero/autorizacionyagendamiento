from datetime import date, datetime, timedelta
from domain.interfaces import IOrdenRepository, ISedeRepository


class ConsultaService:
    def __init__(self, orden_repo: IOrdenRepository, sede_repo: ISedeRepository):
        self.orden_repo = orden_repo
        self.sede_repo = sede_repo

    def listar_sedes(self):
        return self.sede_repo.listar_sedes()

    def obtener_sede(self, sede_id: str):
        return self.sede_repo.obtener_sede(sede_id)

    def listar_ordenes(
        self,
        estado=None,
        sede_id=None,
        documento_generado=None,
        limit=50,
        offset=0
    ):
        return self.orden_repo.listar_ordenes(
            estado=estado,
            sede_id=sede_id,
            documento_generado=documento_generado,
            limit=limit,
            offset=offset
        )

    def obtener_orden(self, orden_id: str):
        return self.orden_repo.obtener_por_id(orden_id)

    def buscar_por_numero_orden(self, numero_orden: str):
        return self.orden_repo.buscar_por_numero_orden(numero_orden)

    def disponibilidad_sede_dia(self, sede_id: str, fecha: date):
        sede = self.sede_repo.obtener_sede(sede_id)

        slots_ocupados = self.orden_repo.obtener_slots_ocupados_sede_dia(
            sede_id=sede_id,
            fecha=fecha
        )

        slots_ocupados_set = set(slots_ocupados)

        slots = []

        hora_actual = datetime.combine(fecha, sede.hora_apertura)
        hora_cierre = datetime.combine(fecha, sede.hora_cierre)

        while hora_actual <= hora_cierre:
            ocupado = hora_actual in slots_ocupados_set

            slots.append({
                "fecha_hora": hora_actual,
                "hora": hora_actual.strftime("%H:%M"),
                "disponible": not ocupado,
                "estado": "OCUPADO" if ocupado else "DISPONIBLE"
            })

            hora_actual += timedelta(minutes=3)

        total_slots = len(slots)
        ocupados = len([s for s in slots if not s["disponible"]])
        disponibles = len([s for s in slots if s["disponible"]])

        return {
            "sede_id": sede.id,
            "sede": sede.nombre,
            "fecha": fecha,
            "hora_apertura": sede.hora_apertura,
            "hora_cierre": sede.hora_cierre,
            "capacidad_diaria": sede.capacidad_diaria,
            "total_slots": total_slots,
            "slots_ocupados": ocupados,
            "slots_disponibles": disponibles,
            "slots": slots
        }

    def dashboard_resumen(self):
        ordenes = self.orden_repo.listar_ordenes(limit=1000, offset=0)

        total = len(ordenes)
        pendientes = len([o for o in ordenes if o.estado == "PENDIENTE"])
        autorizadas = len([o for o in ordenes if o.estado == "AUTORIZADA"])
        rechazadas = len([o for o in ordenes if o.estado == "RECHAZADA"])
        agendadas = len([o for o in ordenes if o.fecha_cita is not None])
        pdf_generados = len([o for o in ordenes if o.documento_generado])
        pdf_pendientes = len([o for o in ordenes if o.estado == "AUTORIZADA" and not o.documento_generado])

        return {
            "total_ordenes": total,
            "pendientes": pendientes,
            "autorizadas": autorizadas,
            "rechazadas": rechazadas,
            "agendadas": agendadas,
            "pdf_generados": pdf_generados,
            "pdf_pendientes": pdf_pendientes
        }