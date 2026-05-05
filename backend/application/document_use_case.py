from datetime import datetime
from domain.interfaces import IOrdenRepository, IPDFService


class AutorizacionService:
    def __init__(self, repo: IOrdenRepository):
        self.repo = repo

    def autorizar_orden(self, orden_id: str, usuario_id: str):
        orden = self.repo.obtener_por_id(orden_id)
        orden.estado = "AUTORIZADA"
        orden.autorizado_por = usuario_id
        # La fecha se inyecta en el backend, no es editable por el usuario
        orden.fecha_autorizacion = datetime.now()
        self.repo.guardar(orden)
        return orden


class DocumentoService:
    def __init__(self, repo: IOrdenRepository, pdf_service: IPDFService):
        self.repo = repo
        self.pdf_service = pdf_service

    def generar_individual(self, orden_id: str):
        orden = self.repo.obtener_por_id(orden_id)
        if orden.estado != "AUTORIZADA":
            raise ValueError("No se puede generar PDF de una orden no autorizada.")

        ruta = self.pdf_service.generar_pdf_firmado(orden)
        orden.documento_generado = True
        orden.fecha_generacion_pdf = datetime.now()
        orden.ruta_pdf = ruta
        self.repo.guardar(orden)
        return ruta

    def generar_masivo_background(self, sede_id: str = None):
        """Este método está diseñado para ser llamado por Celery o BackgroundTasks"""
        ordenes = self.repo.obtener_autorizadas_sin_pdf(sede_id)
        rutas_generadas = []
        for orden in ordenes:
            try:
                ruta = self.generar_individual(orden.id)
                rutas_generadas.append(ruta)
            except Exception as e:
                print(f"Error procesando orden {orden.id}: {e}")
                # Aquí implementaríamos logs adecuados para tu infraestructura
        return rutas_generadas