"""
Vistas DRF para los módulos de Rutas Seguras e Infraestructura/Tráfico.
"""

import logging
from datetime import date, timedelta

from django.db.models import Avg, Sum
from rest_framework import generics, status, views, viewsets
from rest_framework.decorators import action
from rest_framework.pagination import PageNumberPagination
from rest_framework.response import Response

from .models import (
    AlertaClima, EstadisticaAccidente, EventoCongestion, FlujoVehicular,
    InfraestructuraFija, Navegacion, RegistroKPI, RutaSugerida, SegmentoVial,
    ZonaRiesgo,
)
from .serializers import (
    AlertaClimaSerializer, ClimaActualSerializer,
    CorrelacionClimaAccidenteSerializer, EstadisticaAccidenteSerializer,
    EventoCongestionSerializer, NavegacionSerializer,
    RutaAlternativaInputSerializer, RutaSeguraInputSerializer,
    RutaSugeridaSerializer, SegmentoDetailSerializer, SegmentoListSerializer,
    ZonaRiesgoSerializer,
)
from .services.dashboard_service import DashboardService
from .services.geocode import geocode_direccion
from .services.kpi_recorder import KPIRecorder
from .services.route_planner import RoutePlanner
from .services.routing import get_safe_route
from .services.weather import fetch_current_weather

logger = logging.getLogger(__name__)


# ═══════════════════════════════════════════════
# MÓDULO: RUTAS SEGURAS — CLIMA
# ═══════════════════════════════════════════════

class ClimaViewSet(viewsets.ViewSet):
    """Endpoint: /api/v1/clima/"""

    @action(detail=False, methods=["get"])
    def actual(self, request):
        """GET /api/v1/clima/actual/ — Clima actual en Medellín + alertas activas."""
        datos_clima = fetch_current_weather()
        alertas_activas = AlertaClima.objects.filter(activa=True).count()

        if datos_clima is None:
            return Response(
                {"error": "No se pudo obtener datos climáticos. Verifique API key."},
                status=status.HTTP_503_SERVICE_UNAVAILABLE,
            )

        serializer = ClimaActualSerializer(data={
            **datos_clima,
            "alertas_activas": alertas_activas,
        })
        serializer.is_valid()
        return Response(serializer.data)

    @action(detail=False, methods=["get"])
    def alertas(self, request):
        """GET /api/v1/clima/alertas/ — Historial de alertas climáticas."""
        activas = request.query_params.get("activas", "").lower()
        queryset = AlertaClima.objects.all()
        if activas == "true":
            queryset = queryset.filter(activa=True)

        page = int(request.query_params.get("page", 1))
        limit = int(request.query_params.get("limit", 20))
        offset = (page - 1) * limit

        total = queryset.count()
        results = queryset[offset:offset + limit]
        serializer = AlertaClimaSerializer(results, many=True)

        return Response({
            "total": total,
            "page": page,
            "limit": limit,
            "results": serializer.data,
        })


# ═══════════════════════════════════════════════
# MÓDULO: RUTAS SEGURAS — RUTAS
# ═══════════════════════════════════════════════

class RutaViewSet(viewsets.ViewSet):
    """Endpoint: /api/v1/rutas/"""

    @action(detail=False, methods=["post"])
    def segura(self, request):
        """POST /api/v1/rutas/segura/ — Calcula ruta segura."""
        serializer = RutaSeguraInputSerializer(data=request.data)
        if not serializer.is_valid():
            return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

        data = serializer.validated_data

        origen = _resolver_coordenadas(data["origen"], "origen")
        if origen is None:
            return Response(
                {"error": "No se pudo geocodificar la dirección de origen"},
                status=status.HTTP_400_BAD_REQUEST,
            )
        destino = _resolver_coordenadas(data["destino"], "destino")
        if destino is None:
            return Response(
                {"error": "No se pudo geocodificar la dirección de destino"},
                status=status.HTTP_400_BAD_REQUEST,
            )

        try:
            resultado = get_safe_route(
                origen=origen,
                destino=destino,
                modo_lluvias=data.get("modo_lluvias", True),
                id_cliente=data.get("id_cliente"),
                save_history=True,
            )
        except Exception as e:
            logger.exception("Error al calcular ruta segura")
            return Response(
                {"error": f"Error interno al calcular la ruta: {str(e)}"},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR,
            )

        if "error" in resultado:
            return Response(resultado, status=status.HTTP_400_BAD_REQUEST)

        # Incluir las direcciones originales + normalizadas en la respuesta
        resultado["direccion_origen"] = data.get("origen", "")
        resultado["direccion_destino"] = data.get("destino", "")
        resultado["direccion_normalizada_origen"] = origen.get("direccion_normalizada", "")
        resultado["direccion_normalizada_destino"] = destino.get("direccion_normalizada", "")
        resultado["precision_origen"] = origen.get("precision", "unknown")
        resultado["precision_destino"] = destino.get("precision", "unknown")

        return Response(resultado)

    @action(detail=False, methods=["get"])
    def historial(self, request):
        """GET /api/v1/rutas/historial/ — Historial de navegaciones."""
        queryset = Navegacion.objects.all()
        cliente = request.query_params.get("cliente")
        if cliente:
            queryset = queryset.filter(id_cliente=cliente)

        page = int(request.query_params.get("page", 1))
        limit = int(request.query_params.get("limit", 20))
        offset = (page - 1) * limit

        total = queryset.count()
        results = queryset[offset:offset + limit]
        serializer = NavegacionSerializer(results, many=True)

        return Response({
            "total": total,
            "page": page,
            "limit": limit,
            "results": serializer.data,
        })


# ═══════════════════════════════════════════════
# MÓDULO: RUTAS SEGURAS — GEO / RIESGO
# ═══════════════════════════════════════════════

class GeoViewSet(viewsets.ReadOnlyModelViewSet):
    """Endpoint: /api/v1/geo/zonas-riesgo/"""
    queryset = ZonaRiesgo.objects.all()
    serializer_class = ZonaRiesgoSerializer

    def get_queryset(self):
        qs = super().get_queryset()
        tipo = self.request.query_params.get("tipo")
        comuna = self.request.query_params.get("comuna")
        riesgo_min = self.request.query_params.get("riesgo_min")

        if tipo:
            qs = qs.filter(tipo=tipo)
        if comuna:
            qs = qs.filter(comuna__icontains=comuna)
        if riesgo_min:
            qs = qs.filter(nivel_riesgo__gte=int(riesgo_min))

        return qs

    @action(detail=False, methods=["get"])
    def resumen(self, request):
        """GET /api/v1/geo/resumen/ — Conteo de zonas por tipo."""
        conteo = {}
        for tipo, _ in ZonaRiesgo.TIPO_CHOICES:
            conteo[tipo] = ZonaRiesgo.objects.filter(tipo=tipo).count()

        return Response({
            "total_zonas": ZonaRiesgo.objects.count(),
            "por_tipo": conteo,
        })

    @action(detail=False, methods=["post"])
    def geocodificar(self, request):
        """POST /api/v1/geo/geocodificar/ — Dirección a coordenadas vía Nominatim."""
        direccion = request.data.get("direccion", "")
        if not direccion or not direccion.strip():
            return Response(
                {"error": "El campo 'direccion' es requerido"},
                status=status.HTTP_400_BAD_REQUEST,
            )

        coords = geocode_direccion(direccion)
        if coords is None:
            return Response(
                {"error": f"No se pudo geocodificar: '{direccion}'"},
                status=status.HTTP_400_BAD_REQUEST,
            )

        return Response({
            "direccion": direccion.strip(),
            "lat": coords["lat"],
            "lng": coords["lng"],
        })


# ═══════════════════════════════════════════════
# MÓDULO: RUTAS SEGURAS — ESTADÍSTICAS
# ═══════════════════════════════════════════════

class EstadisticaViewSet(viewsets.ViewSet):
    """Endpoint: /api/v1/estadisticas/"""

    @action(detail=False, methods=["get"])
    def correlacion(self, request):
        """GET /api/v1/estadisticas/correlacion/ — Correlación lluvia ↔ accidentes."""
        hoy = date.today()
        inicio = request.query_params.get("inicio", str(hoy - timedelta(days=365)))
        fin = request.query_params.get("fin", str(hoy))

        try:
            data_inicio = date.fromisoformat(inicio)
            data_fin = date.fromisoformat(fin)
        except ValueError:
            return Response(
                {"error": "Formato de fecha inválido. Use YYYY-MM-DD."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        stats = EstadisticaAccidente.objects.filter(
            fecha__gte=data_inicio, fecha__lte=data_fin
        )

        total_accidentes = stats.aggregate(Sum("num_accidentes"))["num_accidentes__sum"] or 0
        prom_precip = stats.aggregate(Avg("nivel_precipitacion"))["nivel_precipitacion__avg"] or 0
        dias_lluvia = stats.filter(nivel_precipitacion__gt=0).count()
        accidentes_lluvia = stats.filter(
            nivel_precipitacion__gt=0
        ).aggregate(Sum("num_accidentes"))["num_accidentes__sum"] or 0

        correlacion = 0.0
        if total_accidentes > 0 and dias_lluvia > 0:
            proporcion_dias_lluvia = dias_lluvia / max(stats.count(), 1)
            proporcion_accidentes_lluvia = accidentes_lluvia / max(total_accidentes, 1)
            correlacion = round(
                (proporcion_accidentes_lluvia - proporcion_dias_lluvia)
                / max(proporcion_dias_lluvia, 0.01),
                4,
            )

        return Response({
            "fecha_inicio": inicio,
            "fecha_fin": fin,
            "dias_analizados": stats.count(),
            "total_accidentes": total_accidentes,
            "promedio_precipitacion_mm": round(prom_precip, 2),
            "dias_con_lluvia": dias_lluvia,
            "accidentes_en_dias_lluvia": accidentes_lluvia,
            "indice_correlacion": correlacion,
            "interpretacion": _interpretar_correlacion(correlacion),
        })

    @action(detail=False, methods=["get"])
    def reporte(self, request):
        """GET /api/v1/estadisticas/reporte/ — Reporte agregado."""
        stats = EstadisticaAccidente.objects.all().order_by("-fecha")[:365]
        if not stats.exists():
            return Response({"mensaje": "No hay datos estadísticos cargados."})

        total_accidentes = stats.aggregate(Sum("num_accidentes"))["num_accidentes__sum"] or 0

        return Response({
            "total_registros": stats.count(),
            "total_accidentes": total_accidentes,
            "promedio_accidentes_por_dia": round(total_accidentes / max(stats.count(), 1), 2),
            "fecha_ultimo_registro": stats.first().fecha,
            "fecha_primer_registro": stats.last().fecha,
        })


# ═══════════════════════════════════════════════
# MÓDULO: INFRAESTRUCTURA Y TRÁFICO
# ═══════════════════════════════════════════════

class DashboardInitView(views.APIView):
    """
    GET /api/v1/dashboard/init/
    Retorna datos iniciales del dashboard de infraestructura.
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


class SegmentoListView(generics.ListAPIView):
    """GET /api/v1/segments/ — Lista segmentos viales con filtros."""
    serializer_class = SegmentoListSerializer

    def get_queryset(self):
        qs = SegmentoVial.objects.filter(activo=True)

        congestion = self.request.query_params.get('congestion')
        if congestion:
            segmentos_ids = FlujoVehicular.objects.filter(
                nivel_congestion=congestion.upper()
            ).values_list('segmento_id', flat=True).distinct()
            qs = qs.filter(id__in=segmentos_ids)

        jerarquia_lte = self.request.query_params.get('jerarquia_lte')
        if jerarquia_lte:
            qs = qs.filter(jerarquia_via__lte=int(jerarquia_lte))

        return qs.prefetch_related('flujos')


class SegmentoDetailView(generics.RetrieveAPIView):
    """GET /api/v1/segments/{id}/ — Detalle de segmento con historial."""
    queryset = SegmentoVial.objects.filter(activo=True)
    serializer_class = SegmentoDetailSerializer


class EventoPagination(PageNumberPagination):
    page_size = 20
    page_size_query_param = 'limit'
    max_page_size = 100


class EventoListView(generics.ListAPIView):
    """GET /api/v1/congestion-events/ — Lista eventos de congestión."""
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


class AlternativeRouteView(views.APIView):
    """
    GET /api/v1/routes/alternative/ — Ruta evitando congestión.
    Aplica RN 2.2.1: ahorro >= 15% o >= 5 min.
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
    """POST /api/v1/routes/{id}/accept/ — Aceptar ruta sugerida."""
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


class KPISummaryView(views.APIView):
    """GET /api/v1/kpis/summary/ — Resumen de KPIs operativos del día."""
    def get(self, request):
        return Response(KPIRecorder.resumen_hoy())


# ═══════════════════════════════════════════════
# Funciones auxiliares
# ═══════════════════════════════════════════════

def _resolver_coordenadas(valor, nombre_campo: str, input_original: str = "") -> dict | None:
    """
    Si valor es string (dirección), lo geocodifica a {lat, lng} + metadatos.
    Si ya es dict con lat/lng, lo devuelve tal cual.
    Retorna None si no se pudo resolver.
    """
    if isinstance(valor, dict):
        return valor
    if isinstance(valor, str):
        resultado = geocode_direccion(valor)
        if resultado is None:
            logger.warning("No se pudo geocodificar %s: '%s'", nombre_campo, valor)
        return resultado
    logger.error("Tipo inesperado para %s: %s", nombre_campo, type(valor))
    return None


def _interpretar_correlacion(valor: float) -> str:
    if valor > 0.3:
        return "Correlación positiva: más lluvia se correlaciona con más accidentes"
    elif valor < -0.3:
        return "Correlación negativa: más lluvia se correlaciona con menos accidentes"
    elif abs(valor) < 0.05:
        return "Sin correlación significativa"
    else:
        return "Correlación leve"
