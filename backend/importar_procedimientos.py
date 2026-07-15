"""
Importa procedimientos desde el Excel de CUPS.
Uso: python importar_procedimientos.py <ruta_al_excel.xlsx>
"""
import sys
from pathlib import Path
from core.database import SessionLocal
from infrastructure.database.models import ProcedimientoModel


def importar(ruta_excel: str):
    try:
        import openpyxl
    except ImportError:
        print("❌ Instala openpyxl: pip install openpyxl")
        sys.exit(1)

    wb = openpyxl.load_workbook(ruta_excel)
    ws = wb.active

    db = SessionLocal()
    insertados = 0
    actualizados = 0

    for row in ws.iter_rows(min_row=3, values_only=True):
        codigo, nombre, grupo, agrupador, detalle = row
        if not codigo or not nombre:
            continue

        codigo = str(int(codigo)) if isinstance(codigo, (int, float)) else str(codigo).strip()
        nombre = str(nombre).strip()

        existe = db.query(ProcedimientoModel).filter(
            ProcedimientoModel.codigo == codigo
        ).first()

        if existe:
            existe.nombre = nombre
            existe.grupo = str(grupo).strip() if grupo else None
            existe.agrupador = str(detalle).strip() if detalle else str(agrupador).strip() if agrupador else None
            actualizados += 1
        else:
            db.add(ProcedimientoModel(
                codigo=codigo,
                nombre=nombre,
                grupo=str(grupo).strip() if grupo else None,
                agrupador=str(detalle).strip() if detalle else str(agrupador).strip() if agrupador else None,
            ))
            insertados += 1

    db.commit()
    total = db.query(ProcedimientoModel).count()
    db.close()
    print(f"✅ Importación completada: {insertados} nuevos, {actualizados} actualizados")
    print(f"   Total procedimientos en BD: {total}")


if __name__ == "__main__":
    if len(sys.argv) < 2:
        print("Uso: python importar_procedimientos.py <ruta_al_excel.xlsx>")
        sys.exit(1)
    importar(sys.argv[1])
