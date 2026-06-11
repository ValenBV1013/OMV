from django.urls import path
from . import views
from .views import ValidateTokenView

urlpatterns = [
    path('predict/', views.predict_congestion, name='predict'),           # versión original
    path('predict_v2/', views.predict_congestion_v2, name='predict_v2'),
    path('heatmap/', views.heatmap_data, name='heatmap'),
    path('validate-token/', ValidateTokenView.as_view(), name='validate_token'),

]