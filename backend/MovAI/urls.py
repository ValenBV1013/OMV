from django.contrib import admin
from django.urls import path, include  # ← Agrega 'include' aquí
from .views import DashboardInitView

urlpatterns = [
    path('admin/', admin.site.urls),
    path('', DashboardInitView.as_view(), name='dashboard'),
    path('api/', include('api.urls')),  # ← Esto ahora funcionará
]