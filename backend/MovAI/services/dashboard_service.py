"""
Servicio de datos para el Dashboard frontend.

Compila la respuesta del endpoint /api/dashboard/init/:
  - Configuración del dashboard (centro, zoom, intervalo)
  - Estado actual de todos los segmentos viales
  - Últimos N eventos de congestión
  - Resumen de KPIs del día
"""

import logging

from django.db.models import Prefetch

from MovAI.models import SegmentoVial, EventoCongestion, DashboardConfig, FlujoVehicular
from .kpi_recorder import KPIRecorder

logger = logging.getLogger(__name__)


class DashboardService:
    """Compila los datos para inicializar el dashboard."""

    @staticmethod
    def get_init_data():
        """
        Retorna todos los datos necesarios para inicializar el dashboard.

        Returns:
            dict con dashboard_config, segmentos, eventos_recientes, kpi_resumen
        """
        config = DashboardConfig.load()

        # Segmentos con su último flujo
        segmentos = SegmentoVial.objects.filter(activo=True).prefetch_related(
            Prefetch(
                'flujos',
                queryset=FlujoVehicular.objects.order_by('-timestamp')[:1],
                to_attr='ultimo_flujo'
            )
        )

        segmentos_data = []
        for s in segmentos:
            ultimo = s.ultimo_flujo[0] if s.ultimo_flujo else None
            segmentos_data.append({
                "id": s.id,
                "objectid": s.objectid,
                "nombre": s.nombre or s.label or f"Vía {s.id}",
                "label": s.label,
                "nombre_comun": s.nombre_comun,
                "tipo_via": s.tipo_via,
                "jerarquia_via": s.jerarquia_via,
                "nivel_congestion": ultimo.nivel_congestion if ultimo else None,
                "velocidad_promedio": ultimo.velocidad_promedio if ultimo else None,
                "velocidad_libre": ultimo.velocidad_libre if ultimo else None,
                "congestionado": ultimo.congestionado if ultimo else False,
                "ultima_actualizacion": ultimo.timestamp.isoformat() if ultimo else None,
                "geometria": s.geometria_wgs84 or s.geometria,
            })

        # Eventos de congestión activos (respetando el límite de configuración)
        eventos = EventoCongestion.objects.filter(activo=True).select_related(
            'segmento'
        ).order_by('-timestamp')[:config.eventos_limite]

        eventos_data = []
        for e in eventos:
            eventos_data.append({
                "id": e.id,
                "segmento_id": e.segmento_id,
                "segmento_nombre": e.segmento.nombre or e.segmento.label,
                "nivel": e.nivel,
                "velocidad_promedio": e.velocidad_promedio,
                "timestamp": e.timestamp.isoformat(),
                "duracion_s": e.duracion_segundos,
            })

        # KPIs
        kpi_resumen = KPIRecorder.resumen_hoy()

        return {
            "dashboard_config": {
                "centro_mapa": {
                    "lat": config.centro_mapa_lat,
                    "lng": config.centro_mapa_lng,
                },
                "zoom": config.zoom_default,
                "intervalo_refresco_s": config.intervalo_refresco,
            },
            "segmentos": segmentos_data,
            "eventos_recientes": eventos_data,
            "kpi_resumen": kpi_resumen,
        }
