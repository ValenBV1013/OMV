"""
Servicio de integración con OpenWeatherMap API.
Obtiene datos climáticos en tiempo real para Medellín.
"""

import logging
from datetime import datetime, timedelta, timezone

import requests
from django.conf import settings
from django.utils import timezone as tz

from ..models import AlertaClima

logger = logging.getLogger(__name__)

# Coordenadas de Medellín (centro)
MEDELLIN_LAT = 6.2442
MEDELLIN_LNG = -75.5812

OWM_BASE_URL = "https://api.openweathermap.org/data/2.5"
OWM_ONE_CALL_URL = "https://api.openweathermap.org/data/3.0/onecall"

# Estados que consideramos "alerta"
ESTADOS_ALERTA = [
    "thunderstorm",
    "heavy intensity rain",
    "very heavy rain",
    "extreme rain",
    "freezing rain",
    "heavy shower snow",
]

MapeoEstado = {
    "clear sky": "normal",
    "few clouds": "normal",
    "scattered clouds": "normal",
    "broken clouds": "lluvia_ligera",
    "overcast clouds": "normal",
    "light rain": "lluvia_ligera",
    "moderate rain": "lluvia_moderada",
    "heavy intensity rain": "lluvia_fuerte",
    "very heavy rain": "lluvia_fuerte",
    "extreme rain": "tormenta",
    "freezing rain": "tormenta",
    "light intensity shower rain": "lluvia_ligera",
    "shower rain": "lluvia_moderada",
    "heavy intensity shower rain": "lluvia_fuerte",
    "ragged shower rain": "lluvia_moderada",
    "thunderstorm": "tormenta",
    "thunderstorm with light rain": "tormenta",
    "thunderstorm with rain": "tormenta",
    "thunderstorm with heavy rain": "tormenta",
    "light snow": "lluvia_ligera",
    "snow": "lluvia_moderada",
    "mist": "niebla",
    "fog": "niebla",
    "haze": "niebla",
}


def _mapear_estado(description):
    """Traduce el string de OpenWeatherMap a nuestro estado normalizado."""
    desc_lower = description.lower().strip()
    return MapeoEstado.get(desc_lower, "normal")


def _es_estado_alerta(description, precip_mmh):
    """Determina si el clima actual merece una alerta."""
    if precip_mmh >= 30:
        return True
    if description.lower() in ESTADOS_ALERTA:
        return True
    return False


def fetch_current_weather(lat=None, lng=None):
    """
    Consulta el clima actual en OpenWeatherMap y devuelve datos normalizados.
    Usa el endpoint /weather (gratuito).
    """
    lat = lat or MEDELLIN_LAT
    lng = lng or MEDELLIN_LNG

    api_key = getattr(settings, "OWM_API_KEY", "")
    if not api_key:
        logger.warning("OWM_API_KEY no configurada en settings")
        return None

    url = f"{OWM_BASE_URL}/weather"
    params = {
        "lat": lat,
        "lon": lng,
        "appid": api_key,
        "units": "metric",
        "lang": "es",
    }

    try:
        resp = requests.get(url, params=params, timeout=10)
        resp.raise_for_status()
        data = resp.json()
    except requests.RequestException as e:
        logger.error(f"Error al consultar OpenWeatherMap: {e}")
        return None

    # Extraer datos normalizados
    description = data.get("weather", [{}])[0].get("description", "")
    precip_mmh = 0.0
    if "rain" in data and data["rain"]:
        precip_mmh = data["rain"].get("1h", 0) or data["rain"].get("3h", 0) or 0
    elif "snow" in data and data["snow"]:
        precip_mmh = data["snow"].get("1h", 0) or data["snow"].get("3h", 0) or 0

    resultado = {
        "temp": data.get("main", {}).get("temp"),
        "humidity": data.get("main", {}).get("humidity"),
        "pressure": data.get("main", {}).get("pressure"),
        "description": description,
        "estado_normalizado": _mapear_estado(description),
        "precipitacion_mmh": precip_mmh,
        "wind_speed": data.get("wind", {}).get("speed"),
        "icon": data.get("weather", [{}])[0].get("icon", ""),
        "timestamp": datetime.now(timezone.utc).isoformat(),
        "raw": data,
    }

    # Generar alerta si la precipitación es alta
    if _es_estado_alerta(description, precip_mmh):
        _crear_alerta(precip_mmh, resultado["estado_normalizado"], data)

    return resultado


def _crear_alerta(precipitacion, estado, raw_data):
    """
    Crea un registro de AlertaClima cuando las condiciones lo ameritan.
    """
    # Coordenadas aproximadas del área afectada (Medellín)
    coords = {
        "type": "FeatureCollection",
        "features": [{
            "type": "Feature",
            "geometry": {
                "type": "Point",
                "coordinates": [MEDELLIN_LNG, MEDELLIN_LAT],
            },
            "properties": {
                "descripcion": f"Alerta por {estado} — {precipitacion}mm/h",
            },
        }],
    }

    AlertaClima.objects.create(
        nivel_precipitacion=precipitacion,
        estado_clima=estado,
        coordenadas_afectadas=coords,
        fuente_api="openweathermap",
        activa=True,
        expires_at=datetime.now(timezone.utc) + timedelta(hours=3),
    )


def desactivar_alertas_expiradas():
    """Marca como inactivas las alertas vencidas."""
    ahora = datetime.now(timezone.utc)
    updated = AlertaClima.objects.filter(
        activa=True,
        expires_at__lt=ahora,
    ).update(activa=False)
    if updated:
        logger.info(f"Se desactivaron {updated} alertas expiradas")
    return updated


def poll_current_weather():
    """
    Tarea periódica: obtiene el clima actual y desactiva alertas vencidas.
    """
    desactivar_alertas_expiradas()
    resultado = fetch_current_weather()
    if resultado:
        logger.info(
            f"Clima actual: {resultado['estado_normalizado']}, "
            f"{resultado['precipitacion_mmh']}mm/h"
        )
    return resultado
