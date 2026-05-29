"""
Servicio de geocodificación usando Nominatim (OpenStreetMap).
Convierte direcciones en texto libre a coordenadas + dirección normalizada.

API: https://nominatim.openstreetmap.org/
Gratuito, 1 req/s, requiere User-Agent.

⚠️ Limitación conocida:
  OpenStreetMap NO tiene datos de numeración de edificios en Colombia.
  Nominatim devuelve el centroide de la calle, NO la dirección exacta.
  Esto aplica a TODAS las API gratuitas basadas en OSM (Nominatim, Photon, etc.).
  Google Geocoding SÍ resuelve direcciones exactas, pero es una API paga.
"""

import logging
import time
from typing import Any

import requests

logger = logging.getLogger(__name__)

NOMINATIM_SEARCH_URL = "https://nominatim.openstreetmap.org/search"
USER_AGENT = "OMV-MovAI/1.0 (Observatorio Movilidad Vial Medellín; contacto@omv.gov.co)"

# Bounding box de Medellín: (oeste, sur, este, norte)
# Formato Nominatim viewbox: x1,y1,x2,y2
MEDELLIN_VIEWBOX = "-75.70,6.10,-75.45,6.35"

_last_request_time = 0.0


def geocode_direccion(direccion: str) -> dict[str, Any] | None:
    """
    Convierte una dirección a coordenadas + dirección normalizada.

    Returns:
        {
            "lat": 6.2442,
            "lng": -75.5812,
            "direccion_normalizada": "Avenida 80, Laureles, Medellín...",
            "precision": "house" | "street" | "city"
        }
        o None si no se encuentra.

    NOTA: OpenStreetMap no tiene numeración de edificios en Colombia.
          La precisión máxima es "street" (centroide de la calle).
    """
    if not direccion or not direccion.strip():
        logger.warning("Se recibió dirección vacía")
        return None

    query = direccion.strip()

    # Asegurar contexto Medellín
    if "medell" not in query.lower():
        query = f"{query}, Medellín, Antioquia"
        logger.debug(f"Dirección sin Medellín, normalizada a: '{query}'")

    return _geocode_nominatim(query)


def _geocode_nominatim(query: str) -> dict[str, Any] | None:
    """
    Geocodificación vía Nominatim (OSM).
    Rate-limited a 1 req/s.
    """
    global _last_request_time
    _respetar_rate_limit()

    params: dict[str, Any] = {
        "q": query,
        "format": "json",
        "limit": 3,
        "addressdetails": 1,
        "countrycodes": "co",
        "viewbox": MEDELLIN_VIEWBOX,
        "bounded": 1,
    }
    headers = {"User-Agent": USER_AGENT}

    try:
        resp = requests.get(NOMINATIM_SEARCH_URL, params=params, headers=headers, timeout=10)
        resp.raise_for_status()
        results = resp.json()
    except requests.RequestException as e:
        logger.error(f"Error de red Nominatim para '{query}': {e}")
        return None
    except ValueError as e:
        logger.error(f"Respuesta inválida Nominatim para '{query}': {e}")
        return None

    if not results or not isinstance(results, list):
        logger.warning(f"Nominatim sin resultados para: '{query}'")
        return None

    # Elegir el mejor resultado entre los 3
    mejor = _seleccionar_mejor_resultado(results)

    try:
        lat = float(mejor.get("lat", 0))
        lng = float(mejor.get("lon", 0))
    except (ValueError, TypeError) as e:
        logger.error(f"Error parseando respuesta Nominatim: {e}")
        return None

    addresstype = mejor.get("addresstype", "road")
    display_name = mejor.get("display_name", query)

    logger.info(f"Geocodificado '{query}' → ({lat}, {lng}) [{addresstype}]")

    return {
        "lat": lat,
        "lng": lng,
        "direccion_normalizada": display_name,
        "precision": addresstype,
    }


def _seleccionar_mejor_resultado(results: list[dict]) -> dict:
    """
    Elige el mejor resultado de Nominatim.

    Prioridad:
      1. addresstype=house (tiene número)
      2. addresstype=amenity (tiene nombre/número)
      3. addresstype=road (calle)
      4. cualquier otro
    """
    prioridad = {"house": 0, "amenity": 1, "highway": 2, "road": 3}

    def _clave(p):
        return prioridad.get(p.get("addresstype", ""), 99)

    return min(results, key=_clave)


def _respetar_rate_limit() -> None:
    """Espera lo necesario para no superar 1 req/s a Nominatim."""
    global _last_request_time
    elapsed = time.time() - _last_request_time
    if elapsed < 1.0:
        time.sleep(1.0 - elapsed)
    _last_request_time = time.time()
