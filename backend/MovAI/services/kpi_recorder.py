"""
Registro de KPIs operativos del sistema.

Métricas registradas:
  - ALERTA_ENVIADA:      cada alerta de congestión emitida
  - RUTA_SUGERIDA:       cada ruta alternativa sugerida
  - RUTA_ACEPTADA:       cada ruta aceptada por el usuario
  - TIEMPO_RESPUESTA_MS: tiempo del ciclo completo de actualización
  - ERROR_API:           cada error de API externa
  - CICLO_COMPLETADO:    cada ciclo de actualización exitoso
"""

import logging
from datetime import timedelta

from django.db.models import Count, Avg
from django.utils import timezone

from MovAI.models import RegistroKPI

logger = logging.getLogger(__name__)


class KPIRecorder:
    """Registro y consulta de KPIs operativos."""

    @staticmethod
    def record(tipo, valor, metadata=None):
        """
        Registra un KPI.

        Args:
            tipo: str, uno de RegistroKPI.TIPO_CHOICES
            valor: float, valor del KPI
            metadata: dict opcional con datos adicionales
        """
        try:
            RegistroKPI.objects.create(
                tipo=tipo,
                valor=float(valor),
                metadata=metadata or {},
            )
        except Exception as e:
            logger.error("Error registrando KPI %s: %s", tipo, e)

    @staticmethod
    def resumen_hoy():
        """Retorna KPIs resumidos del día actual."""
        hoy = timezone.now().replace(hour=0, minute=0, second=0, microsecond=0)

        # Conteos por tipo
        conteos = (
            RegistroKPI.objects
            .filter(timestamp__gte=hoy)
            .values('tipo')
            .annotate(total=Count('id'))
        )

        # Tiempo de respuesta promedio (últimas 24h)
        hace_24h = timezone.now() - timedelta(hours=24)
        tiempo_respuesta = (
            RegistroKPI.objects
            .filter(tipo='TIEMPO_RESPUESTA_MS', timestamp__gte=hace_24h)
            .aggregate(promedio=Avg('valor'))
        )

        # Errores de API hoy
        errores_api = next(
            (c['total'] for c in conteos if c['tipo'] == 'ERROR_API'),
            0
        )

        resumen = {
            "alertas_enviadas_hoy": next(
                (c['total'] for c in conteos if c['tipo'] == 'ALERTA_ENVIADA'), 0
            ),
            "rutas_sugeridas_hoy": next(
                (c['total'] for c in conteos if c['tipo'] == 'RUTA_SUGERIDA'), 0
            ),
            "rutas_aceptadas_hoy": next(
                (c['total'] for c in conteos if c['tipo'] == 'RUTA_ACEPTADA'), 0
            ),
            "tiempo_respuesta_promedio_ms": round(tiempo_respuesta['promedio'], 0)
                if tiempo_respuesta['promedio'] else None,
            "errores_api_hoy": errores_api,
            "ciclos_completados_hoy": next(
                (c['total'] for c in conteos if c['tipo'] == 'CICLO_COMPLETADO'), 0
            ),
        }

        # Tasa de aceptación
        sugeridas = resumen["rutas_sugeridas_hoy"]
        aceptadas = resumen["rutas_aceptadas_hoy"]
        resumen["tasa_aceptacion_pct"] = (
            round((aceptadas / sugeridas) * 100, 1)
            if sugeridas > 0 else 0
        )

        return resumen
