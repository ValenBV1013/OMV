from django.urls import path
from . import views

urlpatterns = [
    path('predict/', views.predict_congestion, name='predict'),
    path('heatmap/', views.heatmap_data, name='heatmap'),
]