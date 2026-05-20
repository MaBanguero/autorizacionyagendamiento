from sqlalchemy.orm import Session
from datetime import datetime, timedelta
import uuid
import random

from core.database import SessionLocal
from infrastructure.database.models import (
    SedeModel,
    PacienteModel,
    OrdenMedicaModel,
    UserModel,
    RoleModel,
    MunicipioModel,
    sede_municipios,
)
from infrastructure.auth_service import hash_password

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

MUNICIPIOS = ["Puerto Tejada", "Padilla", "Villa Rica"]


ROLES_PRECARGADOS = [
    {"nombre": "ordenar_citas",  "descripcion": "Permite crear nuevas órdenes médicas"},
    {"nombre": "agendar_citas",  "descripcion": "Permite agendar citas en el calendario"},
    {"nombre": "super_usuario",  "descripcion": "Acceso total a la plataforma y gestión de usuarios"},
]


def crear_roles(db: Session):
    print("Creando roles...")
    if db.query(RoleModel).count() > 0:
        print("Roles ya existen, omitido.")
        return

    for r in ROLES_PRECARGADOS:
        db.add(RoleModel(nombre=r["nombre"], descripcion=r["descripcion"]))
    db.commit()
    print(f"✅ {len(ROLES_PRECARGADOS)} roles creados")


def crear_usuarios(db: Session):
    print("Creando usuarios...")
    if db.query(UserModel).count() > 0:
        print("Usuarios ya existen, omitido.")
        return

    roles_disponibles = {r.nombre: r for r in db.query(RoleModel).all()}

    usuarios = [
        UserModel(
            username="admin",
            nombre="Administrador",
            hashed_password=hash_password("admin123"),
            roles=[roles_disponibles["super_usuario"], roles_disponibles["ordenar_citas"], roles_disponibles["agendar_citas"]],
        ),
        UserModel(
            username="medico",
            nombre="Dr. Juan Pérez",
            hashed_password=hash_password("medico123"),
            roles=[roles_disponibles["ordenar_citas"]],
        ),
    ]

    db.add_all(usuarios)
    db.commit()
    print(f"✅ {len(usuarios)} usuarios creados")


def crear_municipios(db: Session):
    print("Creando municipios...")
    if db.query(MunicipioModel).count() > 0:
        print("Municipios ya existen, omitido.")
        return db.query(MunicipioModel).all()

    municipios = [MunicipioModel(nombre=m) for m in MUNICIPIOS]
    db.add_all(municipios)
    db.commit()
    for m in municipios:
        db.refresh(m)
    print(f"✅ {len(municipios)} municipios creados")
    return municipios


def crear_sedes(db: Session, municipios):
    print("Creando sedes...")

    muni_map = {m.nombre: m for m in municipios}

    sedes_data = [
        {
            "nombre": "Sede Centro",
            "apertura": "07:00", "cierre": "17:00",
            "cap": 120,
            "municipios": MUNICIPIOS,  # atiende los 3
        },
    ]

    sedes = []
    for sd in sedes_data:
        sede = SedeModel(
            nombre=sd["nombre"],
            hora_apertura=datetime.strptime(sd["apertura"], "%H:%M").time(),
            hora_cierre=datetime.strptime(sd["cierre"], "%H:%M").time(),
            capacidad_diaria=sd["cap"],
        )
        db.add(sede)
        db.flush()

        for muni_nombre in sd["municipios"]:
            muni = muni_map[muni_nombre]
            db.execute(
                sede_municipios.insert().values(sede_id=sede.id, municipio_id=muni.id)
            )

        sedes.append(sede)

    db.commit()
    print(f"✅ {len(sedes)} sedes creadas con sus municipios")
    return sedes


def crear_pacientes(db: Session, municipios, cantidad=10):
    print("Creando pacientes...")

    pacientes = []

    for i in range(cantidad):
        muni = random.choice(municipios)
        paciente = PacienteModel(
            tipo_documento="CC",
            numero_documento=str(100000 + i),
            nombre=random.choice(NOMBRES),
            sexo=random.choice(["M", "F"]),
            direccion="Calle 123",
            telefono="3001234567",
            fecha_nacimiento=datetime(1990, 1, 1),
            convenio="EPS Salud",
            regimen="Contributivo",
            municipio_id=muni.id,
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
        crear_roles(db)
        crear_usuarios(db)
        municipios = crear_municipios(db)

        if db.query(SedeModel).count() > 0:
            print("Ya existen datos de sedes/pacientes/ordenes. Seed omitido.")
            return

        sedes = crear_sedes(db, municipios)
        pacientes = crear_pacientes(db, municipios)
        crear_ordenes(db, pacientes, sedes)

        print("✅ Datos de prueba creados correctamente")

    except Exception as e:
        print("❌ Error:", e)
        import traceback
        traceback.print_exc()

    finally:
        db.close()


if __name__ == "__main__":
    run()
