"""
Management command para cargar los 3 GeoJSON de la Alcaldía de Medellín.

Uso:
    python manage.py load_geodata
    python manage.py load_geodata --tipo sensores
    python manage.py load_geodata --tipo incidentes
    python manage.py load_geodata --tipo inundaciones
"""

from django.core.management.base import BaseCommand

from ...services.geodata_loader import (
    load_all_geodata,
    load_incidentes_transito,
    load_sensores_nivel,
    load_zonas_inundacion,
)


class Command(BaseCommand):
    help = "Carga los GeoJSON de la Alcaldía de Medellín a la base de datos"

    def add_arguments(self, parser):
        parser.add_argument(
            "--tipo",
            type=str,
            choices=["sensores", "incidentes", "inundaciones", "todos"],
            default="todos",
            help="Tipo de datos a cargar (default: todos)",
        )

    def handle(self, *args, **options):
        tipo = options["tipo"]

        if tipo == "todos":
            self.stdout.write("Cargando TODOS los GeoJSON...")
            resultados = load_all_geodata()
        elif tipo == "sensores":
            resultados = {"sensores": load_sensores_nivel()}
        elif tipo == "incidentes":
            resultados = {"incidentes": load_incidentes_transito()}
        elif tipo == "inundaciones":
            resultados = {"inundaciones": load_zonas_inundacion()}

        for nombre, res in resultados.items():
            if "error" in res:
                self.stdout.write(self.style.ERROR(f"  [ERROR] {nombre}: {res['error']}"))
            else:
                total = res.get("total", 0)
                creados = res.get("creados", 0)
                self.stdout.write(
                    self.style.SUCCESS(f"  [OK] {nombre}: {total} features, {creados} nuevos")
                )

        from django.apps import apps
        total_zonas = apps.get_model("MovAI", "ZonaRiesgo").objects.count()
        self.stdout.write(self.style.SUCCESS(f"\nTotal en DB: {total_zonas} zonas de riesgo"))
