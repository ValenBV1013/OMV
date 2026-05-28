"""
Planificador de rutas alternativas.

Implementa RN 2.2.1:
  "Una ruta alterna solo se sugerirá si reduce el tiempo estimado
   de viaje en por lo menos un 15% o 5 minutos mínimos."

Estrategia:
  1. Consulta TomTom Routing con traffic=true (fallback HERE)
  2. Compara la ruta principal (con tráfico) vs alternativas
  3. Filtra por la regla del 15% o 300s
  4. Persiste la RutaSugerida
  5. Retorna las alternativas válidas
"""

import json
import logging

from MovAI.models import RutaSugerida
from MovAI.services.tomtom_service import TomTomTrafficService
from MovAI.services.here_service import HERETrafficService
from .kpi_recorder import KPIRecorder

logger = logging.getLogger(__name__)


class RoutePlanner:
    """Planificador de rutas alternativas con regla de ahorro mínimo."""

    AHORRO_PORCENTAJE_MIN = 15.0   # 15%
    AHORRO_SEGUNDOS_MIN = 300      # 5 minutos

    def __init__(self):
        self.tomtom = TomTomTrafficService()
        self.here = HERETrafficService()

    def find_alternative(self, start_lat, start_lng, end_lat, end_lng):
        """
        Encuentra rutas alternativas que cumplan RN 2.2.1.

        Args:
            start_lat: latitud origen
            start_lng: longitud origen
            end_lat: latitud destino
            end_lng: longitud destino

        Returns:
            dict con ruta_original y alternativas filtradas
        """
        # 1. Consultar rutas (primero TomTom, fallback HERE)
        routes = self.tomtom.calculate_route(
            start_lat, start_lng, end_lat, end_lng, max_alternatives=2
        )

        if not routes:
            routes = self.here.calculate_route(
                start_lat, start_lng, end_lat, end_lng, alternatives=True
            )

        if not routes:
            logger.warning("No se obtuvieron rutas de ninguna fuente")
            KPIRecorder.record('ERROR_API', 1, metadata={
                'detalle': 'No routes from TomTom or HERE'
            })
            return {"ruta_original": None, "alternativas": []}

        # 2. La primera ruta es la principal
        ruta_original = routes[0]

        # 3. Evaluar alternativas contra RN 2.2.1
        alternativas = []
        for route in routes[1:]:
            tiempo_original = ruta_original['travel_time_s']
            tiempo_alterno = route['travel_time_s']

            ahorro_s = tiempo_original - tiempo_alterno
            ahorro_pct = (ahorro_s / tiempo_original) * 100 if tiempo_original > 0 else 0

            cumple = (ahorro_pct >= self.AHORRO_PORCENTAJE_MIN or
                      ahorro_s >= self.AHORRO_SEGUNDOS_MIN)

            if cumple:
                alt_data = {
                    "tiempo_estimado_s": tiempo_alterno,
                    "distancia_km": round(route['distance_m'] / 1000, 2),
                    "ahorro_s": ahorro_s,
                    "ahorro_porcentaje": round(ahorro_pct, 1),
                    "cumple_regla_15": True,
                    "geometria": route['geometria'],
                }
                alternativas.append(alt_data)

        # 4. Persistir la primera alternativa válida para tracking
        if alternativas:
            mejor_alt = alternativas[0]
            ruta_sugerida = RutaSugerida.objects.create(
                coordenadas_trayecto=json.dumps(mejor_alt.get('geometria', {})),
                tiempo_estimado_original=tiempo_original,
                tiempo_estimado_alterno=mejor_alt['tiempo_estimado_s'],
                ahorro_porcentaje=mejor_alt['ahorro_porcentaje'],
                ahorro_segundos=mejor_alt['ahorro_s'],
                cumple_regla=True,
                distancia_km=mejor_alt['distancia_km'],
                origen_coords=f"{start_lat},{start_lng}",
                destino_coords=f"{end_lat},{end_lng}",
            )
            KPIRecorder.record('RUTA_SUGERIDA', 1, metadata={
                'ruta_id': ruta_sugerida.id,
                'ahorro_pct': mejor_alt['ahorro_porcentaje'],
                'ahorro_s': mejor_alt['ahorro_s'],
            })

        logger.info("RoutePlanner: %d alternativas encontradas para (%s,%s)→(%s,%s)",
                     len(alternativas), start_lat, start_lng, end_lat, end_lng)

        return {
            "ruta_original": {
                "tiempo_estimado_s": ruta_original['travel_time_s'],
                "distancia_km": round(ruta_original['distance_m'] / 1000, 2),
                "geometria": ruta_original['geometria'],
            },
            "alternativas": alternativas,
        }
