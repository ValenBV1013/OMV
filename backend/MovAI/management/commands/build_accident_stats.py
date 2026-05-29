"""
Management command para construir estadísticas de accidentalidad
correlacionadas con clima a partir de los accidentes cargados.

Uso:
    python manage.py build_accident_stats
    python manage.py build_accident_stats --batch 50
"""

from django.core.management.base import BaseCommand

from ...services.accident_stats import build_accident_statistics


class Command(BaseCommand):
    help = (
        "Construye estadísticas de accidentalidad correlacionadas con clima. "
        "Agrupa los accidentes cargados por fecha, consulta precipitación "
        "histórica en Open-Meteo, y popula EstadisticaAccidente."
    )

    def add_arguments(self, parser):
        parser.add_argument(
            "--batch",
            type=int,
            default=100,
            help="Fechas por consulta a Open-Meteo (default: 100, max: 365)",
        )

    def handle(self, *args, **options):
        self.stdout.write("Construyendo estadísticas de accidentalidad...")
        self.stdout.write(f"  Coordenadas Medellín: 6.2442, -75.5812")
        self.stdout.write(f"  API: Open-Meteo Archive (gratis, sin API key)")
        self.stdout.write(f"  Batch: {options['batch']} fechas por consulta")
        self.stdout.write("")

        resultado = build_accident_statistics(batch_size=options["batch"])

        if "error" in resultado:
            self.stderr.write(self.style.ERROR(f"Error: {resultado['error']}"))
            return

        self.stdout.write(self.style.SUCCESS(
            f"  OK - Dias procesados: {resultado['dias_procesados']}"
        ))
        self.stdout.write(self.style.SUCCESS(
            f"  OK - Accidentes procesados: {resultado['accidentes_procesados']}"
        ))

        if resultado.get("errores"):
            self.stderr.write(self.style.WARNING(
                f"  ATENCION - Errores: {resultado['errores']}"
            ))
        else:
            self.stdout.write(self.style.SUCCESS("  OK - Sin errores"))

        self.stdout.write("")
        self.stdout.write("Listo. Consulta los datos en:")
        self.stdout.write("  GET /api/v1/estadisticas/correlacion")
        self.stdout.write("  GET /api/v1/estadisticas/reporte")
