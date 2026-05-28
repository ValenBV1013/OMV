"""
URL configuration for config project.

API base: /api/
Admin:    /admin/
"""
from django.contrib import admin
from django.urls import path, include

urlpatterns = [
    path('admin/', admin.site.urls),
    path('api/', include('MovAI.urls')),
]
