"""
Servicio de estadísticas de accidentalidad correlacionadas con clima.
Agrupa los accidentes cargados (ZonaRiesgo) por fecha, consulta
precipitación histórica vía Open-Meteo, y popula EstadisticaAccidente.

Open-Meteo Archive API: https://open-meteo.com/ (gratis, sin API key)
"""

import logging
from collections import defaultdict
from datetime import date, datetime, timedelta
from typing import Any

import requests

from ..models import EstadisticaAccidente, ZonaRiesgo

logger = logging.getLogger(__name__)

OPEN_METEO_ARCHIVE = "https://archive-api.open-meteo.com/v1/archive"

# Coordenadas representativas de Medellín para consulta climática
MEDELLIN_LAT = 6.2442
MEDELLIN_LNG = -75.5812


def build_accident_statistics(batch_size: int = 100) -> dict[str, Any]:
    """
    Procesa todos los accidentes cargados y popula EstadisticaAccidente.

    1. Agrupa ZonaRiesgo (tipo=accidentalidad) por fecha
    2. Consulta precipitación histórica en Open-Meteo (por batches de fechas)
    3. Crea/actualiza registros en EstadisticaAccidente

    Args:
        batch_size: fechas por consulta a Open-Meteo (max 365 recomendado)

    Returns:
        dict con total_dias, accidentes_procesados, errores
    """
    accidentes = ZonaRiesgo.objects.filter(
        tipo="accidentalidad",
        fecha_evento__isnull=False,
    ).values("fecha_evento", "geometria", "gravedad")

    if not accidentes:
        logger.warning("No hay accidentes cargados con fecha. Ejecutá load_geodata primero.")
        return {"error": "No hay datos de accidentes", "procesados": 0}

    # 1. Agrupar por fecha
    logger.info(f"Agrupando {len(accidentes)} accidentes por fecha...")
    por_fecha: dict[date, dict] = defaultdict(lambda: {"count": 0, "puntos": []})

    for acc in accidentes:
        if acc["fecha_evento"] is None:
            continue
        d = acc["fecha_evento"]
        if isinstance(d, datetime):
            d = d.date()
        por_fecha[d]["count"] += 1
        por_fecha[d]["puntos"].append({
            "type": "Feature",
            "geometry": acc["geometria"],
            "properties": {"gravedad": acc.get("gravedad", "")},
        })

    fechas_ordenadas = sorted(por_fecha.keys())
    logger.info(f"Total fechas con accidentes: {len(fechas_ordenadas)}")

    # 2. Consultar precipitación por batches
    creados = 0
    errores = 0

    for i in range(0, len(fechas_ordenadas), batch_size):
        batch_fechas = fechas_ordenadas[i:i + batch_size]
        inicio = batch_fechas[0]
        fin = batch_fechas[-1]

        precipitacion_por_fecha = _fetch_precipitacion_batch(inicio, fin)

        for fecha_dt in batch_fechas:
            datos = por_fecha[fecha_dt]
            precip = precipitacion_por_fecha.get(fecha_dt, 0.0)

            try:
                EstadisticaAccidente.objects.update_or_create(
                    fecha=fecha_dt,
                    defaults={
                        "nivel_precipitacion": round(precip, 2),
                        "num_accidentes": datos["count"],
                        "zonas_afectadas": {
                            "type": "FeatureCollection",
                            "features": datos["puntos"],
                        },
                    },
                )
                creados += 1
            except Exception as e:
                logger.error(f"Error guardando estadística para {fecha_dt}: {e}")
                errores += 1

        logger.info(f"  Batch {i // batch_size + 1}: {inicio} → {fin} ({len(batch_fechas)} fechas)")

    return {
        "dias_procesados": creados,
        "accidentes_procesados": sum(v["count"] for v in por_fecha.values()),
        "errores": errores,
    }


def _fetch_precipitacion_batch(inicio: date, fin: date) -> dict[date, float]:
    """
    Consulta precipitación diaria acumulada a Open-Meteo para un rango de fechas.

    Returns:
        {date: mm_de_precipitacion, ...}
    """
    params = {
        "latitude": MEDELLIN_LAT,
        "longitude": MEDELLIN_LNG,
        "start_date": inicio.isoformat(),
        "end_date": fin.isoformat(),
        "daily": "precipitation_sum",
        "timezone": "America/Bogota",
    }

    try:
        resp = requests.get(OPEN_METEO_ARCHIVE, params=params, timeout=30)
        resp.raise_for_status()
        data = resp.json()
    except requests.RequestException as e:
        logger.error(f"Error consultando Open-Meteo ({inicio} → {fin}): {e}")
        return {}
    except ValueError as e:
        logger.error(f"Respuesta inválida de Open-Meteo: {e}")
        return {}

    daily = data.get("daily", {})
    fechas_raw = daily.get("time", [])
    precipitaciones = daily.get("precipitation_sum", [])

    resultado = {}
    for fecha_str, mm in zip(fechas_raw, precipitaciones):
        try:
            f = date.fromisoformat(fecha_str)
            resultado[f] = float(mm) if mm is not None else 0.0
        except (ValueError, TypeError):
            continue

    return resultado
