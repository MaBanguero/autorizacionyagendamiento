"""
Script de importación masiva de pacientes desde CSV de ESENORTE3.
Mapea las columnas del CSV al modelo PacienteModel y realiza inserción batch.
"""

import csv
import sys
import uuid
from datetime import datetime
from pathlib import Path

from sqlalchemy import text
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Session
from core.database import SessionLocal, engine
from core.database import DATABASE_URL as DB_URL


# Columnas del CSV
COL_CONVENIO_ID = "id_convenio"
COL_CONVENIO_NOMBRE = "convenionombre"
COL_TIPO_DOC = "tipodocu"
COL_IDENTIFICACION = "identificacion"
COL_NOMBRE1 = "nombre1"
COL_NOMBRE2 = "nombre2"
COL_APELLIDO1 = "apellido1"
COL_APELLIDO2 = "apellido2"
COL_SEXO = "sexo"
COL_FECHA_NAC = "fechanacimiento"
COL_ESTADO = "estado"

# Tamaño de lote para inserts
BATCH_SIZE = 500


def extraer_regimen(nombre_convenio: str) -> str:
    """Extrae el régimen del nombre del convenio (CONTRIBUTIVO / SUBSIDIADO / Otro)."""
    nombre = nombre_convenio.upper()
    if "CONTRIBUTIVO" in nombre or "CONT" in nombre:
        return "CONTRIBUTIVO"
    elif "SUBSIDIADO" in nombre or "SUB" in nombre:
        return "SUBSIDIADO"
    else:
        return "OTRO"


def limpiar_valor(valor: str) -> str:
    """Limpia comillas dobles escapadas y espacios."""
    if valor is None:
        return ""
    valor = valor.strip().strip('"').strip("'")
    valor = valor.replace('""', "").strip()
    return valor


def construir_nombre_completo(row: dict) -> str:
    """Construye el nombre completo: nombre1 nombre2 apellido1 apellido2"""
    partes = [
        limpiar_valor(row.get(COL_NOMBRE1, "")),
        limpiar_valor(row.get(COL_NOMBRE2, "")),
        limpiar_valor(row.get(COL_APELLIDO1, "")),
        limpiar_valor(row.get(COL_APELLIDO2, "")),
    ]
    # Filtrar vacíos
    partes = [p for p in partes if p]
    return " ".join(partes) if partes else "SIN NOMBRE"


def parsear_fecha(fecha_str: str) -> datetime:
    """Parsea fecha en formato YYYY-MM-DD."""
    try:
        return datetime.strptime(fecha_str.strip(), "%Y-%m-%d")
    except (ValueError, AttributeError):
        return datetime(1900, 1, 1)


def validar_sexo(sexo: str) -> str:
    """Valida y normaliza el sexo (M, F, O)."""
    s = sexo.strip().upper() if sexo else "O"
    if s not in ("M", "F", "O"):
        return "O"
    return s


def validar_tipo_documento(tipo: str) -> str:
    """Valida y normaliza tipo de documento."""
    t = tipo.strip().upper() if tipo else "CC"
    validos = {"CC", "TI", "CE", "PT", "RC", "PA", "MS", "AS"}
    return t if t in validos else "CC"


def importar_pacientes(csv_path: str) -> dict:
    """
    Importa pacientes desde CSV.
    Retorna dict con estadísticas: total, insertados, omitidos, errores.
    """
    stats = {"total": 0, "insertados": 0, "omitidos_duplicados": 0, "errores": 0, "errores_detalle": []}

    db: Session = SessionLocal()
    try:
        # Obtener identificaciones existentes para evitar duplicados
        existentes = set(
            row[0] for row in db.execute(text("SELECT numero_documento FROM pacientes")).fetchall()
        )
        print(f"📊 Pacientes ya existentes en BD: {len(existentes)}")

        with open(csv_path, mode="r", encoding="utf-8-sig") as f:
            reader = csv.DictReader(f, delimiter="\t")

            batch = []
            for fila_idx, row in enumerate(reader, start=2):  # start=2 porque línea 1 es header
                stats["total"] += 1

                try:
                    identificacion = limpiar_valor(row.get(COL_IDENTIFICACION, ""))
                    if not identificacion:
                        stats["errores"] += 1
                        stats["errores_detalle"].append(f"Línea {fila_idx}: identificación vacía")
                        continue

                    if identificacion in existentes:
                        stats["omitidos_duplicados"] += 1
                        continue

                    tipo_doc = validar_tipo_documento(row.get(COL_TIPO_DOC, "CC"))
                    nombre = construir_nombre_completo(row)
                    sexo = validar_sexo(row.get(COL_SEXO, "O"))
                    fecha_nac = parsear_fecha(row.get(COL_FECHA_NAC, ""))

                    # Si fecha_nac es futura, ajustar
                    if fecha_nac > datetime.now():
                        fecha_nac = datetime(1900, 1, 1)

                    convenio_nombre = limpiar_valor(row.get(COL_CONVENIO_NOMBRE, "SIN CONVENIO"))
                    regimen = extraer_regimen(convenio_nombre)

                    paciente = {
                        "id": uuid.uuid4(),
                        "tipo_documento": tipo_doc,
                        "numero_documento": identificacion,
                        "nombre": nombre,
                        "sexo": sexo,
                        "direccion": "SIN DIRECCION",
                        "telefono": "0000000000",
                        "fecha_nacimiento": fecha_nac,
                        "convenio": convenio_nombre,
                        "regimen": regimen,
                        "municipio_id": None,
                    }

                    batch.append(paciente)
                    existentes.add(identificacion)  # evitar duplicados dentro del mismo batch

                    # Insertar batch cuando se llena
                    if len(batch) >= BATCH_SIZE:
                        _insertar_batch(db, batch)
                        stats["insertados"] += len(batch)
                        print(f"  ✓ Insertados {stats['insertados']} / {stats['total']} registros...")
                        batch = []

                except Exception as e:
                    stats["errores"] += 1
                    stats["errores_detalle"].append(f"Línea {fila_idx}: {e}")

            # Insertar lote final
            if batch:
                _insertar_batch(db, batch)
                stats["insertados"] += len(batch)
                print(f"  ✓ Insertados {stats['insertados']} / {stats['total']} registros...")

        db.commit()
        print(f"\n✅ Importación completada.")

    except Exception as e:
        db.rollback()
        print(f"\n❌ Error fatal: {e}", file=sys.stderr)
        raise
    finally:
        db.close()

    return stats


def _insertar_batch(db: Session, batch: list):
    """Inserta un lote de pacientes usando SQLAlchemy Core para mejor performance."""
    from sqlalchemy import Table, MetaData, Column, String, DateTime, Boolean, Integer
    from sqlalchemy.dialects.postgresql import UUID, ENUM
    from infrastructure.database.models import PacienteModel

    db.bulk_insert_mappings(PacienteModel, batch)
    db.flush()


def main():
    # Determinar ruta del CSV
    rutas_posibles = [
        sys.argv[1] if len(sys.argv) > 1 else None,
        "/app/importar_pacientes.csv",
        "./importar_pacientes.csv",
        str(Path(__file__).parent / "importar_pacientes.csv"),
    ]

    csv_path = None
    for r in rutas_posibles:
        if r and Path(r).exists():
            csv_path = r
            break

    if not csv_path:
        print("❌ No se encontró el archivo CSV.")
        print("   Uso: python importar_pacientes.py <ruta_al_csv>")
        print("   O coloca el CSV como 'importar_pacientes.csv' en este directorio.")
        sys.exit(1)

    print(f"📁 Leyendo CSV: {csv_path}")
    print("=" * 60)

    stats = importar_pacientes(csv_path)

    print("=" * 60)
    print(f"📊 RESUMEN FINAL:")
    print(f"   Total registros en CSV:  {stats['total']}")
    print(f"   ✅ Insertados:           {stats['insertados']}")
    print(f"   ⏭️  Omitidos (duplicados): {stats['omitidos_duplicados']}")
    print(f"   ❌ Errores:              {stats['errores']}")
    if stats["errores_detalle"]:
        print(f"\n   Primeros errores:")
        for e in stats["errores_detalle"][:10]:
            print(f"     • {e}")
    print(f"\n   Total pacientes en BD: ", end="")
    db = SessionLocal()
    try:
        total = db.execute(text("SELECT COUNT(*) FROM pacientes")).scalar()
        print(total)
    finally:
        db.close()


if __name__ == "__main__":
    main()
