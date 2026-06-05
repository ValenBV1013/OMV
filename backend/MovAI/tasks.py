"""
Tareas programadas.
Usa APScheduler para polling periódico del clima y del tráfico IRL.
"""

import logging

from apscheduler.schedulers.background import BackgroundScheduler
from django.conf import settings

from .services.traffic_engine import sample_medellin_traffic
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

    # Monitoreo de tráfico cada 5 minutos
    _traffic_interval = getattr(settings, "TRAFFIC_POLL_INTERVAL_MINUTES", 5)
    _scheduler.add_job(
        update_traffic_data,
        trigger="interval",
        minutes=_traffic_interval,
        id="poll_traffic",
        name="Monitorear tráfico IRL en 10 puntos fijos de Medellín",
        replace_existing=True,
        misfire_grace_time=60,
    )

    _scheduler.start()
    logger.info(
        "APScheduler iniciado: poll_weather cada %d min, "
        "cleanup_alerts cada 30 min, poll_traffic cada %d min",
        getattr(settings, "OWM_POLL_INTERVAL_MINUTES", 10),
        _traffic_interval,
    )


def stop_scheduler():
    """Detiene el scheduler. Se llama al finalizar la app."""
    global _scheduler
    if _scheduler:
        _scheduler.shutdown(wait=False)
        _scheduler = None
        logger.info("APScheduler detenido")


# ─────────────────────────────────────────────
# Tareas individuales (llamadas por APScheduler)
# ─────────────────────────────────────────────

def update_traffic_data():
    """
    Consulta TomTom Traffic Flow API en 10 puntos fijos de Medellín
    y actualiza estado de congestión en BD + WebSocket.
    Se ejecuta cada 5 minutos vía APScheduler.
    """
    try:
        result = sample_medellin_traffic()
        logger.info(
            "Tráfico actualizado: %d puntos muestreados, %d congestionados",
            result.get("total_muestreado", 0),
            result.get("congestionados", 0),
        )
        return result
    except Exception as e:
        logger.exception("Error en update_traffic_data")
        return {"error": str(e)}
