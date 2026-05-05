from abc import ABC, abstractmethod
from datetime import datetime, date
from typing import List, Optional
from .models import OrdenMedica, Sede


class ISedeRepository(ABC):
    @abstractmethod
    def obtener_sede(self, sede_id: str) -> Sede:
        pass

    @abstractmethod
    def listar_sedes(self) -> List[Sede]:
        pass


class IOrdenRepository(ABC):
    @abstractmethod
    def obtener_por_id(self, orden_id: str) -> OrdenMedica:
        pass

    @abstractmethod
    def contar_citas_sede_dia(self, sede_id: str, fecha: date) -> int:
        pass

    @abstractmethod
    def existe_cita_en_slot(self, sede_id: str, fecha_hora: datetime) -> bool:
        pass

    @abstractmethod
    def obtener_por_id(self, orden_id: str) -> OrdenMedica:
        pass

    @abstractmethod
    def crear_orden(self, orden: OrdenMedica) -> OrdenMedica:
        pass

    @abstractmethod
    def listar_ordenes(
            self,
            estado: Optional[str] = None,
            sede_id: Optional[str] = None,
            documento_generado: Optional[bool] = None,
            limit: int = 50,
            offset: int = 0
    ) -> List[OrdenMedica]:
        pass

    @abstractmethod
    def buscar_por_numero_orden(self, numero_orden: str) -> OrdenMedica:
        pass

    @abstractmethod
    def guardar(self, orden: OrdenMedica):
        pass

    @abstractmethod
    def obtener_autorizadas_sin_pdf(self, sede_id: Optional[str] = None) -> List[OrdenMedica]:
        pass

    @abstractmethod
    def obtener_slots_ocupados_sede_dia(self, sede_id: str, fecha: date) -> List[datetime]:
        pass


class IPDFService(ABC):
    @abstractmethod
    def generar_pdf_firmado(self, orden: OrdenMedica) -> str:
        """Genera el PDF y retorna la ruta del archivo"""
        pass