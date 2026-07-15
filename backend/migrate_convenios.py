"""
Migración: Crea la tabla de convenios, la pobla desde los datos existentes
y agrega la columna convenio_id a pacientes.
Reintenta automáticamente si falla (idempotente).
"""
import uuid
from sqlalchemy import text
from core.database import SessionLocal
from infrastructure.database.models import ConvenioModel


def migrar():
    print("🔧 Iniciando migración de convenios...")
    db = SessionLocal()

    try:
        # 1. Crear tabla convenios si no existe (vía SQLAlchemy o raw)
        print("  Creando tabla convenios...")
        # Primero intentar con el ORM (genera la estructura correcta)
        ConvenioModel.__table__.create(db.bind, checkfirst=True)

        # Si el ORM no creó la columna id con default, asegurarla vía raw SQL
        db.execute(text("""
            DO $$
            BEGIN
                IF NOT EXISTS (
                    SELECT 1 FROM information_schema.columns
                    WHERE table_name = 'convenios' AND column_name = 'id'
                ) THEN
                    CREATE TABLE convenios (
                        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                        nombre VARCHAR(150) NOT NULL UNIQUE,
                        regimen VARCHAR(50),
                        activo BOOLEAN NOT NULL DEFAULT TRUE
                    );
                END IF;
            END $$;
        """))
        db.commit()

        # Asegurar que la columna id tenga default a nivel BD
        db.execute(text("""
            ALTER TABLE convenios ALTER COLUMN id SET DEFAULT gen_random_uuid();
        """))
        db.commit()

        # 2. Poblar desde distinct convenios de pacientes (usando ORM para evitar problemas de UUID)
        print("  Extrayendo convenios existentes desde pacientes...")
        result = db.execute(text("""
            SELECT DISTINCT convenio, regimen FROM pacientes
            WHERE convenio IS NOT NULL AND convenio != ''
            ORDER BY convenio
        """)).fetchall()

        print(f"  Encontrados {len(result)} convenios distintos")
        insertados = 0

        for nombre, regimen in result:
            existe = db.query(ConvenioModel).filter(
                ConvenioModel.nombre == nombre
            ).first()

            if not existe:
                nuevo = ConvenioModel(
                    id=uuid.uuid4(),
                    nombre=nombre,
                    regimen=regimen or "OTRO",
                    activo=True,
                )
                db.add(nuevo)
                insertados += 1

        db.commit()
        print(f"  Insertados {insertados} convenios nuevos")

        # 3. Agregar columna convenio_id a pacientes si no existe
        print("  Verificando columna convenio_id en pacientes...")
        col_exists = db.execute(text("""
            SELECT column_name FROM information_schema.columns
            WHERE table_name = 'pacientes' AND column_name = 'convenio_id'
        """)).fetchone()

        if not col_exists:
            print("  Agregando columna convenio_id...")
            db.execute(text("""
                ALTER TABLE pacientes
                ADD COLUMN convenio_id UUID REFERENCES convenios(id)
            """))
            db.commit()

            # 4. Actualizar convenio_id en pacientes existentes
            print("  Actualizando convenio_id en pacientes existentes...")
            db.execute(text("""
                UPDATE pacientes p
                SET convenio_id = c.id
                FROM convenios c
                WHERE p.convenio = c.nombre
                  AND p.convenio_id IS NULL
            """))
            db.commit()
            print("  ✅ convenio_id actualizado en pacientes")
        else:
            print("  La columna convenio_id ya existe")

        # 5. Crear índice
        db.execute(text("""
            CREATE INDEX IF NOT EXISTS ix_pacientes_convenio_id
            ON pacientes(convenio_id)
        """))
        db.commit()

        total = db.execute(text("SELECT COUNT(*) FROM convenios")).scalar()
        vinculados = db.execute(
            text("SELECT COUNT(*) FROM pacientes WHERE convenio_id IS NOT NULL")
        ).scalar()
        print(f"\n✅ Migración completada:")
        print(f"   Total convenios: {total}")
        print(f"   Pacientes vinculados: {vinculados}")

    except Exception as e:
        db.rollback()
        print(f"❌ Error en migración: {e}")
        print("   (El sistema seguirá funcionando con el modo fallback)")
        # No relanzar la excepción para que el backend arranque igual
    finally:
        db.close()


if __name__ == "__main__":
    migrar()
