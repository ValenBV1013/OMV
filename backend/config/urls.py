"""
URL configuration for config project.

API base: /api/v1/
Admin:    /admin/
"""
from django.contrib import admin
from django.urls import include, path

urlpatterns = [
    path('admin/', admin.site.urls),
    path('api/v1/', include('MovAI.urls')),
]
