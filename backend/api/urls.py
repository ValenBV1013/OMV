from django.urls import path
from . import views

urlpatterns = [
    path('predict/', views.predict_congestion, name='predict'),
    path('predict_v2/', views.predict_congestion_v2, name='predict_v2'),
    path('heatmap/', views.heatmap_data, name='heatmap'),
    path('validate-token/', views.ValidateTokenView.as_view(), name='validate-token'),
    path('predict_tomtom/', views.predict_tomtom, name='predict_tomtom'),
    path('heatmap_tomtom/', views.heatmap_tomtom, name='heatmap_tomtom'),
    path('incidentes/', views.incidentes_historicos, name='incidentes'),   # ← nueva ruta
]