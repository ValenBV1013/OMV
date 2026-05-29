"""
URLs del módulo de Rutas Seguras e Infraestructura/Tráfico.
Monta todos los endpoints bajo /api/v1/
"""

from django.urls import path

from .views import (
    AcceptRouteView, AlternativeRouteView, ClimaViewSet,
    DashboardInitView, EstadisticaViewSet, EventoListView,
    GeoViewSet, KPISummaryView, RutaViewSet, SegmentoDetailView,
    SegmentoListView,
)

urlpatterns = [
    # ─────────────────────────────────────────
    # Rutas Seguras — Clima
    # ─────────────────────────────────────────
    path("clima/actual/", ClimaViewSet.as_view({"get": "actual"}), name="clima-actual"),
    path("clima/alertas/", ClimaViewSet.as_view({"get": "alertas"}), name="clima-alertas"),

    # ─────────────────────────────────────────
    # Rutas Seguras — Rutas
    # ─────────────────────────────────────────
    path("rutas/segura/", RutaViewSet.as_view({"post": "segura"}), name="ruta-segura"),
    path("rutas/historial/", RutaViewSet.as_view({"get": "historial"}), name="ruta-historial"),

    # ─────────────────────────────────────────
    # Rutas Seguras — Geo / Riesgo
    # ─────────────────────────────────────────
    path("geo/zonas-riesgo/", GeoViewSet.as_view({"get": "list"}), name="geo-zonas"),
    path("geo/zonas-riesgo/<int:pk>/", GeoViewSet.as_view({"get": "retrieve"}), name="geo-zona-detail"),
    path("geo/resumen/", GeoViewSet.as_view({"get": "resumen"}), name="geo-resumen"),
    path("geo/geocodificar/", GeoViewSet.as_view({"post": "geocodificar"}), name="geo-geocodificar"),

    # ─────────────────────────────────────────
    # Rutas Seguras — Estadísticas
    # ─────────────────────────────────────────
    path("estadisticas/correlacion/", EstadisticaViewSet.as_view({"get": "correlacion"}), name="estad-correlacion"),
    path("estadisticas/reporte/", EstadisticaViewSet.as_view({"get": "reporte"}), name="estad-reporte"),

    # ─────────────────────────────────────────
    # Infraestructura — Dashboard
    # ─────────────────────────────────────────
    path('dashboard/init/', DashboardInitView.as_view(), name='dashboard-init'),

    # ─────────────────────────────────────────
    # Infraestructura — Segmentos viales
    # ─────────────────────────────────────────
    path('segments/', SegmentoListView.as_view(), name='segment-list'),
    path('segments/<int:pk>/', SegmentoDetailView.as_view(), name='segment-detail'),

    # ─────────────────────────────────────────
    # Infraestructura — Eventos de congestión
    # ─────────────────────────────────────────
    path('congestion-events/', EventoListView.as_view(), name='event-list'),

    # ─────────────────────────────────────────
    # Infraestructura — Rutas alternativas
    # ─────────────────────────────────────────
    path('routes/alternative/', AlternativeRouteView.as_view(), name='route-alternative'),
    path('routes/<int:ruta_id>/accept/', AcceptRouteView.as_view(), name='route-accept'),

    # ─────────────────────────────────────────
    # Infraestructura — KPIs
    # ─────────────────────────────────────────
    path('kpis/summary/', KPISummaryView.as_view(), name='kpi-summary'),
]
