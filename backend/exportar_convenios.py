"""
Exporta los convenios de la BD a un archivo CSV para importar/editar externamente.
"""
import csv
from core.database import SessionLocal


def exportar_convenios(output_path: str = "convenios_export.csv"):
    db = SessionLocal()
    try:
        from sqlalchemy import text
        rows = db.execute(text(
            "SELECT nombre, regimen, activo FROM convenios ORDER BY nombre"
        )).fetchall()

        with open(output_path, "w", newline="", encoding="utf-8") as f:
            writer = csv.writer(f)
            writer.writerow(["nombre", "regimen", "activo"])
            for row in rows:
                writer.writerow([row[0], row[1] or "", "SI" if row[2] else "NO"])

        print(f"✅ Exportados {len(rows)} convenios a {output_path}")
    finally:
        db.close()


if __name__ == "__main__":
    exportar_convenios()
