from datetime import datetime
from domain.interfaces import IOrdenRepository


class AutorizacionService:
    def __init__(self, repo: IOrdenRepository):
        self.repo = repo

    def autorizar_orden(self, orden_id: str, usuario_id: str):
        orden = self.repo.obtener_por_id(orden_id)

        if orden.estado == "AUTORIZADA":
            raise ValueError("La orden ya está autorizada.")

        if orden.estado == "RECHAZADA":
            raise ValueError("No se puede autorizar una orden rechazada.")

        orden.estado = "AUTORIZADA"
        orden.autorizado_por = usuario_id
        orden.fecha_autorizacion = datetime.now()

        self.repo.guardar(orden)

        return orden

    def rechazar_orden(self, orden_id: str, usuario_id: str, motivo: str = None):
        orden = self.repo.obtener_por_id(orden_id)

        if orden.estado == "AUTORIZADA":
            raise ValueError("No se puede rechazar una orden que ya fue autorizada.")

        if orden.estado == "RECHAZADA":
            raise ValueError("La orden ya está rechazada.")

        orden.estado = "RECHAZADA"
        orden.autorizado_por = usuario_id
        orden.fecha_autorizacion = datetime.now()

        self.repo.guardar(orden)

        return orden