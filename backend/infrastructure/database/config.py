"""
Configuración de base de datos (SessionLocal) para autenticación y consultas directas.
Re-exporta desde core.database para mantener compatibilidad con el código existente.
"""

from core.database import SessionLocal, engine, get_db
