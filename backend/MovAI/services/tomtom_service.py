"""
Servicio de integración con TomTom API (free tier).

Flow API:   traffic/services/4/flowSegmentData/absolute/{style}/json
Routing API: routing/1/calculateRoute/{start}:{end}/json

Rate limit free tier: ~2,500 transacciones/día compartido.
Se optimiza consultando solo los segmentos principales en hora pico.
"""

import logging
import time

import requests
from django.conf import settings
from django.utils import timezone

from .crs_utils import calcular_midpoint_wgs84

logger = logging.getLogger(__name__)


class TomTomTrafficService:
    """Cliente para la API de tráfico de TomTom (free tier)."""

    BASE_URL = "https://api.tomtom.com"

    def __init__(self):
        self.api_key = getattr(settings, 'TOMTOM_API_KEY', '')
        if not self.api_key:
            logger.warning("TOMTOM_API_KEY no configurada en settings")
        self.session = requests.Session()
        self.session.timeout = 10
        self.last_request_time = 0
        self._rate_limit_delay = 0.25  # 250ms entre calls para no saturar

    def _rate_limit(self):
        """Throttle simple para no exceder rate limit."""
        elapsed = time.time() - self.last_request_time
        if elapsed < self._rate_limit_delay:
            time.sleep(self._rate_limit_delay - elapsed)
        self.last_request_time = time.time()

    def fetch_segment_flow(self, segmento):
        """
        Obtiene datos de flujo de tráfico para un segmento vial.

        Args:
            segmento: instancia de SegmentoVial

        Returns:
            dict con current_speed, free_flow_speed, etc.
            o None si la llamada falla o no hay API key.
        """
        if not self.api_key:
            return None

        # Calcular punto medio del segmento en WGS84
        midpoint = calcular_midpoint_wgs84(segmento.geometria_wgs84)
        if not midpoint:
            logger.warning("No se pudo calcular midpoint para segmento %s", segmento.id)
            return None

        self._rate_limit()

        url = f"{self.BASE_URL}/traffic/services/4/flowSegmentData/absolute/10/json"
        params = {
            "point": midpoint,
            "unit": "KMPH",
            "key": self.api_key,
        }

        try:
            resp = self.session.get(url, params=params, timeout=10)
            resp.raise_for_status()
            return self._parse_flow_response(resp.json(), segmento)
        except requests.exceptions.HTTPError as e:
            if resp.status_code == 429:
                logger.warning("TomTom rate limit alcanzado para segmento %s", segmento.id)
            else:
                logger.error("Error HTTP %s en TomTom segmento %s: %s",
                             resp.status_code, segmento.id, e)
            return None
        except requests.exceptions.RequestException as e:
            logger.error("Error de red TomTom segmento %s: %s", segmento.id, e)
            return None

    def _parse_flow_response(self, raw, segmento):
        """Parsea la respuesta de Flow Segment Data."""
        data = raw.get("flowSegmentData", {})
        return {
            "segmento_id": segmento.id,
            "current_speed": data.get("currentSpeed"),
            "free_flow_speed": data.get("freeFlowSpeed"),
            "current_travel_time": data.get("currentTravelTime"),
            "free_flow_travel_time": data.get("freeFlowTravelTime"),
            "confidence": data.get("confidence"),
            "road_closure": data.get("roadClosure", False),
            "timestamp": timezone.now(),
        }

    def calculate_route(self, start_lat, start_lng, end_lat, end_lng, max_alternatives=2):
        """
        Calcula ruta con tráfico en tiempo real entre dos puntos.

        Args:
            start_lat: latitud origen
            start_lng: longitud origen
            end_lat: latitud destino
            end_lng: longitud destino
            max_alternatives: cantidad de alternativas adicionales (default 2)

        Returns:
            list[dict] con rutas parseadas, o None si falla
        """
        if not self.api_key:
            return None

        self._rate_limit()

        start = f"{start_lat},{start_lng}"
        end = f"{end_lat},{end_lng}"

        url = f"{self.BASE_URL}/routing/1/calculateRoute/{start}:{end}/json"
        params = {
            "traffic": "true",
            "routeType": "fastest",
            "key": self.api_key,
        }
        if max_alternatives > 0:
            params["maxAlternatives"] = str(max_alternatives)

        try:
            resp = self.session.get(url, params=params, timeout=15)
            resp.raise_for_status()
            return self._parse_route_response(resp.json())
        except requests.exceptions.RequestException as e:
            logger.error("Error TomTom routing: %s", e)
            return None

    def _parse_route_response(self, raw):
        """Parsea respuesta de Calculate Route."""
        routes = []
        for i, route in enumerate(raw.get("routes", [])):
            summary = route.get("summary", {})

            # TomTom devuelve puntos como lista de {latitude, longitude}
            legs = route.get("legs", [])
            points = []
            for leg in legs:
                for pt in leg.get("points", []):
                    points.append([pt.get("longitude"), pt.get("latitude")])

            routes.append({
                "id": i,
                "travel_time_s": summary.get("travelTimeInSeconds", 0),
                "distance_m": summary.get("lengthInMeters", 0),
                "geometria": {
                    "type": "LineString",
                    "coordinates": points,
                } if points else None,
            })

        return routes
