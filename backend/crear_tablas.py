from infrastructure.database.models import Base
from core.database import engine


def crear_tablas():
    print("Creando tablas...")
    Base.metadata.create_all(bind=engine)
    print("Tablas creadas correctamente.")


if __name__ == "__main__":
    crear_tablas()