from django.urls import path
from .views import DashboardInitView

urlpatterns = [
    path('dashboard/init/', DashboardInitView.as_view(), name='dashboard_init'),
]
