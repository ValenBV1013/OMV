"""
Motor de tráfico IRL (In Real Life) integrado con TomTom API.
Provee datos de flujo vehicular, rutas con tráfico real, incidentes y
zonas de congestión para el Observatorio de Movilidad Vial de Medellín.
"""

import logging
import os
from datetime import datetime
from typing import Any

import requests
from asgiref.sync import async_to_sync
from channels.layers import get_channel_layer
from django.utils import timezone

from ..models import SegmentoVial, FlujoVehicular

logger = logging.getLogger(__name__)

TOMTOM_API_KEY = os.environ.get("TOMTOM_API_KEY", "26tNu3I4uiYHUF4FYEoWPBl7buTtPVtG")

# Puntos de muestra fijos en Medellín para el monitoreo periódico
SAMPLE_POINTS = [
    {"lat": 6.244203, "lng": -75.581211},  # Centro / Parque Berrio
    {"lat": 6.243120, "lng": -75.571450},  # La 33
    {"lat": 6.248900, "lng": -75.569100},  # Industriales
    {"lat": 6.200500, "lng": -75.586200},  # Laureles
    {"lat": 6.186500, "lng": -75.596000},  # Estadio
    {"lat": 6.252000, "lng": -75.564000},  # Terminal del Norte
    {"lat": 6.198000, "lng": -75.568800},  # El Poblado
    {"lat": 6.287000, "lng": -75.563000},  # Bello
    {"lat": 6.158000, "lng": -75.610000},  # San Antonio de Prado
    {"lat": 6.232000, "lng": -75.588000},  # Laureles-Estadio
]


# ───────────────────────────────────────────────────────────────
# TomTom Routing API
# ───────────────────────────────────────────────────────────────

def get_tomtom_route(
    origen_lat: float,
    origen_lng: float,
    destino_lat: float,
    destino_lng: float,
    alternatives_count: int = 0,
) -> dict[str, Any]:
    """
    Calcula una ruta (y alternativas) usando TomTom Routing API.

    URL:
      GET routing/1/calculateRoute/{origen_lat},{origen_lng}:{destino_lat},{destino_lng}/json

    NOTA: El plan gratuito (Developer) de TomTom NO soporta rutas alternativas
    (alternatives debe ser 0). Si tenés un plan de pago, cambiá alternatives_count.

    Devuelve la respuesta JSON completa de TomTom o un dict con error detallado.
    """
    url = (
        f"https://api.tomtom.com/routing/1/calculateRoute/"
        f"{origen_lat},{origen_lng}:{destino_lat},{destino_lng}/json"
    )
    params: dict[str, Any] = {
        "key": TOMTOM_API_KEY,
        "routeType": "fastest",
        "traffic": "true",
    }

    # Solo agregar alternatives si es > 0 (el plan gratuito no lo soporta)
    if alternatives_count > 0:
        params["alternatives"] = alternatives_count

    logger.info(
        "TomTom Routing: %s → %s params=%s",
        f"{origen_lat},{origen_lng}",
        f"{destino_lat},{destino_lng}",
        {k: v for k, v in params.items() if k != "key"},
    )

    try:
        response = requests.get(url, params=params, timeout=10)
        response.raise_for_status()
        return response.json()
    except requests.Timeout:
        logger.error(
            "TomTom Routing API timeout para ruta "
            f"({origen_lat},{origen_lng}) → ({destino_lat},{destino_lng})"
        )
        return {
            "error": "Timeout al consultar TomTom Routing API",
            "routes": [],
        }
    except requests.HTTPError as exc:
        # Capturar el body de error que devuelve TomTom (contiene el detalle real)
        status_code = exc.response.status_code if exc.response else "?"
        body = ""
        try:
            body = exc.response.text[:500] if exc.response else ""
        except Exception:
            body = "(no se pudo leer body)"
        logger.error(
            "TomTom Routing API HTTP %s para ruta "
            f"({origen_lat},{origen_lng}) → ({destino_lat},{destino_lng}): %s",
            status_code,
            body,
        )
        return {
            "error": f"TomTom Routing API HTTP {status_code}: {body}",
            "routes": [],
        }
    except requests.RequestException as exc:
        logger.exception(
            "Error de conexión en TomTom Routing API: %s", exc
        )
        return {
            "error": f"Error de conexión con TomTom: {exc}",
            "routes": [],
        }


# ───────────────────────────────────────────────────────────────
# TomTom Traffic Flow API
# ───────────────────────────────────────────────────────────────

def get_traffic_flow_segment(lat: float, lng: float) -> dict[str, Any]:
    """
    Consulta el flujo vehicular en un punto usando TomTom Flow Segment API.

    URL:
      GET traffic/services/4/flowSegmentData/absolute/10/json

    Devuelve un dict con: currentSpeed, freeFlowSpeed, currentTravelTime,
    freeFlowTravelTime, confidence, roadClosure.
    """
    url = "https://api.tomtom.com/traffic/services/4/flowSegmentData/absolute/10/json"
    params = {
        "key": TOMTOM_API_KEY,
        "point": f"{lat},{lng}",
        "unit": "KMPH",
    }

    try:
        response = requests.get(url, params=params, timeout=10)
        response.raise_for_status()
        data = response.json()
        flow = data.get("flowSegmentData", {})
        result = {
            "currentSpeed": flow.get("currentSpeed"),
            "freeFlowSpeed": flow.get("freeFlowSpeed"),
            "currentTravelTime": flow.get("currentTravelTime"),
            "freeFlowTravelTime": flow.get("freeFlowTravelTime"),
            "confidence": flow.get("confidence"),
            "roadClosure": flow.get("roadClosure", False),
        }
        logger.debug("TomTom Flow en (%.4f, %.4f): %s km/h (libre: %s km/h)", lat, lng, result["currentSpeed"], result["freeFlowSpeed"])
        return result
    except requests.Timeout:
        logger.error("TomTom Flow API timeout para punto (%.4f, %.4f)", lat, lng)
        return {"error": "Timeout al consultar TomTom Flow API", "currentSpeed": None}
    except requests.HTTPError as exc:
        status_code = exc.response.status_code if exc.response else "?"
        body = ""
        try:
            body = exc.response.text[:500] if exc.response else ""
        except Exception:
            body = "(no se pudo leer body)"
        logger.error("TomTom Flow HTTP %s en (%.4f, %.4f): %s", status_code, lat, lng, body)
        return {"error": f"TomTom Flow HTTP {status_code}: {body}", "currentSpeed": None}
    except requests.RequestException as exc:
        logger.exception("Error de conexión en TomTom Flow API (%.4f, %.4f): %s", lat, lng, exc)
        return {"error": f"Error de conexión con TomTom Flow: {exc}", "currentSpeed": None}


# ───────────────────────────────────────────────────────────────
# TomTom Traffic Incidents API
# ───────────────────────────────────────────────────────────────

def get_traffic_incidents(
    south: float = 6.13,
    west: float = -75.70,
    north: float = 6.35,
    east: float = -75.50,
) -> list[dict[str, Any]]:
    """
    Obtiene incidentes de tráfico en un bounding box usando TomTom Incidents API.

    URL:
      GET traffic/services/4/incidentDetails/s3/{south},{west},{north},{east}/10/json

    Devuelve una lista de incidentes o lista vacía en caso de error.
    """
    url = (
        f"https://api.tomtom.com/traffic/services/4/"
        f"incidentDetails/s3/{south},{west},{north},{east}/10/json"
    )
    params = {
        "key": TOMTOM_API_KEY,
        "language": "es-CO",
    }

    logger.info("TomTom Incidents: bbox=%.2f,%.2f,%.2f,%.2f", south, west, north, east)

    try:
        response = requests.get(url, params=params, timeout=10)
        response.raise_for_status()
        data = response.json()
        incidents = data.get("incidents", [])
        logger.info("TomTom Incidents: %d encontrados", len(incidents))
        return incidents
    except requests.Timeout:
        logger.error("TomTom Incidents API timeout para bbox %s", f"{south},{west},{north},{east}")
        return []
    except requests.HTTPError as exc:
        status_code = exc.response.status_code if exc.response else "?"
        body = ""
        try:
            body = exc.response.text[:500] if exc.response else ""
        except Exception:
            body = "(no se pudo leer body)"
        logger.error("TomTom Incidents HTTP %s: %s", status_code, body)
        return []
    except requests.RequestException as exc:
        logger.exception("Error de conexión en TomTom Incidents API: %s", exc)
        return []


# ───────────────────────────────────────────────────────────────
# Utilidades de muestreo y cálculo
# ───────────────────────────────────────────────────────────────

def _haversine_distance(lat1: float, lng1: float, lat2: float, lng2: float) -> float:
    """Distancia en metros entre dos coordenadas (WGS84)."""
    import math

    R = 6371000  # radio de la Tierra en metros
    phi1 = math.radians(lat1)
    phi2 = math.radians(lat2)
    delta_phi = math.radians(lat2 - lat1)
    delta_lambda = math.radians(lng2 - lng1)

    a = (
        math.sin(delta_phi / 2) ** 2
        + math.cos(phi1) * math.cos(phi2) * math.sin(delta_lambda / 2) ** 2
    )
    c = 2 * math.atan2(math.sqrt(a), math.sqrt(1 - a))
    return R * c


def _sample_points_along_route(
    coordinates: list[list[float]], spacing_meters: float = 500
) -> list[tuple[float, float]]:
    """
    Genera puntos espaciados ~spacing_m metros a lo largo de un LineString.
    coordinates: [[lng, lat], ...]
    Devuelve: [(lat, lng), ...] para pasar a TomTom.
    """
    if not coordinates or len(coordinates) < 2:
        return []

    sampled = []
    accumulated = 0.0
    target = 0.0

    for i in range(len(coordinates) - 1):
        lng1, lat1 = coordinates[i]
        lng2, lat2 = coordinates[i + 1]
        segment_length = _haversine_distance(lat1, lng1, lat2, lng2)

        while accumulated + segment_length >= target:
            # Interpolar punto
            ratio = (target - accumulated) / segment_length if segment_length > 0 else 0
            ratio = max(0, min(1, ratio))
            lat = lat1 + (lat2 - lat1) * ratio
            lng = lng1 + (lng2 - lng1) * ratio
            sampled.append((lat, lng))
            target += spacing_meters

        accumulated += segment_length

    return sampled


def calculate_average_speed(coordinates: list[list[float]]) -> float | None:
    """
    Calcula la velocidad promedio (km/h) a lo largo de una ruta.
    Muestrea cada ~500m y consulta flow data de TomTom.
    """
    points = _sample_points_along_route(coordinates, spacing_meters=500)
    if not points:
        return None

    speeds = []
    for lat, lng in points:
        flow = get_traffic_flow_segment(lat, lng)
        if "error" not in flow and flow.get("currentSpeed") is not None:
            speeds.append(flow["currentSpeed"])

    if not speeds:
        return None

    return round(sum(speeds) / len(speeds), 2)


def detect_congestion_zones(
    coordinates: list[list[float]],
) -> list[dict[str, Any]]:
    """
    Detecta zonas de congestión en una ruta.
    Muestrea cada ~300m, marca congestión si currentSpeed < freeFlowSpeed * 0.7.
    Devuelve lista con: {lat, lng, currentSpeed, freeFlowSpeed, congestionLevel}.
    """
    points = _sample_points_along_route(coordinates, spacing_meters=300)
    zones = []

    for lat, lng in points:
        flow = get_traffic_flow_segment(lat, lng)
        if "error" in flow or flow.get("currentSpeed") is None or flow.get("freeFlowSpeed") is None:
            continue

        current = flow["currentSpeed"]
        free = flow["freeFlowSpeed"]
        ratio = current / free if free > 0 else 1.0

        if current < free * 0.7:
            if ratio < 0.3:
                level = "severo"
            elif ratio < 0.5:
                level = "alto"
            else:
                level = "moderado"

            zones.append({
                "lat": lat,
                "lng": lng,
                "currentSpeed": current,
                "freeFlowSpeed": free,
                "congestionLevel": level,
            })

    return zones


# ───────────────────────────────────────────────────────────────
# OSRM — Rutas alternativas (gratuito, OpenStreetMap)
# ───────────────────────────────────────────────────────────────

def get_osrm_alternatives(
    origen_lat: float,
    origen_lng: float,
    destino_lat: float,
    destino_lng: float,
    num_alternatives: int = 2,
) -> list[dict[str, Any]]:
    """
    Obtiene rutas alternativas usando OSRM (Open Source Routing Machine).
    Gratuito, datos OpenStreetMap. NO trae tráfico en tiempo real,
    pero le agregamos velocidad y congestión via TomTom Flow API después.

    Devuelve lista de rutas OSRM (sin la primera, que es la más rápida
    y suele coincidir con la principal de TomTom).
    """
    url = (
        f"https://router.project-osrm.org/route/v1/driving/"
        f"{origen_lng},{origen_lat};{destino_lng},{destino_lat}"
    )
    params = {
        "geometries": "geojson",
        "overview": "full",
        "steps": "false",
        "alternatives": str(num_alternatives),
    }

    logger.info("OSRM alternatives: %s → %s", f"{origen_lat},{origen_lng}", f"{destino_lat},{destino_lng}")

    try:
        response = requests.get(url, params=params, timeout=15)
        response.raise_for_status()
        data = response.json()
    except requests.Timeout:
        logger.error("OSRM timeout para alternativas")
        return []
    except requests.HTTPError as exc:
        body = ""
        try:
            body = exc.response.text[:300] if exc.response else ""
        except Exception:
            body = "(no se pudo leer body)"
        logger.error("OSRM HTTP error: %s", body)
        return []
    except requests.RequestException as exc:
        logger.warning("OSRM alternatives error: %s", exc)
        return []

    if data.get("code") != "Ok" or "routes" not in data:
        logger.warning("OSRM respondió con código: %s", data.get("code"))
        return []

    routes = data.get("routes", [])
    logger.info("OSRM: %d rutas encontradas (incluyendo principal)", len(routes))
    # La primera ruta de OSRM suele ser la más rápida (similar a la de TomTom),
    # devolvemos el resto como alternativas reales
    return routes[1:]


def _process_osrm_alternative(route: dict) -> dict[str, Any] | None:
    """
    Convierte una ruta de OSRM al formato unificado de Tráfico IRL.
    """
    geometry = route.get("geometry", {})
    coordinates = geometry.get("coordinates", [])
    if not coordinates or len(coordinates) < 2:
        return None

    avg_speed = calculate_average_speed(coordinates)
    congestion = detect_congestion_zones(coordinates)

    return {
        "type": "LineString",
        "coordinates": coordinates,
        "summary": {
            "lengthInMeters": int(route.get("distance", 0)),
            "travelTimeInSeconds": int(route.get("duration", 0)),
            # OSRM no tiene datos de tráfico, lo estimamos via TomTom Flow
            "trafficDelayInSeconds": 0,
        },
        "average_speed_kmh": avg_speed,
        "congestion_zones": congestion,
    }


# ───────────────────────────────────────────────────────────────
# Función principal: integración de ruta + tráfico
# ───────────────────────────────────────────────────────────────

def get_route_with_speed(
    origen_lat: float,
    origen_lng: float,
    destino_lat: float,
    destino_lng: float,
) -> dict[str, Any]:
    """
    Integra todo: obtiene ruta(s) de TomTom, calcula velocidad promedio,
    detecta zonas de congestión y devuelve un formato unificado.

    Estrategia híbrida:
    - TomTom: ruta principal con tráfico REAL (velocidad, congestión, retrasos)
    - OSRM: rutas alternativas (geométricamente distintas) con overlay de TomTom
      para velocidad y congestión en tiempo real
    """
    tomtom_data = get_tomtom_route(origen_lat, origen_lng, destino_lat, destino_lng)

    if "error" in tomtom_data:
        return {
            "error": tomtom_data["error"],
            "main_route": None,
            "alternatives": [],
            "all_congestion_zones": [],
        }

    routes_raw = tomtom_data.get("routes", [])
    if not routes_raw:
        return {
            "error": "No se encontraron rutas",
            "main_route": None,
            "alternatives": [],
            "all_congestion_zones": [],
        }

    def _process_route(route_raw: dict) -> dict[str, Any] | None:
        """Convierte una ruta de TomTom al formato unificado."""
        summary = route_raw.get("summary", {})
        legs = route_raw.get("legs", [])
        if not legs:
            return None

        # Extraer coordenadas de todos los legs
        coordinates = []
        for leg in legs:
            points = leg.get("points", [])
            for point in points:
                coordinates.append([point.get("longitude"), point.get("latitude")])

        avg_speed = calculate_average_speed(coordinates)
        congestion = detect_congestion_zones(coordinates)

        return {
            "type": "LineString",
            "coordinates": coordinates,
            "summary": {
                "lengthInMeters": summary.get("lengthInMeters", 0),
                "travelTimeInSeconds": summary.get("travelTimeInSeconds", 0),
                "trafficDelayInSeconds": summary.get("trafficDelayInSeconds", 0),
            },
            "average_speed_kmh": avg_speed,
            "congestion_zones": congestion,
        }

    main = _process_route(routes_raw[0])
    all_congestion = []
    if main:
        all_congestion.extend(main.get("congestion_zones", []))

    # Intentar alternativas de TomTom (solo si el plan las soporta)
    alternatives = []
    for alt_raw in routes_raw[1:]:
        alt_processed = _process_route(alt_raw)
        if alt_processed:
            alternatives.append(alt_processed)
            all_congestion.extend(alt_processed.get("congestion_zones", []))

    # Si TomTom no dió alternativas (plan gratuito), usar OSRM
    if not alternatives:
        logger.info("TomTom no devolvió alternativas. Usando OSRM...")
        osrm_routes = get_osrm_alternatives(
            origen_lat, origen_lng, destino_lat, destino_lng,
            num_alternatives=2,
        )
        for osrm_route in osrm_routes:
            alt_processed = _process_osrm_alternative(osrm_route)
            if alt_processed:
                alternatives.append(alt_processed)
                all_congestion.extend(alt_processed.get("congestion_zones", []))

    return {
        "main_route": main,
        "alternatives": alternatives,
        "all_congestion_zones": all_congestion,
    }


# ───────────────────────────────────────────────────────────────
# Monitoreo periódico de Medellín
# ───────────────────────────────────────────────────────────────

def sample_medellin_traffic() -> dict[str, Any]:
    """
    Muestrea el tráfico en puntos fijos de Medellín (SAMPLE_POINTS).
    Para cada punto consulta flow data, crea/actualiza registros de FlujoVehicular
    en BD y emite evento WebSocket al grupo "traffic_alerts" si hay congestión.

    Devuelve un resumen del muestreo.
    """
    resultados = []
    congestionados = []

    for point in SAMPLE_POINTS:
        lat = point["lat"]
        lng = point["lng"]
        flow = get_traffic_flow_segment(lat, lng)

        if "error" in flow:
            logger.warning(
                "No se pudo obtener flow para ({}, {}): {}".format(lat, lng, flow["error"])
            )
            continue

        current_speed = flow.get("currentSpeed")
        free_flow = flow.get("freeFlowSpeed")

        # Crear o actualizar registro en BD (buscar por segmento cercano o crear uno genérico)
        segmento, _ = SegmentoVial.objects.get_or_create(
            nombre=f"Punto_Muestra_{lat}_{lng}",
            defaults={
                "sentido": "desconocido",
                "velocidad_maxima": int(free_flow) if free_flow else 50,
                "geometria": {"type": "Point", "coordinates": [lng, lat]},
            },
        )

        # Calcular volumen aproximado (placeholder, TomTom no da volumen directo)
        volumen = 0
        if current_speed is not None and free_flow is not None and free_flow > 0:
            # Estimación simple: más lento = más tráfico
            ratio = current_speed / free_flow
            volumen = int((1 - ratio) * 1000) if ratio < 1 else 50
        else:
            volumen = 0

        flujo = FlujoVehicular.objects.create(
            segmento=segmento,
            volumen=max(0, volumen),
            velocidad_promedio=current_speed if current_speed is not None else 0.0,
            congestionado=False,
        )

        # Detectar congestión
        is_congested = False
        if current_speed is not None and free_flow is not None and free_flow > 0:
            if current_speed < free_flow * 0.7:
                is_congested = True
                flujo.congestionado = True
                flujo.save(update_fields=["congestionado"])
                congestionados.append({
                    "lat": lat,
                    "lng": lng,
                    "current_speed": current_speed,
                    "free_flow_speed": free_flow,
                })

        resultados.append({
            "lat": lat,
            "lng": lng,
            "current_speed": current_speed,
            "free_flow_speed": free_flow,
            "congestionado": is_congested,
        })

    # Emitir eventos WebSocket solo si hay congestión
    if congestionados:
        try:
            channel_layer = get_channel_layer()
            async_to_sync(channel_layer.group_send)(
                "traffic_alerts",
                {
                    "type": "traffic_update",
                    "data": {
                        "tipo": "CONGESTION_IRL",
                        "mensaje": f"{len(congestionados)} puntos con congestión detectada",
                        "detalles": congestionados,
                        "timestamp": datetime.now().isoformat(),
                        "total_muestreado": len(resultados),
                    },
                },
            )
            logger.info(f"Emitido WebSocket traffic_alerts con {len(congestionados)} congestiones")
        except Exception as exc:
            logger.exception("Error al emitir WebSocket de congestión: %s", exc)

    return {
        "total_muestreado": len(resultados),
        "congestionados": len(congestionados),
        "detalles": resultados,
    }
