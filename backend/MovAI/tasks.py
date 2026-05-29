"""
Tareas programadas.
- APScheduler: polling periódico del clima y limpieza de alertas expiradas (Rutas Seguras)
- Celery: actualización periódica de datos de tráfico (Infraestructura)
"""

import logging

from apscheduler.schedulers.background import BackgroundScheduler
from django.conf import settings

from .services.weather import desactivar_alertas_expiradas, poll_current_weather

logger = logging.getLogger(__name__)

_scheduler = None


def start_scheduler():
    """
    Inicia el scheduler de APScheduler con las tareas periódicas.
    Se llama desde `ready()` en apps.py.
    """
    global _scheduler

    if _scheduler is not None:
        logger.warning("Scheduler ya estaba iniciado, se omite")
        return

    _scheduler = BackgroundScheduler(daemon=True)

    # Polling de clima cada 10 minutos
    _scheduler.add_job(
        poll_current_weather,
        trigger="interval",
        minutes=getattr(settings, "OWM_POLL_INTERVAL_MINUTES", 10),
        id="poll_weather",
        name="Obtener clima actual de OpenWeatherMap",
        replace_existing=True,
        misfire_grace_time=60,
    )

    # Limpieza de alertas expiradas cada 30 minutos
    _scheduler.add_job(
        desactivar_alertas_expiradas,
        trigger="interval",
        minutes=30,
        id="cleanup_alerts",
        name="Desactivar alertas climáticas expiradas",
        replace_existing=True,
        misfire_grace_time=120,
    )

    _scheduler.start()
    logger.info(
        "APScheduler iniciado: poll_weather cada %d min, cleanup_alerts cada 30 min",
        getattr(settings, "OWM_POLL_INTERVAL_MINUTES", 10),
    )


def stop_scheduler():
    """Detiene el scheduler. Se llama al finalizar la app."""
    global _scheduler
    if _scheduler:
        _scheduler.shutdown(wait=False)
        _scheduler = None
        logger.info("APScheduler detenido")


# ═══════════════════════════════════════════════
# Tareas Celery — Módulo de Tráfico
# ═══════════════════════════════════════════════

from celery import shared_task
from .services.traffic_engine import fetch_mapgis_data, analyze_congestion

@shared_task
def update_traffic_data():
    """
    Tarea periódica (cada 5 min) para consumir MapGIS
    y actualizar el estado de congestión.
    """
    # 1. Fetch GeoJSON from public MapGIS DB
    geojson_data = fetch_mapgis_data()

    # 2. Analyze Congestion & Dynamic Thresholds
    analyze_congestion(geojson_data)

    return "Traffic data updated and analyzed successfully."
