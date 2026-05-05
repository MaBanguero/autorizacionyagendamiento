import pytest
from fastapi.testclient import TestClient
from unittest.mock import MagicMock
from datetime import datetime, date, time
from dateutil.relativedelta import relativedelta

# Importamos la app de FastAPI y las dependencias a sobreescribir
from main import app
from core.dependencies import get_agendamiento_service

client = TestClient(app)


@pytest.fixture
def mock_agendamiento_service():
    # Creamos un servicio falso
    mock_service = MagicMock()
    return mock_service


def test_endpoint_agendar_exito(mock_agendamiento_service):
    # Sobreescribimos la dependencia en FastAPI
    app.dependency_overrides[get_agendamiento_service] = lambda: mock_agendamiento_service

    # Simulamos que el servicio devuelve un objeto con fecha_cita configurada
    mock_orden = MagicMock()
    mock_orden.fecha_cita = datetime.now()
    mock_agendamiento_service.agendar_cita.return_value = mock_orden

    # Fecha para el body del request
    fecha_str = (datetime.now() + relativedelta(days=1)).isoformat()

    response = client.post(
        "/api/ordenes/orden-123/agendar",
        json={"sede_id": "sede-norte", "fecha_hora": fecha_str}
    )

    assert response.status_code == 200
    assert response.json()["mensaje"] == "Cita agendada con éxito"

    # Limpiamos el override
    app.dependency_overrides.clear()


def test_endpoint_agendar_error_validacion(mock_agendamiento_service):
    app.dependency_overrides[get_agendamiento_service] = lambda: mock_agendamiento_service

    # Simulamos que el servicio lanza un ValueError (ej. horario ocupado)
    mock_agendamiento_service.agendar_cita.side_effect = ValueError("La sede ha alcanzado su capacidad máxima")

    fecha_str = (datetime.now() + relativedelta(days=1)).isoformat()

    response = client.post(
        "/api/ordenes/orden-123/agendar",
        json={"sede_id": "sede-norte", "fecha_hora": fecha_str}
    )

    # FastAPI debe traducir el ValueError en un 422 Unprocessable Entity
    assert response.status_code == 422
    assert response.json()["detail"] == "La sede ha alcanzado su capacidad máxima"

    app.dependency_overrides.clear()