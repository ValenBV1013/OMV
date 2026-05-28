"""
WebSocket consumers para el módulo de tráfico.

Grupos:
  - traffic_alerts:    alertas de congestión severa (event-driven)
  - dashboard_updates: snapshot del dashboard cada 5 min
"""

import json
import logging

from channels.generic.websocket import AsyncWebsocketConsumer

logger = logging.getLogger(__name__)


class TrafficConsumer(AsyncWebsocketConsumer):
    """
    Consumer WebSocket para datos de tráfico en tiempo real.

    Se conecta a /ws/traffic/ y recibe:
      - Congestion alerts (event-driven)
      - Dashboard snapshots (cada 5 min)
    """

    async def connect(self):
        """Conecta al cliente a ambos grupos."""
        self.groups = ["traffic_alerts", "dashboard_updates"]

        for group in self.groups:
            await self.channel_layer.group_add(group, self.channel_name)

        await self.accept()
        logger.debug("WebSocket conectado: %s", self.channel_name)

    async def disconnect(self, close_code):
        """Desconecta al cliente de ambos grupos."""
        for group in self.groups:
            await self.channel_layer.group_discard(group, self.channel_name)

        logger.debug("WebSocket desconectado: %s (code %s)", self.channel_name, close_code)

    # ── Handlers de eventos ──

    async def congestion_alert(self, event):
        """
        Recibe del group_send tipo 'congestion_alert'.
        Reenvía al cliente WebSocket.
        """
        data = event.get("data", {})
        await self.send(text_data=json.dumps(data, default=str))

    async def dashboard_snapshot(self, event):
        """
        Recibe del group_send tipo 'dashboard_snapshot'.
        Reenvía al cliente WebSocket.
        """
        data = event.get("data", {})
        await self.send(text_data=json.dumps(data, default=str))
