from sqlalchemy.orm import Session
from datetime import datetime, timedelta
import uuid
import random

from core.database import SessionLocal
from infrastructure.database.models import (
    SedeModel,
    PacienteModel,
    OrdenMedicaModel
)

NOMBRES = [
    "Juan Perez", "Maria Lopez", "Carlos Ramirez",
    "Ana Torres", "Luis Martinez", "Sofia Castro"
]

ESTUDIOS = [
    "Radiografía de tórax",
    "Resonancia magnética",
    "Tomografía",
    "Ecografía abdominal",
    "Electrocardiograma"
]


def crear_sedes(db: Session):
    print("Creando sedes...")

    sedes = [
        SedeModel(
            nombre="Sede Norte",
            hora_apertura=datetime.strptime("08:00", "%H:%M").time(),
            hora_cierre=datetime.strptime("18:00", "%H:%M").time(),
            capacidad_diaria=150
        ),
        SedeModel(
            nombre="Sede Centro",
            hora_apertura=datetime.strptime("07:00", "%H:%M").time(),
            hora_cierre=datetime.strptime("17:00", "%H:%M").time(),
            capacidad_diaria=120
        )
    ]

    db.add_all(sedes)
    db.commit()

    return sedes


def crear_pacientes(db: Session, cantidad=10):
    print("Creando pacientes...")

    pacientes = []

    for i in range(cantidad):
        paciente = PacienteModel(
            tipo_documento="CC",
            numero_documento=str(100000 + i),
            nombre=random.choice(NOMBRES),
            sexo=random.choice(["M", "F"]),
            direccion="Calle 123",
            telefono="3001234567",
            fecha_nacimiento=datetime(1990, 1, 1),
            convenio="EPS Salud",
            regimen="Contributivo"
        )

        pacientes.append(paciente)

    db.add_all(pacientes)
    db.commit()

    return pacientes


def crear_ordenes(db: Session, pacientes, sedes):
    print("Creando órdenes...")

    for i in range(20):
        paciente = random.choice(pacientes)
        estado = random.choice(["PENDIENTE", "AUTORIZADA"])

        orden = OrdenMedicaModel(
            numero_orden=f"ORD-{1000+i}",
            paciente_id=paciente.id,
            estudio=random.choice(ESTUDIOS),
            estado=estado
        )

        if estado == "AUTORIZADA":
            orden.autorizado_por="admin"
            orden.fecha_autorizacion=datetime.now()

            # algunas con cita
            if random.choice([True, False]):
                sede = random.choice(sedes)
                fecha = datetime.now() + timedelta(days=random.randint(1, 10))
                fecha = fecha.replace(minute=(fecha.minute // 3) * 3)

                orden.sede_id = sede.id
                orden.fecha_cita = fecha

                # algunas con PDF
                if random.choice([True, False]):
                    orden.documento_generado = True
                    orden.fecha_generacion_pdf = datetime.now()
                    orden.ruta_pdf = f"pdfs_autorizaciones/demo_{uuid.uuid4()}.pdf"

        db.add(orden)

    db.commit()


def run():
    db = SessionLocal()

    try:
        if db.query(SedeModel).count() > 0:
            print("Ya existen datos. Seed omitido.")
            return
        
        sedes = crear_sedes(db)
        pacientes = crear_pacientes(db)
        crear_ordenes(db, pacientes, sedes)

        print("✅ Datos de prueba creados correctamente")

    except Exception as e:
        print("❌ Error:", e)

    finally:
        db.close()


if __name__ == "__main__":
    run()