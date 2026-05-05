from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
import os

# En producción, esto vendría de tu archivo .env en tu servidor Ubuntu/Docker
DATABASE_URL = os.getenv(
    "DATABASE_URL",
    "postgresql://usuario:password@localhost:5432/sistema_medico"
)

engine = create_engine(DATABASE_URL, pool_pre_ping=True, pool_size=10, max_overflow=20)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

def get_db():
    """
    Generador de sesión de base de datos para inyección de dependencias.
    Garantiza que la conexión se cierre incluso si hay un error en el request.
    """
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()