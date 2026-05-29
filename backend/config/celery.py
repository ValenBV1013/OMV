"""
Configuración de Celery para el proyecto OMV.

Define la aplicación Celery y la configuración del Beat schedule.
"""
import os

from celery import Celery

os.environ.setdefault("DJANGO_SETTINGS_MODULE", "config.settings")

app = Celery("omv")

# Namespace CELERY_ en settings.py
app.config_from_object("django.conf:settings", namespace="CELERY")

# Auto-descubrir tareas en todas las apps instaladas
app.autodiscover_tasks()


@app.task(bind=True, ignore_result=True)
def debug_task(self):
    """Tarea de depuración básica."""
    print(f"Celery debug: {self.request!r}")
