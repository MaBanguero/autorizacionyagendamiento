"""
Carga los procedimientos CUPS en la BD si no existen.
Se ejecuta automáticamente desde entrypoint.sh.
"""
import json
from pathlib import Path
from core.database import SessionLocal
from infrastructure.database.models import ProcedimientoModel


def seed():
    json_path = Path(__file__).parent / "seed_procedimientos.json"
    if not json_path.exists():
        print("  ⚠ No se encontró seed_procedimientos.json, omitiendo.")
        return

    with open(json_path, "r", encoding="utf-8") as f:
        data = json.load(f)

    db = SessionLocal()
    insertados = 0
    try:
        for item in data:
            existe = db.query(ProcedimientoModel).filter(
                ProcedimientoModel.codigo == item["codigo"]
            ).first()
            if not existe:
                db.add(ProcedimientoModel(
                    codigo=item["codigo"],
                    nombre=item["nombre"],
                    grupo=item.get("grupo") or None,
                    agrupador=item.get("agrupador") or None,
                ))
                insertados += 1
        db.commit()
        print(f"  ✅ {insertados} procedimientos nuevos, {len(data)} en total")
    except Exception as e:
        db.rollback()
        print(f"  ⚠ Error: {e}")
    finally:
        db.close()


if __name__ == "__main__":
    seed()
