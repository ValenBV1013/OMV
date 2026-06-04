"""
Analizador de riesgo para rutas viales.
Evalúa segmentos de ruta contra zonas de inundación, arroyos y accidentalidad,
aplicando un factor multiplicador según la precipitación actual.

OPTIMIZACIÓN: Carga TODAS las zonas de riesgo en memoria UNA SOLA VEZ
al inicio de evaluar_ruta(), evitando N consultas a DB por punto evaluado.
Para 46K registros de accidentalidad + 82 polígonos de inundación + 13 sensores,
la carga inicial es ~3 consultas SQL; luego todo es en memoria.
"""

import logging
from typing import Any

from ..models import AlertaClima, ZonaRiesgo

logger = logging.getLogger(__name__)

# Umbrales de riesgo
UMBRAL_RIESGO_BAJO = 0.25
UMBRAL_RIESGO_MODERADO = 0.50
UMBRAL_RIESGO_ALTO = 0.75

# Pesos base para cada tipo de zona de riesgo
PESO_INUNDACION = 0.45
PESO_ACCIDENTALIDAD = 0.25
PESO_SENSOR_NIVEL = 0.30

# Distancia de tolerancia en grados (~100m en Medellín en lat/lng)
TOLERANCIA_GRADOS = 0.001


def _punto_en_poligono(lng: float, lat: float, polygon_coords: list) -> bool:
    """
    Algoritmo Ray-Casting: determina si un punto está dentro de un polígono.
    polygon_coords es una lista de rings, cada ring es lista de [lng, lat].
    """
    ring = polygon_coords[0]  # exterior ring
    n = len(ring)
    inside = False
    j = n - 1
    for i in range(n):
        yi, xi = ring[i][1], ring[i][0]
        yj, xj = ring[j][1], ring[j][0]
        if ((yi > lat) != (yj > lat)) and (
            lng < (xj - xi) * (lat - yi) / (yj - yi) + xi
        ):
            inside = not inside
        j = i
    return inside


def _distancia_aprox(lng1, lat1, lng2, lat2):
    """Distancia euclidiana aproximada en grados (para filtro rápido)."""
    return ((lat2 - lat1) ** 2 + (lng2 - lng1) ** 2) ** 0.5


def _cargar_datos_riesgo():
    """
    Carga TODAS las zonas de riesgo en memoria en 3 consultas SQL.
    Retorna un dict con los datos estructurados para evaluación rápida.
    """
    datos = {
        "inundaciones": [],    # [(nivel_riesgo, geometria, es_polygon), ...]
        "accidentalidad": [],  # [(lng, lat, nivel_riesgo), ...]
        "sensores": [],        # [(lng, lat, nivel_riesgo), ...]
    }

    # 1. Zonas de inundación (polígonos)
    for zona in ZonaRiesgo.objects.filter(
        tipo="inundacion", nivel_riesgo__gte=2
    ).only("nivel_riesgo", "geometria").iterator():
        datos["inundaciones"].append({
            "nivel": zona.nivel_riesgo,
            "geometria": zona.geometria,
        })

    # 2. Puntos de accidentalidad (46K registros)
    for zona in ZonaRiesgo.objects.filter(
        tipo="accidentalidad"
    ).only("nivel_riesgo", "geometria").iterator():
        coords = zona.geometria.get("coordinates", [0, 0])
        if len(coords) == 2:
            datos["accidentalidad"].append({
                "lng": coords[0],
                "lat": coords[1],
                "nivel": zona.nivel_riesgo,
            })

    # 3. Sensores de nivel (quebradas)
    for zona in ZonaRiesgo.objects.filter(
        tipo="sensor_nivel"
    ).only("nivel_riesgo", "geometria").iterator():
        coords = zona.geometria.get("coordinates", [0, 0])
        if len(coords) == 2:
            datos["sensores"].append({
                "lng": coords[0],
                "lat": coords[1],
                "nivel": zona.nivel_riesgo,
            })

    return datos


def _check_punto_contra_zonas(
    lng: float,
    lat: float,
    datos_riesgo: dict,
) -> dict:
    """
    Evalúa un punto contra los datos de riesgo PRECARGADOS en memoria.
    No hace consultas a DB.
    """
    resultado = {
        "inundacion": 0.0,
        "accidentalidad": 0.0,
        "sensor_nivel": 0.0,
        "max_score": 0.0,
    }

    distancia_max = TOLERANCIA_GRADOS * 3
    bbox_lng_min = lng - distancia_max
    bbox_lng_max = lng + distancia_max
    bbox_lat_min = lat - distancia_max
    bbox_lat_max = lat + distancia_max

    # 1. Zonas de inundación — point-in-polygon preciso
    for zona_inun in datos_riesgo["inundaciones"]:
        geom = zona_inun["geometria"]
        if geom["type"] == "Polygon":
            if _punto_en_poligono(lng, lat, geom["coordinates"]):
                score = (zona_inun["nivel"] / 5.0) * PESO_INUNDACION
                resultado["inundacion"] = max(resultado["inundacion"], score)
        elif geom["type"] == "MultiPolygon":
            for polygon in geom["coordinates"]:
                if _punto_en_poligono(lng, lat, polygon):
                    score = (zona_inun["nivel"] / 5.0) * PESO_INUNDACION
                    resultado["inundacion"] = max(resultado["inundacion"], score)
                    break

    # 2. Puntos de accidentalidad — filtro rápido por bounding box + distancia
    for punto in datos_riesgo["accidentalidad"]:
        # Bounding box check rápido antes de calcular distancia
        if not (bbox_lng_min <= punto["lng"] <= bbox_lng_max):
            continue
        if not (bbox_lat_min <= punto["lat"] <= bbox_lat_max):
            continue
        dst = _distancia_aprox(lng, lat, punto["lng"], punto["lat"])
        if dst < distancia_max:
            score = (1 - dst / distancia_max) * PESO_ACCIDENTALIDAD * (punto["nivel"] / 5.0)
            if score > resultado["accidentalidad"]:
                resultado["accidentalidad"] = score

    # 3. Sensores de nivel — mismo patrón
    for sensor in datos_riesgo["sensores"]:
        if not (bbox_lng_min <= sensor["lng"] <= bbox_lng_max):
            continue
        if not (bbox_lat_min <= sensor["lat"] <= bbox_lat_max):
            continue
        dst = _distancia_aprox(lng, lat, sensor["lng"], sensor["lat"])
        if dst < distancia_max:
            score = (1 - dst / distancia_max) * PESO_SENSOR_NIVEL * (sensor["nivel"] / 5.0)
            if score > resultado["sensor_nivel"]:
                resultado["sensor_nivel"] = score

    resultado["max_score"] = max(
        resultado["inundacion"],
        resultado["accidentalidad"],
        resultado["sensor_nivel"],
    )
    return resultado


def evaluar_ruta(route_geometry: list[list[float]], alertas_activas: list | None = None) -> dict:
    """
    Evalúa una ruta completa contra todos los factores de riesgo.

    OPTIMIZACIÓN: Carga todas las zonas de riesgo UNA SOLA VEZ al inicio,
    luego evalúa cada punto muestra en memoria pura. ~3 consultas SQL totales,
    sin importar cuántos puntos tenga la ruta.

    Args:
        route_geometry: Lista de coordenadas [lng, lat] que forman la polyline
        alertas_activas: Lista de alertas climáticas activas (opcional)

    Returns:
        dict con riesgo_promedio, max_riesgo, segmentos_riesgosos, restricciones, etc.
    """
    if not route_geometry or len(route_geometry) < 2:
        return {
            "riesgo_promedio": 0.0,
            "max_riesgo": 0.0,
            "segmentos_riesgosos": 0,
            "restricciones": [],
            "scores_por_tipo": {},
        }

    # ── Carga única en memoria ──
    datos_riesgo = _cargar_datos_riesgo()

    # ── Factor lluvia ──
    if alertas_activas is None:
        alertas_activas = list(
            AlertaClima.objects.filter(activa=True).values("nivel_precipitacion")
        )

    if alertas_activas:
        max_precip = max(a["nivel_precipitacion"] for a in alertas_activas)
        factor_lluvia = 0.8 + (max_precip / 100) * 1.2
        factor_lluvia = min(factor_lluvia, 2.0)
    else:
        factor_lluvia = 0.8

    # ── Muestrear puntos ──
    paso = max(1, len(route_geometry) // 50)
    puntos_muestra = route_geometry[::paso]

    scores_acumulados = []
    scores_por_tipo = {
        "inundacion": [], "accidentalidad": [], "sensor_nivel": []
    }
    restricciones_set = set()

    for punto in puntos_muestra:
        if len(punto) < 2:
            continue
        lng, lat = punto[0], punto[1]
        score_punto = _check_punto_contra_zonas(lng, lat, datos_riesgo)
        score_total = score_punto["max_score"] * factor_lluvia
        scores_acumulados.append(score_total)

        for tipo in ["inundacion", "accidentalidad", "sensor_nivel"]:
            if score_punto[tipo] > 0:
                scores_por_tipo[tipo].append(score_punto[tipo])

        if score_punto["inundacion"] > 0:
            restricciones_set.add("inundacion")
        if score_punto["sensor_nivel"] > 0:
            restricciones_set.add("arroyo")
        if score_punto["accidentalidad"] > 0:
            restricciones_set.add("alta_accidentalidad")

    if not scores_acumulados:
        return {
            "riesgo_promedio": 0.0,
            "max_riesgo": 0.0,
            "segmentos_riesgosos": 0,
            "restricciones": [],
            "scores_por_tipo": {},
        }

    riesgo_promedio = sum(scores_acumulados) / len(scores_acumulados)
    max_riesgo = max(scores_acumulados)
    segmentos_riesgosos = sum(1 for s in scores_acumulados if s > UMBRAL_RIESGO_MODERADO)

    scores_promedio = {}
    for tipo, valores in scores_por_tipo.items():
        scores_promedio[tipo] = round(sum(valores) / len(valores), 4) if valores else 0.0

    # ── Puntos de riesgo individuales para visualización por segmento ──
    puntos_riesgo = []
    for i, punto in enumerate(puntos_muestra):
        if len(punto) < 2:
            continue
        score = scores_acumulados[i] if i < len(scores_acumulados) else 0.0
        puntos_riesgo.append({
            "lng": punto[0],
            "lat": punto[1],
            "score": round(score, 4),
        })

    return {
        "riesgo_promedio": round(riesgo_promedio, 4),
        "max_riesgo": round(max_riesgo, 4),
        "segmentos_riesgosos": segmentos_riesgosos,
        "total_segmentos": len(scores_acumulados),
        "restricciones": list(restricciones_set),
        "scores_por_tipo": scores_promedio,
        "factor_lluvia": round(factor_lluvia, 2),
        "puntos_riesgo": puntos_riesgo,
    }
