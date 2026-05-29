from django.apps import AppConfig


class MovaiConfig(AppConfig):
    name = 'MovAI'
    verbose_name = "Movilidad Vial - Rutas Seguras"

    def ready(self):
        """
        Inicializa el scheduler de APScheduler al arrancar Django.
        Solo en el servidor (no en migrate, shell, etc.)
        """
        import os
        if os.environ.get("RUN_MAIN") or os.environ.get("DJANGO_AUTORELOAD"):
            from .tasks import start_scheduler
            start_scheduler()
