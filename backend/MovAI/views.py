"""
Vistas DRF para los módulos de Rutas Seguras e Infraestructura.
"""

import logging
from datetime import date, timedelta

from django.db.models import Avg, Count, Q, Sum
from django.utils import timezone as tz
from rest_framework import status, viewsets
from rest_framework.decorators import action
from rest_framework.response import Response

from .models import AlertaClima, EstadisticaAccidente, InfraestructuraFija, Navegacion, SegmentoVial, ZonaRiesgo
from .serializers import (
    AlertaClimaSerializer,
    ClimaActualSerializer,
    CorrelacionClimaAccidenteSerializer,
    EstadisticaAccidenteSerializer,
    NavegacionSerializer,
    RutaSeguraInputSerializer,
    ZonaRiesgoSerializer,
)
from .services.geocode import geocode_direccion
from .services.routing import get_safe_route
from .services.weather import fetch_current_weather

logger = logging.getLogger(__name__)


# ─────────────────────────────────────────────
# MÓDULO CLIMA
# ─────────────────────────────────────────────

class ClimaViewSet(viewsets.ViewSet):
    """Endpoint: /api/v1/clima/"""

    @action(detail=False, methods=["get"])
    def actual(self, request):
        """
        GET /api/v1/clima/actual/
        Devuelve el clima actual en Medellín + alertas activas.
        """
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
        """
        GET /api/v1/clima/alertas/
        Historial de alertas climáticas. Filtro: ?activas=true
        """
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


# ─────────────────────────────────────────────
# MÓDULO RUTAS
# ─────────────────────────────────────────────

class RutaViewSet(viewsets.ViewSet):
    """Endpoint: /api/v1/rutas/"""

    @action(detail=False, methods=["post"])
    def segura(self, request):
        """
        POST /api/v1/rutas/segura/
        Acepta coordenadas o direcciones:

        Con coordenadas:
          {"origen": {"lat": 6.2442, "lng": -75.5812},
           "destino": {"lat": 6.2500, "lng": -75.5900},
           "modo_lluvias": true,
           "id_cliente": null}

        Con direcciones (geocodificación automática vía Nominatim/OSM):
          {"origen": "Cra 80 # 30-15, Medellín",
           "destino": "Cl 10 # 41-20, Medellín",
           "modo_lluvias": true,
           "id_cliente": null}
        """
        serializer = RutaSeguraInputSerializer(data=request.data)
        if not serializer.is_valid():
            return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

        data = serializer.validated_data

        # Resolver direcciones a coordenadas si es necesario
        origen = _resolver_coordenadas(data["origen"], "origen")
        if origen is None:
            return Response(
                {"error": f"No se pudo geocodificar la dirección de origen"},
                status=status.HTTP_400_BAD_REQUEST,
            )
        destino = _resolver_coordenadas(data["destino"], "destino")
        if destino is None:
            return Response(
                {"error": f"No se pudo geocodificar la dirección de destino"},
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
        """
        GET /api/v1/rutas/historial/
        Historial de navegaciones. Filtro: ?cliente=1
        """
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


# ─────────────────────────────────────────────
# MÓDULO GEO / RIESGO
# ─────────────────────────────────────────────

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
        """
        GET /api/v1/geo/resumen/
        Devuelve conteo de zonas por tipo.
        """
        conteo = {}
        for tipo, _ in ZonaRiesgo.TIPO_CHOICES:
            conteo[tipo] = ZonaRiesgo.objects.filter(tipo=tipo).count()

        return Response({
            "total_zonas": ZonaRiesgo.objects.count(),
            "por_tipo": conteo,
        })

    @action(detail=False, methods=["post"])
    def geocodificar(self, request):
        """
        POST /api/v1/geo/geocodificar/
        Convierte una dirección a coordenadas usando Nominatim (OSM).

        Body: {"direccion": "Cra 80 # 30-15, Medellín, Antioquia"}

        Respuesta:
          {"direccion": "...", "lat": 6.2442, "lng": -75.5812}
          o {"error": "..."} con 400 si no se encuentra.
        """
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


# ─────────────────────────────────────────────
# MÓDULO ESTADÍSTICAS
# ─────────────────────────────────────────────

class EstadisticaViewSet(viewsets.ViewSet):
    """Endpoint: /api/v1/estadisticas/"""

    @action(detail=False, methods=["get"])
    def correlacion(self, request):
        """
        GET /api/v1/estadisticas/correlacion/
        Correlación entre precipitación y accidentes.
        Params: ?inicio=2024-01-01&fin=2024-12-31
        """
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

        # Correlación estimada simple
        correlacion = 0.0
        if total_accidentes > 0 and dias_lluvia > 0:
            proporcion_dias_lluvia = dias_lluvia / max(stats.count(), 1)
            proporcion_accidentes_lluvia = accidentes_lluvia / max(total_accidentes, 1)
            correlacion = round(
                (proporcion_accidentes_lluvia - proporcion_dias_lluvia)
                / max(proporcion_dias_lluvia, 0.01),
                4,
            )

        resultado = {
            "fecha_inicio": inicio,
            "fecha_fin": fin,
            "dias_analizados": stats.count(),
            "total_accidentes": total_accidentes,
            "promedio_precipitacion_mm": round(prom_precip, 2),
            "dias_con_lluvia": dias_lluvia,
            "accidentes_en_dias_lluvia": accidentes_lluvia,
            "indice_correlacion": correlacion,
            "interpretacion": _interpretar_correlacion(correlacion),
        }
        return Response(resultado)

    @action(detail=False, methods=["get"])
    def reporte(self, request):
        """
        GET /api/v1/estadisticas/reporte/
        Reporte agregado por mes.
        """
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


def _resolver_coordenadas(valor, nombre_campo: str, input_original: str = "") -> dict | None:
    """
    Si valor es string (dirección), lo geocodifica a {lat, lng} + metadatos.
    Si ya es dict con lat/lng, lo devuelve tal cual.
    Retorna None si no se pudo resolver.
    """
    if isinstance(valor, dict):
        return valor  # Ya son coordenadas
    if isinstance(valor, str):
        resultado = geocode_direccion(valor)
        if resultado is None:
            logger.warning(f"No se pudo geocodificar {nombre_campo}: '{valor}'")
        return resultado
    logger.error(f"Tipo inesperado para {nombre_campo}: {type(valor)}")
    return None


def _interpretar_correlacion(valor: float) -> str:
    """Interpreta el índice de correlación."""
    if valor > 0.3:
        return "Correlación positiva: más lluvia se correlaciona con más accidentes"
    elif valor < -0.3:
        return "Correlación negativa: más lluvia se correlaciona con menos accidentes"
    elif abs(valor) < 0.05:
        return "Sin correlación significativa"
    else:
        return "Correlación leve"


# ═══════════════════════════════════════════════
# MÓDULO: INFRAESTRUCTURA Y TRÁFICO
# ═══════════════════════════════════════════════

from rest_framework.views import APIView


class DashboardInitView(APIView):
    """GET /api/v1/dashboard/init/ — Datos iniciales para el dashboard de infraestructura."""

    def get(self, request):
        infra = InfraestructuraFija.objects.filter(activo=True)
        features = []
        for item in infra:
            features.append({
                "type": "Feature",
                "geometry": {
                    "type": "Point",
                    "coordinates": item.ubicacion if isinstance(item.ubicacion, list) else item.ubicacion.get('coordinates', [0, 0])
                },
                "properties": {
                    "id": item.id,
                    "nombre": item.nombre,
                    "tipo": item.tipo
                }
            })

        return Response({
            "type": "FeatureCollection",
            "features": features
        })
