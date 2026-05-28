"""
URLs del módulo de Rutas Seguras.
Monta todos los endpoints bajo /api/v1/
"""

from django.urls import path
from rest_framework.routers import SimpleRouter

from .views import ClimaViewSet, EstadisticaViewSet, GeoViewSet, RutaViewSet

router = SimpleRouter(trailing_slash=False)

# Registramos los ViewSets que tienen acciones personalizadas
# (usamos SimpleRouter solo para GeoViewSet que es ReadOnlyModelViewSet)

urlpatterns = [
    # Clima
    path("clima/actual", ClimaViewSet.as_view({"get": "actual"}), name="clima-actual"),
    path("clima/alertas", ClimaViewSet.as_view({"get": "alertas"}), name="clima-alertas"),

    # Rutas
    path("rutas/segura", RutaViewSet.as_view({"post": "segura"}), name="ruta-segura"),
    path("rutas/historial", RutaViewSet.as_view({"get": "historial"}), name="ruta-historial"),

    # Geo
    path("geo/zonas-riesgo", GeoViewSet.as_view({"get": "list"}), name="geo-zonas"),
    path("geo/zonas-riesgo/<int:pk>", GeoViewSet.as_view({"get": "retrieve"}), name="geo-zona-detail"),
    path("geo/resumen", GeoViewSet.as_view({"get": "resumen"}), name="geo-resumen"),
    path("geo/geocodificar", GeoViewSet.as_view({"post": "geocodificar"}), name="geo-geocodificar"),

    # Estadísticas
    path(
        "estadisticas/correlacion",
        EstadisticaViewSet.as_view({"get": "correlacion"}),
        name="estad-correlacion",
    ),
    path(
        "estadisticas/reporte",
        EstadisticaViewSet.as_view({"get": "reporte"}),
        name="estad-reporte",
    ),
]
