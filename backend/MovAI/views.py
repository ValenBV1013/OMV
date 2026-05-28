"""
Vistas DRF para el módulo de detección de congestión.

Endpoints:
  GET  /api/dashboard/init/        → Inicialización del dashboard
  GET  /api/segments/              → Lista de segmentos viales
  GET  /api/segments/{id}/         → Detalle de segmento con historial
  GET  /api/congestion-events/     → Eventos de congestión
  GET  /api/routes/alternative/    → Rutas alternativas (con RN 2.2.1)
  POST /api/routes/{id}/accept/    → Aceptar ruta sugerida
  GET  /api/kpis/summary/          → Resumen de KPIs operativos
"""

import logging

from rest_framework import generics, views, status
from rest_framework.response import Response
from rest_framework.pagination import PageNumberPagination

from .models import (
    SegmentoVial, FlujoVehicular, EventoCongestion,
    RutaSugerida, RegistroKPI,
)
from .serializers import (
    SegmentoListSerializer, SegmentoDetailSerializer,
    EventoCongestionSerializer, RutaSugeridaSerializer,
    RutaAlternativaInputSerializer,
)
from .services.dashboard_service import DashboardService
from .services.route_planner import RoutePlanner
from .services.kpi_recorder import KPIRecorder

logger = logging.getLogger(__name__)


# ──────────────────────────────────────────────
#  Dashboard
# ──────────────────────────────────────────────

class DashboardInitView(views.APIView):
    """
    GET /api/dashboard/init/

    Retorna todo lo necesario para inicializar el dashboard:
      - Configuración del mapa (centro, zoom, intervalo)
      - Estado actual de todos los segmentos
      - Eventos de congestión activos
      - Resumen de KPIs del día
    """
    def get(self, request):
        try:
            data = DashboardService.get_init_data()
            return Response(data)
        except Exception as e:
            logger.error("Error en DashboardInitView: %s", e, exc_info=True)
            return Response(
                {"error": "Error al inicializar el dashboard"},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR,
            )


# ──────────────────────────────────────────────
#  Segmentos Viales
# ──────────────────────────────────────────────

class SegmentoListView(generics.ListAPIView):
    """
    GET /api/segments/
    GET /api/segments/?congestion=ALTO
    GET /api/segments/?jerarquia_lte=30

    Lista segmentos viales con opción de filtrado por congestión o jerarquía.
    """
    serializer_class = SegmentoListSerializer

    def get_queryset(self):
        qs = SegmentoVial.objects.filter(activo=True)

        congestion = self.request.query_params.get('congestion')
        if congestion:
            # Filtrar segmentos cuyo último flujo tenga ese nivel de congestión
            segmentos_ids = FlujoVehicular.objects.filter(
                nivel_congestion=congestion.upper()
            ).values_list('segmento_id', flat=True).distinct()
            qs = qs.filter(id__in=segmentos_ids)

        jerarquia_lte = self.request.query_params.get('jerarquia_lte')
        if jerarquia_lte:
            qs = qs.filter(jerarquia_via__lte=int(jerarquia_lte))

        return qs.select_related().prefetch_related('flujos')


class SegmentoDetailView(generics.RetrieveAPIView):
    """
    GET /api/segments/{id}/

    Retorna detalle completo del segmento con historial de flujos.
    """
    queryset = SegmentoVial.objects.filter(activo=True)
    serializer_class = SegmentoDetailSerializer


# ──────────────────────────────────────────────
#  Eventos de Congestión
# ──────────────────────────────────────────────

class EventoPagination(PageNumberPagination):
    page_size = 20
    page_size_query_param = 'limit'
    max_page_size = 100


class EventoListView(generics.ListAPIView):
    """
    GET /api/congestion-events/
    GET /api/congestion-events/?active=true
    GET /api/congestion-events/?limit=50

    Lista eventos de congestión.
    """
    serializer_class = EventoCongestionSerializer
    pagination_class = EventoPagination

    def get_queryset(self):
        qs = EventoCongestion.objects.select_related('segmento')

        active = self.request.query_params.get('active')
        if active and active.lower() == 'true':
            qs = qs.filter(activo=True)
        elif active and active.lower() == 'false':
            qs = qs.filter(activo=False)

        nivel = self.request.query_params.get('nivel')
        if nivel:
            qs = qs.filter(nivel=nivel.upper())

        return qs.order_by('-timestamp')


# ──────────────────────────────────────────────
#  Rutas Alternativas
# ──────────────────────────────────────────────

class AlternativeRouteView(views.APIView):
    """
    GET /api/routes/alternative/?start_lat=6.24&start_lng=-75.56&end_lat=6.20&end_lng=-75.58

    Calcula ruta alternativa evitando congestión.
    Aplica RN 2.2.1: solo retorna alternativas con ahorro >= 15% o >= 5 min.
    """
    def get(self, request):
        serializer = RutaAlternativaInputSerializer(data=request.query_params)
        if not serializer.is_valid():
            return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

        params = serializer.validated_data
        planner = RoutePlanner()

        try:
            result = planner.find_alternative(
                start_lat=params['start_lat'],
                start_lng=params['start_lng'],
                end_lat=params['end_lat'],
                end_lng=params['end_lng'],
            )
            return Response(result)
        except Exception as e:
            logger.error("Error en AlternativeRouteView: %s", e, exc_info=True)
            return Response(
                {"error": "Error al calcular ruta alternativa"},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR,
            )


class AcceptRouteView(views.APIView):
    """
    POST /api/routes/{id}/accept/
    Body: { "aceptada": true }

    Marca una ruta sugerida como aceptada por el usuario.
    """
    def post(self, request, ruta_id):
        try:
            ruta = RutaSugerida.objects.get(id=ruta_id)
        except RutaSugerida.DoesNotExist:
            return Response(
                {"error": "Ruta no encontrada"},
                status=status.HTTP_404_NOT_FOUND,
            )

        aceptada = request.data.get('aceptada', True)
        ruta.fue_aceptada = bool(aceptada)

        if ruta.fue_aceptada:
            from django.utils import timezone
            ruta.aceptada_en = timezone.now()
            KPIRecorder.record('RUTA_ACEPTADA', 1, metadata={
                'ruta_id': ruta.id,
                'ahorro_pct': ruta.ahorro_porcentaje,
            })

        ruta.save(update_fields=['fue_aceptada', 'aceptada_en'])
        return Response({"status": "ok", "ruta_id": ruta.id})


# ──────────────────────────────────────────────
#  KPIs
# ──────────────────────────────────────────────

class KPISummaryView(views.APIView):
    """
    GET /api/kpis/summary/

    Retorna resumen de KPIs operativos del día actual.
    """
    def get(self, request):
        return Response(KPIRecorder.resumen_hoy())
