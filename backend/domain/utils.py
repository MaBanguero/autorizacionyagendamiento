"""
Utilidades de dominio: normalización de nombres y detección de duplicados.
"""

import re
import unicodedata
from difflib import SequenceMatcher


def normalizar_texto(texto: str) -> str:
    """
    Normaliza un texto eliminando acentos, mayúsculas, puntuación y espacios extra.
    """
    if not texto:
        return ""

    # 1. Uppercase
    t = texto.upper().strip()

    # 2. Eliminar acentos (é → E, ñ → N, etc.)
    t = unicodedata.normalize("NFKD", t)
    t = t.encode("ASCII", "ignore").decode("ASCII")

    # 3. Reemplazar caracteres especiales comunes
    reemplazos = {
        "Ñ": "N",
        "Ü": "U",
    }
    for k, v in reemplazos.items():
        t = t.replace(k, v)

    # 4. Eliminar puntuación (a excepción de espacios)
    t = re.sub(r"[^A-Z0-9\s]", "", t)

    # 5. Eliminar palabras vacías comunes en nombres colombianos
    # (opcional, podrían ser relevantes para diferenciar)
    # stopwords = {"DEL", "DE", "LA", "LOS", "LAS", "Y", "E", "EL", "SAN", "SANTA"}
    # t = " ".join(p for p in t.split() if p not in stopwords)

    # 6. Colapsar múltiples espacios
    t = re.sub(r"\s+", " ", t).strip()

    return t


def normalizar_nombre(nombre: str) -> str:
    """
    Normaliza un nombre completo para búsqueda y comparación.
    Ejemplo: "CRISTÍN  DAHIAN  FORY  LENÍS" → "CRISTIN DAHIAN FORY LENIS"
    """
    return normalizar_texto(nombre)


def similitud_nombre(nombre1: str, nombre2: str) -> float:
    """
    Calcula la similitud entre dos nombres normalizados (0.0 - 1.0).
    Usa SequenceMatcher para comparación flexible.
    """
    n1 = normalizar_nombre(nombre1)
    n2 = normalizar_nombre(nombre2)
    if not n1 or not n2:
        return 0.0
    return SequenceMatcher(None, n1, n2).ratio()


def son_nombres_similares(nombre1: str, nombre2: str, umbral: float = 0.82) -> bool:
    """
    Determina si dos nombres son suficientemente similares como para
    considerarse posibles duplicados.

    Args:
        nombre1: Primer nombre completo
        nombre2: Segundo nombre completo
        umbral: Punto de corte para considerar similitud (0.0 - 1.0)

    Returns:
        True si los nombres son potencialmente duplicados
    """
    return similitud_nombre(nombre1, nombre2) >= umbral


def token_similitud(nombre1: str, nombre2: str) -> float:
    """
    Compara por tokens (palabras) en lugar de string completo.
    Útil cuando hay inversión de nombres o segundo nombre faltante.
    """
    n1 = set(normalizar_nombre(nombre1).split())
    n2 = set(normalizar_nombre(nombre2).split())

    if not n1 or not n2:
        return 0.0

    interseccion = n1 & n2
    union = n1 | n2

    return len(interseccion) / len(union)
