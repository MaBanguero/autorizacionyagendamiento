from domain.interfaces import IOrdenRepository
from domain.models import OrdenMedica


class OrdenService:
    def __init__(self, orden_repo: IOrdenRepository):
        self.orden_repo = orden_repo

    def crear_orden(self, orden: OrdenMedica):
        orden.estado = "PENDIENTE"
        orden.documento_generado = False
        return self.orden_repo.crear_orden(orden)