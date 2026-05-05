import pytest
from datetime import datetime, date, time
from dateutil.relativedelta import relativedelta
from unittest.mock import MagicMock

from application.scheduling_use_case import AgendamientoService
from domain.models import OrdenMedica, Sede, Paciente, SexoEnum


# --- FIXTURES (Datos de Prueba) ---
@pytest.fixture
def paciente_mock():
    return Paciente(
        nombre="Juan Perez", tipo_documento="CC", sexo=SexoEnum.M,
        direccion="Calle 1", telefono="123", fecha_nacimiento=date(1990, 1, 1),
        convenio="SURA", regimen="Contributivo"
    )


@pytest.fixture
def orden_mock(paciente_mock):
    return OrdenMedica(
        id="orden-123", numero_orden="EXT-001", paciente=paciente_mock,
        estudio="Cuadro Hemático", estado="AUTORIZADA"
    )


@pytest.fixture
def sede_mock():
    return Sede(
        id="sede-norte", nombre="Sede Norte",
        hora_apertura=time(7, 0), hora_cierre=time(17, 0), capacidad_diaria=150
    )


@pytest.fixture
def service_mocked(sede_mock, orden_mock):
    # Creamos Mocks de las interfaces (Repositorios falsos)
    orden_repo = MagicMock()
    sede_repo = MagicMock()

    # Configuramos el comportamiento por defecto de los Mocks
    orden_repo.obtener_por_id.return_value = orden_mock
    sede_repo.obtener_sede.return_value = sede_mock
    orden_repo.contar_citas_sede_dia.return_value = 0
    orden_repo.existe_cita_en_slot.return_value = False

    service = AgendamientoService(orden_repo, sede_repo)
    return service, orden_repo, sede_repo


# --- TESTS DE REGLAS DE NEGOCIO ---

def test_agendamiento_exitoso(service_mocked):
    service, orden_repo, _ = service_mocked
    # Agendamos para mañana a las 08:03 (Múltiplo de 3, dentro de horario)
    fecha_valida = datetime.combine(date.today() + relativedelta(days=1), time(8, 3))

    orden_result = service.agendar_cita("orden-123", "sede-norte", fecha_valida)

    assert orden_result.sede_id == "sede-norte"
    assert orden_result.fecha_cita == fecha_valida
    # Verificamos que el servicio intentó guardar en BD
    orden_repo.guardar.assert_called_once()


def test_falla_regla_intervalo_3_minutos(service_mocked):
    service, _, _ = service_mocked
    # Hora inválida: 08:02 (no es múltiplo de 3)
    fecha_invalida = datetime.combine(date.today() + relativedelta(days=1), time(8, 2))

    with pytest.raises(ValueError, match="intervalos de 3 minutos"):
        service.agendar_cita("orden-123", "sede-norte", fecha_invalida)


def test_falla_fuera_de_horario_sede(service_mocked):
    service, _, _ = service_mocked
    # Hora inválida: 06:00 (La sede abre a las 07:00)
    fecha_fuera_horario = datetime.combine(date.today() + relativedelta(days=1), time(6, 0))

    with pytest.raises(ValueError, match="fuera del horario de la sede"):
        service.agendar_cita("orden-123", "sede-norte", fecha_fuera_horario)


def test_falla_capacidad_maxima_alcanzada(service_mocked):
    service, orden_repo, _ = service_mocked
    # Simulamos que la BD dice que ya hay 150 citas
    orden_repo.contar_citas_sede_dia.return_value = 150
    fecha_valida = datetime.combine(date.today() + relativedelta(days=1), time(8, 0))

    with pytest.raises(ValueError, match="capacidad máxima"):
        service.agendar_cita("orden-123", "sede-norte", fecha_valida)


def test_falla_doble_agendamiento_mismo_slot(service_mocked):
    service, orden_repo, _ = service_mocked
    # Simulamos que el slot ya está ocupado
    orden_repo.existe_cita_en_slot.return_value = True
    fecha_valida = datetime.combine(date.today() + relativedelta(days=1), time(8, 0))

    with pytest.raises(ValueError, match="ya está reservado"):
        service.agendar_cita("orden-123", "sede-norte", fecha_valida)