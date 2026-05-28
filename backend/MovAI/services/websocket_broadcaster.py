"""
Broadcaster de eventos vía WebSocket (Django Channels).

Maneja dos grupos:
  - traffic_alerts: alertas de congestión severa (event-driven)
  - dashboard_updates: snapshot periódico del dashboard (cada 5 min)
"""

import json
import logging

from channels.layers import get_channel_layer
from asgiref.sync import async_to_sync

logger = logging.getLogger(__name__)


class WebSocketBroadcaster:
    """Emisión de eventos en tiempo real a los clientes WebSocket."""

    GROUP_ALERTS = "traffic_alerts"
    GROUP_DASHBOARD = "dashboard_updates"

    @classmethod
    def broadcast_congestion_alert(cls, segmento, evento):
        """
        Emite una alerta de congestión a todos los clientes conectados.

        Args:
            segmento: instancia de SegmentoVial
            evento: instancia de EventoCongestion
        """
        try:
            channel_layer = get_channel_layer()
            async_to_sync(channel_layer.group_send)(
                cls.GROUP_ALERTS,
                {
                    "type": "congestion_alert",
                    "data": {
                        "tipo": "CONGESTION_ALERT",
                        "evento_id": evento.id,
                        "segmento_id": segmento.id,
                        "segmento_nombre": segmento.nombre or segmento.label,
                        "nivel": evento.nivel,
                        "velocidad": evento.velocidad_promedio,
                        "timestamp": evento.timestamp.isoformat(),
                    },
                },
            )
            logger.debug("Broadcast alerta congestión: %s — %s", segmento.nombre, evento.nivel)
        except Exception as e:
            logger.error("Error broadcasting congestion alert: %s", e)

    @classmethod
    def broadcast_dashboard_snapshot(cls, segmentos_data, eventos_data):
        """
        Emite un snapshot del dashboard a todos los clientes.

        Args:
            segmentos_data: list[dict] con estado actual de cada segmento
            eventos_data: list[dict] con eventos activos
        """
        try:
            channel_layer = get_channel_layer()
            async_to_sync(channel_layer.group_send)(
                cls.GROUP_DASHBOARD,
                {
                    "type": "dashboard_snapshot",
                    "data": {
                        "tipo": "DASHBOARD_SNAPSHOT",
                        "segmentos": segmentos_data,
                        "eventos_activos": eventos_data,
                        "timestamp": event_timestamp(),
                    },
                },
            )
        except Exception as e:
            logger.error("Error broadcasting dashboard snapshot: %s", e)


def event_timestamp():
    """ISO timestamp compatible."""
    from django.utils import timezone
    return timezone.now().isoformat()
