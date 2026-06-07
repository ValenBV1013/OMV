from django.urls import path
from . import views
from .views import ValidateTokenView

urlpatterns = [
    path('predict/', views.predict_congestion, name='predict'),
    path('heatmap/', views.heatmap_data, name='heatmap'),
    path('validate-token/', ValidateTokenView.as_view(), name='validate_token'),

]