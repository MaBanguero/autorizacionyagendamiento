from fastapi import Depends
from sqlalchemy.orm import Session

# Importamos el generador de la BD
from core.database import get_db

# Importamos Interfaces (Contratos)
from domain.interfaces import IOrdenRepository, ISedeRepository, IPDFService

# Importamos Implementaciones Concretas (Infraestructura)
from infrastructure.database.repositories import PostgresOrdenRepository, PostgresSedeRepository
from infrastructure.pdf_service import PDFGeneratorService # El que creamos al inicio

# Importamos Casos de Uso (Aplicación)
from application.scheduling_use_case import AgendamientoService
from application.authorize_use_case import AutorizacionService
from application.document_use_case import DocumentoService

# ==========================================
# 1. PROVIDERS DE INFRAESTRUCTURA
# ==========================================

def get_sede_repository(db: Session = Depends(get_db)) -> ISedeRepository:
    """Inyecta la sesión de BD en el repositorio de Postgres para Sedes"""
    return PostgresSedeRepository(db)

def get_orden_repository(db: Session = Depends(get_db)) -> IOrdenRepository:
    """Inyecta la sesión de BD en el repositorio de Postgres para Órdenes"""
    return PostgresOrdenRepository(db)

def get_pdf_service() -> IPDFService:
    """Retorna el servicio de generación de PDFs"""
    # Si en el futuro cambias a WeasyPrint o un microservicio externo,
    # solo cambias esta línea. El resto del sistema no se entera.
    return PDFGeneratorService(output_dir="/var/www/html/pdfs_autorizaciones")


# ==========================================
# 2. PROVIDERS DE CASOS DE USO (SERVICIOS)
# ==========================================

def get_agendamiento_service(
    orden_repo: IOrdenRepository = Depends(get_orden_repository),
    sede_repo: ISedeRepository = Depends(get_sede_repository)
) -> AgendamientoService:
    """Construye el servicio de agendamiento inyectando sus repositorios"""
    return AgendamientoService(orden_repo, sede_repo)

def get_autorizacion_service(
    orden_repo: IOrdenRepository = Depends(get_orden_repository)
) -> AutorizacionService:
    """Construye el servicio de autorización"""
    return AutorizacionService(orden_repo)

def get_documento_service(
    orden_repo: IOrdenRepository = Depends(get_orden_repository),
    pdf_service: IPDFService = Depends(get_pdf_service)
) -> DocumentoService:
    """Construye el servicio de documentos uniendo BD y motor PDF"""
    return DocumentoService(orden_repo, pdf_service)