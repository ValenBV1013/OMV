"""
Analizador de congestión vehicular.

Clasifica el nivel de congestión basado en el ratio
velocidad_actual / velocidad_libre (free flow).

Umbrales:
  > 0.70  → BAJO
  0.50-0.70 → MODERADO
  0.30-0.49 → ALTO
  < 0.30  → SEVERO

Cuando se detecta ALTO o SEVERO, crea un EventoCongestion y lo
broadcastea vía WebSocket.
"""

import logging

from django.utils import timezone

from MovAI.models import FlujoVehicular, EventoCongestion
from .websocket_broadcaster import WebSocketBroadcaster

logger = logging.getLogger(__name__)


class CongestionAnalyzer:
    """Clasificador de congestión con persistencia y alertas."""

    # (ratio mínimo, nivel)
    UMBRALES = [
        (0.70, 'BAJO', False),
        (0.50, 'MODERADO', False),
        (0.30, 'ALTO', True),
        (0.00, 'SEVERO', True),
    ]

    @classmethod
    def classify(cls, current_speed, free_flow_speed):
        """
        Clasifica el nivel de congestión según el ratio.

        Args:
            current_speed: velocidad actual en km/h
            free_flow_speed: velocidad sin congestión en km/h

        Returns:
            tuple (nivel: str, es_critico: bool)
        """
        if not current_speed or not free_flow_speed or free_flow_speed <= 0:
            return 'BAJO', False

        ratio = current_speed / free_flow_speed
        for umbral, nivel, critico in cls.UMBRALES:
            if ratio >= umbral:
                return nivel, critico

        return 'SEVERO', True

    @classmethod
    def process_and_save(cls, segmento, data):
        """
        Clasifica, persiste el flujo y gestiona eventos de congestión.

        Args:
            segmento: instancia de SegmentoVial
            data: dict con current_speed, free_flow_speed, confidence, etc.

        Returns:
            FlujoVehicular creado
        """
        current_speed = data.get('current_speed')
        free_flow_speed = data.get('free_flow_speed')
        nivel, es_critico = cls.classify(current_speed, free_flow_speed)

        flujo = FlujoVehicular.objects.create(
            segmento=segmento,
            velocidad_promedio=current_speed or 0,
            velocidad_libre=free_flow_speed,
            nivel_congestion=nivel,
            congestionado=es_critico,
            fuente='tomtom',
        )

        # Gestionar eventos de congestión
        if es_critico:
            cls._crear_evento(segmento, nivel, current_speed, free_flow_speed)
        else:
            cls._resolver_eventos(segmento)

        return flujo

    @classmethod
    def _crear_evento(cls, segmento, nivel, velocidad_promedio, velocidad_libre):
        """Crea un evento de congestión si no hay uno activo para el segmento."""
        existe_activo = EventoCongestion.objects.filter(
            segmento=segmento, activo=True
        ).exists()

        if not existe_activo:
            evento = EventoCongestion.objects.create(
                segmento=segmento,
                nivel=nivel,
                velocidad_promedio=velocidad_promedio or 0,
                velocidad_libre=velocidad_libre,
            )
            logger.info("🚨 Evento congestión creado: %s — %s", segmento.nombre, nivel)

            # Broadcast WebSocket
            WebSocketBroadcaster.broadcast_congestion_alert(segmento, evento)

    @classmethod
    def _resolver_eventos(cls, segmento):
        """Resuelve todos los eventos activos de un segmento (vuelta a la normalidad)."""
        ahora = timezone.now()
        actualizados = EventoCongestion.objects.filter(
            segmento=segmento, activo=True
        ).update(activo=False, resuelto_en=ahora)

        if actualizados > 0:
            logger.info("✅ Eventos resueltos para %s (%d)", segmento.nombre, actualizados)
