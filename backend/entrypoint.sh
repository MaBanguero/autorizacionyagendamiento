#!/bin/sh

echo "Esperando PostgreSQL..."

until python -c "
import psycopg2, os
url = os.environ.get('DATABASE_URL')
psycopg2.connect(url)
" 2>/dev/null; do
  echo "PostgreSQL no está listo..."
  sleep 2
done

echo "PostgreSQL listo."

echo "Creando tablas..."
python crear_tablas.py

echo "Cargando datos de prueba..."
python seed_data.py

echo "Iniciando backend..."
exec python -m uvicorn presentation.api:app --host 0.0.0.0 --port 8000