"""
Servicio de enrutamiento seguro.
Usa OSRM (Open Source Routing Machine) para calcular rutas y
RiskAnalyzer para evaluar y seleccionar la ruta más segura.

OSRM API pública: https://router.project-osrm.org/
Sin API key, gratuito, datos OpenStreetMap.
"""

import logging
from typing import Any

import requests
from django.conf import settings
from django.utils import timezone as tz

from ..models import AlertaClima, Navegacion
from .risk_analyzer import evaluar_ruta, UMBRAL_RIESGO_MODERADO, UMBRAL_RIESGO_ALTO

logger = logging.getLogger(__name__)

OSRM_BASE_URL = "https://router.project-osrm.org/route/v1/driving"


def _osm_route_request(origen_lng, origen_lat, destino_lng, destino_lat, alternatives=True):
    """
    Consulta OSRM para obtener rutas entre origen y destino.

    Returns:
        list[dict] — lista de rutas alternativas con geometry, distance, duration
        o None si hay error.
    """
    url = (
        f"{OSRM_BASE_URL}/{origen_lng},{origen_lat};"
        f"{destino_lng},{destino_lat}"
    )
    params = {
        "geometries": "geojson",
        "overview": "full",
        "steps": "false",
        "alternatives": "true" if alternatives else "false",
    }

    try:
        resp = requests.get(url, params=params, timeout=15)
        resp.raise_for_status()
        data = resp.json()
    except requests.RequestException as e:
        logger.error(f"Error al consultar OSRM: {e}")
        return None

    if data.get("code") != "Ok" or "routes" not in data:
        logger.warning(f"OSRM respondió con código: {data.get('code')}")
        return None

    routes = []
    for route in data["routes"]:
        routes.append({
            "geometry": route["geometry"]["coordinates"],  # [[lng, lat], ...]
            "distance_m": route["distance"],
            "duration_s": route["duration"],
        })

    return routes


def get_safe_route(
    origen: dict,
    destino: dict,
    modo_lluvias: bool = True,
    id_cliente: str | None = None,
    save_history: bool = True,
) -> dict:
    """
    Calcula la ruta más segura entre origen y destino.

    1. Obtiene múltiples alternativas de OSRM
    2. Evalúa cada ruta contra zonas de riesgo
    3. Selecciona la de menor riesgo promedio
    4. Persiste en Navegacion

    Args:
        origen: {lat, lng}
        destino: {lat, lng}
        modo_lluvias: si está activo, prioriza seguridad sobre tiempo
        id_cliente: opcional, UUID del cliente (frontend localStorage)
        save_history: si se persiste en DB

    Returns:
        dict con ruta, riesgo, restricciones, métricas
    """
    # Obtener alertas activas (para factor lluvia)
    alertas_activas = list(
        AlertaClima.objects.filter(activa=True).values("nivel_precipitacion")
    )

    # 1. Pedir rutas a OSRM (3 alternativas)
    routes = _osm_route_request(
        origen["lng"], origen["lat"],
        destino["lng"], destino["lat"],
        alternatives=True,
    )

    if not routes:
        # Fallback: un solo intento sin alternativas
        routes = _osm_route_request(
            origen["lng"], origen["lat"],
            destino["lng"], destino["lat"],
            alternatives=False,
        )
        if not routes:
            return {
                "error": "No se pudo calcular la ruta. Verifique las coordenadas.",
                "origen": origen,
                "destino": destino,
            }

    # 2. Evaluar cada ruta
    routes_evaluadas = []
    for ruta in routes:
        evaluacion = evaluar_ruta(ruta["geometry"], alertas_activas)
        routes_evaluadas.append({
            **ruta,
            "evaluacion": evaluacion,
        })

    # 3. Seleccionar la mejor ruta
    if modo_lluvias:
        # Ordenar por riesgo_promedio ASC (menor riesgo primero)
        routes_evaluadas.sort(key=lambda r: r["evaluacion"]["riesgo_promedio"])
    else:
        # Ordenar por duración ASC (más rápido primero)
        routes_evaluadas.sort(key=lambda r: r["duration_s"])

    mejor_ruta = routes_evaluadas[0]

    # 4. Armar respuesta
    respuesta = {
        "ruta": {
            "type": "LineString",
            "coordinates": mejor_ruta["geometry"],
        },
        "riesgo_promedio": mejor_ruta["evaluacion"]["riesgo_promedio"],
        "max_riesgo": mejor_ruta["evaluacion"]["max_riesgo"],
        "restricciones_evitadas": mejor_ruta["evaluacion"]["restricciones"],
        "tiempo_estimado_segundos": int(mejor_ruta["duration_s"]),
        "distancia_km": round(mejor_ruta["distance_m"] / 1000, 2),
        "modo_lluvias": modo_lluvias,
        "nivel_alerta": _nivel_alerta(mejor_ruta["evaluacion"]["riesgo_promedio"]),
        "detalle_riesgos": mejor_ruta["evaluacion"]["scores_por_tipo"],
        "factor_lluvia": mejor_ruta["evaluacion"]["factor_lluvia"],
        "alternativas": len(routes_evaluadas),
    }

    # 5. Persistir en DB
    if save_history:
        try:
            restricciones_str = ",".join(mejor_ruta["evaluacion"]["restricciones"])

            Navegacion.objects.create(
                id_cliente=id_cliente,
                origen=origen,
                destino=destino,
                ruta_segura_coordenadas={
                    "type": "FeatureCollection",
                    "features": [{
                        "type": "Feature",
                        "geometry": respuesta["ruta"],
                        "properties": {"riesgo": respuesta["riesgo_promedio"]},
                    }],
                },
                restricciones_evitadas=restricciones_str or None,
                tiempo_estimado=int(mejor_ruta["duration_s"]),
                distancia=round(mejor_ruta["distance_m"] / 1000, 2),
                modo_lluvias=modo_lluvias,
                riesgo_promedio=mejor_ruta["evaluacion"]["riesgo_promedio"],
            )
        except Exception as e:
            logger.error(f"Error al guardar historial de navegación: {e}")

    return respuesta


def _nivel_alerta(riesgo: float) -> str:
    """Clasifica el nivel de alerta según el score de riesgo."""
    if riesgo >= UMBRAL_RIESGO_ALTO:
        return "CRITICO"
    elif riesgo >= UMBRAL_RIESGO_MODERADO:
        return "ADVERTENCIA"
    else:
        return "SEGURO"
