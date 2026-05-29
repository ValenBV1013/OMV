"""
Tareas programadas.
- APScheduler: polling periódico del clima y limpieza de alertas expiradas (Rutas Seguras)
- Celery: actualización periódica de datos de tráfico (Infraestructura)
"""

import logging
import time

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
from django.utils import timezone

from MovAI.models import SegmentoVial, EventoCongestion
from MovAI.services.tomtom_service import TomTomTrafficService
from MovAI.services.here_service import HERETrafficService
from MovAI.services.congestion_analyzer import CongestionAnalyzer
from MovAI.services.websocket_broadcaster import WebSocketBroadcaster
from MovAI.services.dashboard_service import DashboardService
from MovAI.services.kpi_recorder import KPIRecorder

logger = logging.getLogger(__name__)


@shared_task(bind=True, max_retries=3, default_retry_delay=60)
def update_traffic_data(self):
    """
    Tarea principal de actualización de tráfico.

    Ejecuta cada 5 minutos. Para cada segmento activo:
      1. Consulta TomTom Flow API (fallback HERE)
      2. Clasifica congestión
      3. Persiste flujo vehicular
      4. Gestiona eventos de congestión
      5. Broadcastea snapshot vía WebSocket
      6. Registra KPIs
    """
    start = time.time()
    errors = []
    segmentos_actualizados = 0

    tomtom = TomTomTrafficService()
    here = HERETrafficService()

    # Segmentos activos ordenados por jerarquía (más importantes primero)
    segmentos = SegmentoVial.objects.filter(activo=True).order_by(
        'jerarquia_via', 'id'
    )[:12]  # top 12 para no exceder rate limit

    if not segmentos.exists():
        logger.warning("update_traffic_data: no hay segmentos activos en DB")
        return "SKIP: No segments in database"

    for segmento in segmentos:
        try:
            # Intentar TomTom primero
            data = tomtom.fetch_segment_flow(segmento)

            # Fallback HERE si TomTom falla
            if not data:
                logger.debug("Fallback HERE para segmento %s", segmento.id)
                # HERE no tiene fetch por segmento individual, se salta
                # (HERE se usa con bounding box en modo batch)
                continue

            # Clasificar, persistir y gestionar eventos
            CongestionAnalyzer.process_and_save(segmento, data)

            segmentos_actualizados += 1

        except Exception as e:
            errors.append(f"Segmento {segmento.id}: {e}")
            logger.error("Error actualizando segmento %s: %s", segmento.id, e)

    # Broadcast snapshot vía WebSocket
    try:
        dashboard_data = DashboardService.get_init_data()
        WebSocketBroadcaster.broadcast_dashboard_snapshot(
            dashboard_data.get("segmentos", []),
            dashboard_data.get("eventos_recientes", []),
        )
    except Exception as e:
        logger.error("Error broadcasting dashboard snapshot: %s", e)

    # KPI: tiempo de respuesta del ciclo
    elapsed_ms = int((time.time() - start) * 1000)
    KPIRecorder.record('TIEMPO_RESPUESTA_MS', elapsed_ms)
    KPIRecorder.record('CICLO_COMPLETADO', 1, metadata={
        'segmentos_actualizados': segmentos_actualizados,
        'tiempo_ms': elapsed_ms,
    })

    if errors:
        KPIRecorder.record('ERROR_API', len(errors), metadata={'errors': errors})
        logger.warning("update_traffic_data: %d errores en %d segmentos",
                       len(errors), segmentos.count())
        raise self.retry(exc=Exception("; ".join(errors)))

    logger.info("update_traffic_data OK: %d segmentos, %dms",
                segmentos_actualizados, elapsed_ms)
    return f"OK: {segmentos_actualizados} segmentos, {elapsed_ms}ms"


@shared_task
def cleanup_stale_events():
    """
    Limpieza diaria de eventos de congestión.

    Eventos activos con más de 2h sin resolución se marcan como resueltos.
    """
    cutoff = timezone.now() - timezone.timedelta(hours=2)
    afectados = EventoCongestion.objects.filter(
        activo=True, timestamp__lt=cutoff
    ).update(activo=False, resuelto_en=timezone.now())

    logger.info("cleanup_stale_events: %d eventos stale resueltos", afectados)
    return f"OK: {afectados} stale events resolved"


@shared_task
def compact_kpis():
    """
    Compactación diaria de KPIs.

    Elimina registros de KPI más antiguos que 30 días.
    """
    cutoff = timezone.now() - timezone.timedelta(days=30)
    eliminados, _ = RegistroKPI.objects.filter(timestamp__lt=cutoff).delete()
    logger.info("compact_kpis: %d registros antiguos eliminados", eliminados)
    return f"OK: {eliminados} old KPI records cleaned"
