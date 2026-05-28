"""
Servicio de integración con HERE Maps API (free tier) — fallback de TomTom.

La Traffic Flow API de HERE permite obtener el flujo de TODO Medellín
en una sola llamada usando un bounding box, lo que ahorra calls.
"""

import logging

import requests
from django.conf import settings
from django.utils import timezone

from .crs_utils import calcular_midpoint_wgs84

logger = logging.getLogger(__name__)


class HERETrafficService:
    """Cliente para la Traffic Flow API de HERE Maps."""

    TRAFFIC_URL = "https://traffic.ls.hereapi.com/traffic/6.1/flow.json"
    ROUTING_URL = "https://router.hereapi.com/v8/routes"

    # Bounding box de Medellín en WGS84
    # [minLat, minLng, maxLat, maxLng]
    MEDELLIN_BBOX = "6.1,-75.7,6.4,-75.4"

    def __init__(self):
        self.api_key = getattr(settings, 'HERE_API_KEY', '')
        if not self.api_key:
            logger.warning("HERE_API_KEY no configurada en settings")

    def fetch_all_flow(self):
        """
        Obtiene flujo de tráfico de toda el área de Medellín en una llamada.

        Returns:
            list[dict] con datos de flujo por segmento, o None
        """
        if not self.api_key:
            return None

        params = {
            "bbox": self.MEDELLIN_BBOX,
            "responseattributes": "sh,fc",
            "apiKey": self.api_key,
        }

        try:
            resp = requests.get(self.TRAFFIC_URL, params=params, timeout=15)
            resp.raise_for_status()
            return self._parse_flow_response(resp.json())
        except requests.exceptions.RequestException as e:
            logger.error("Error HERE Traffic Flow: %s", e)
            return None

    def _parse_flow_response(self, raw):
        """Parsea respuesta de Traffic Flow API."""
        rws = raw.get("RWS", [])
        results = []
        for rw in rws:
            for r in rw.get("R", []):
                for s in r.get("S", []):
                    fi = s.get("FI", [])
                    for f in fi:
                        cf = f.get("CF", [{}])[0]
                        sp = cf.get("SP", [{}])[0]
                        results.append({
                            "current_speed": sp.get("SU"),
                            "free_flow_speed": sp.get("FF"),
                            "confidence": sp.get("CN"),
                            "timestamp": timezone.now(),
                        })
        return results

    def calculate_route(self, start_lat, start_lng, end_lat, end_lng, alternatives=True):
        """
        Calcula ruta con tráfico usando HERE Routing API.

        Returns:
            list[dict] con rutas, o None
        """
        if not self.api_key:
            return None

        params = {
            "transportMode": "car",
            "origin": f"{start_lat},{start_lng}",
            "destination": f"{end_lat},{end_lng}",
            "return": "polyline,travelSummary",
            "alternatives": "true" if alternatives else "false",
            "apiKey": self.api_key,
        }

        try:
            resp = requests.get(self.ROUTING_URL, params=params, timeout=15)
            resp.raise_for_status()
            return self._parse_route_response(resp.json())
        except requests.exceptions.RequestException as e:
            logger.error("Error HERE Routing: %s", e)
            return None

    def _parse_route_response(self, raw):
        """Parsea respuesta de HERE Routing API."""
        routes = []
        for i, route in enumerate(raw.get("routes", [])):
            sections = route.get("sections", [])
            points = []
            for section in sections:
                polyline = section.get("polyline", "")
                if polyline:
                    # HERE usa polyline codificado (flexible polyline)
                    # Por ahora skip, se puede implementar decodificación si es necesario
                    pass
                summary = section.get("summary", {})
                routes.append({
                    "id": i,
                    "travel_time_s": summary.get("duration", 0),
                    "distance_m": summary.get("length", 0),
                    "geometria": None,  # Implementar decodificación polyline si se requiere
                })
        return routes
