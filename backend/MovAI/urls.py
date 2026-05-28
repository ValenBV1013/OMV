from django.urls import path

from .views import (
    DashboardInitView,
    SegmentoListView,
    SegmentoDetailView,
    EventoListView,
    AlternativeRouteView,
    AcceptRouteView,
    KPISummaryView,
)

urlpatterns = [
    # Dashboard
    path('dashboard/init/', DashboardInitView.as_view(), name='dashboard-init'),

    # Segmentos viales
    path('segments/', SegmentoListView.as_view(), name='segment-list'),
    path('segments/<int:pk>/', SegmentoDetailView.as_view(), name='segment-detail'),

    # Eventos de congestión
    path('congestion-events/', EventoListView.as_view(), name='event-list'),

    # Rutas alternativas
    path('routes/alternative/', AlternativeRouteView.as_view(), name='route-alternative'),
    path('routes/<int:ruta_id>/accept/', AcceptRouteView.as_view(), name='route-accept'),

    # KPIs
    path('kpis/summary/', KPISummaryView.as_view(), name='kpi-summary'),
]
