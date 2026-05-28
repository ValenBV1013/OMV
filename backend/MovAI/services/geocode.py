"""
Servicio de geocodificación usando Nominatim (OpenStreetMap).
Convierte direcciones en texto libre a coordenadas {lat, lng}.

API: https://nominatim.openstreetmap.org/
Gratuito, 1 req/s, requiere User-Agent.

Las coordenadas obtenidas son WGS84 (EPSG:4326) → compatibles con
Google Maps, OSRM, y cualquier mapa moderno.
"""

import logging
import time
from typing import Any

import requests

logger = logging.getLogger(__name__)

NOMINATIM_SEARCH_URL = "https://nominatim.openstreetmap.org/search"
USER_AGENT = "OMV-MovAI/1.0 (Observatorio Movilidad Vial Medellín; contacto@omv.gov.co)"

# Bounding box de Medellín para restringir resultados
# Formato viewbox Nominatim: x1,y1,x2,y2 (long1,lat1,long2,lat2)
MEDELLIN_VIEWBOX = "-75.65,6.13,-75.50,6.33"

_last_request_time = 0.0


def geocode_direccion(direccion: str) -> dict[str, float] | None:
    """
    Convierte una dirección a coordenadas {lat, lng}.

    Args:
        direccion: Dirección en texto libre (ej: "Cra 80 # 30-15, Medellín" o "Cl 10 # 41-20").

    Returns:
        {"lat": 6.2442, "lng": -75.5812} o None si no se encuentra.

    Restricción geográfica:
        Solo busca dentro del área metropolitana de Medellín vía viewbox + bounded=1.
        Si la dirección no incluye "Medellín" se lo agrega automáticamente
        para mejorar la precisión.

    Note:
        Rate-limited a 1 req/s como exige la política de Nominatim.
        Para uso en producción, considera un caché de resultados
        o un proxy de geocodificación.
    """
    global _last_request_time

    if not direccion or not direccion.strip():
        logger.warning("Se recibió dirección vacía")
        return None

    query = direccion.strip()

    # Asegurar contexto Medellín para mejor precisión
    if "medell" not in query.lower():
        query = f"{query}, Medellín, Antioquia"
        logger.debug(f"Dirección sin Medellín, normalizada a: '{query}'")

    # Rate limiting: política de Nominatim — 1 request/segundo
    _respetar_rate_limit()

    params: dict[str, Any] = {
        "q": query,
        "format": "json",
        "limit": 1,
        "addressdetails": 0,
        "countrycodes": "co",
        "viewbox": MEDELLIN_VIEWBOX,
        "bounded": 1,  # Solo resultados DENTRO del viewbox
    }
    headers = {"User-Agent": USER_AGENT}

    try:
        resp = requests.get(
            NOMINATIM_SEARCH_URL,
            params=params,
            headers=headers,
            timeout=10,
        )
        resp.raise_for_status()
        results = resp.json()
    except requests.RequestException as e:
        logger.error(f"Error de red al geocodificar '{query}': {e}")
        return None
    except ValueError as e:
        logger.error(f"Respuesta inválida de Nominatim para '{query}': {e}")
        return None

    if not results or not isinstance(results, list):
        logger.warning(f"Nominatim no encontró resultados para: '{query}'")
        return None

    try:
        lat = float(results[0].get("lat", 0))
        lng = float(results[0].get("lon", 0))
    except (ValueError, TypeError, IndexError) as e:
        logger.error(f"Error parseando respuesta Nominatim: {e}")
        return None

    logger.info(f"Geocodificado: '{query}' → ({lat}, {lng})")
    return {"lat": lat, "lng": lng}


def _respetar_rate_limit() -> None:
    """Espera lo necesario para no superar 1 req/s a Nominatim."""
    global _last_request_time
    elapsed = time.time() - _last_request_time
    if elapsed < 1.0:
        time.sleep(1.0 - elapsed)
    _last_request_time = time.time()
