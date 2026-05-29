"""
Management command para importar la red vial desde GeoJSON de la Alcaldía de Medellín.

Uso:
    python manage.py import_vias_geojson ruta/al/archivo.geojson

El GeoJSON debe contener features tipo LineString con propiedades:
    OBJECTID, label, name, tipo_via, via_principal, jerarquia_via,
    nombre_comun, comuna, municipio, longitud, Shape_Length

Las coordenadas del GeoJSON están en Magna-Sirgas Colombia (EPSG:9377).
El comando las transforma automáticamente a WGS84 para usar con TomTom/HERE.
"""

import json
import logging

from django.core.management.base import BaseCommand, CommandError
from django.db import transaction

from MovAI.models import SegmentoVial
from MovAI.services.crs_utils import transformar_coords_wgs84

logger = logging.getLogger(__name__)

# Mapeo de tipos de vía del GeoJSON a español legible
TIPO_VIA_NOMBRE = {
    'CL': 'Calle',
    'CR': 'Carrera',
    'AV': 'Avenida',
    'DG': 'Diagonal',
    'TV': 'Transversal',
    'VR': 'Vereda',
    'AK': 'Autopista',
}


class Command(BaseCommand):
    help = 'Importa la red vial de Medellín desde un archivo GeoJSON'

    def add_arguments(self, parser):
        parser.add_argument('geojson_path', type=str, help='Ruta al archivo GeoJSON')
        parser.add_argument(
            '--jerarquia-max',
            type=int,
            default=None,
            help='Solo importar vías con jerarquia_via <= este valor (0=arterias principales)',
        )
        parser.add_argument(
            '--dry-run',
            action='store_true',
            help='Simular importación sin escribir en DB',
        )

    def handle(self, *args, **options):
        geojson_path = options['geojson_path']
        jerarquia_max = options['jerarquia_max']
        dry_run = options['dry_run']

        # ── 1. Cargar GeoJSON ──
        try:
            with open(geojson_path, 'r', encoding='utf-8-sig') as f:
                data = json.load(f)
        except FileNotFoundError:
            raise CommandError(f"Archivo no encontrado: {geojson_path}")
        except json.JSONDecodeError as e:
            raise CommandError(f"Error decodificando GeoJSON: {e}")

        features = data.get('features', [])
        if not features:
            raise CommandError("El GeoJSON no contiene features")

        self.stdout.write(f"📄 Archivo cargado: {len(features)} features totales")

        # ── 2. Filtrar vías ──
        # Solo features tipo LineString (vías)
        features = [f for f in features if f.get('geometry', {}).get('type') == 'LineString']

        if jerarquia_max is not None:
            features = [
                f for f in features
                if f.get('properties', {}).get('jerarquia_via') is not None
                and f['properties']['jerarquia_via'] <= jerarquia_max
            ]
            self.stdout.write(f"🔍 Filtrado por jerarquia <= {jerarquia_max}: {len(features)} features")

        if not features:
            raise CommandError("No hay features para importar después del filtro")

        # ── 3. Procesar e importar ──
        creados = 0
        actualizados = 0
        errores = 0

        for feature in features:
            try:
                props = feature.get('properties', {})
                geometry = feature.get('geometry', {})
                coords = geometry.get('coordinates', [])

                if not coords:
                    continue

                # Transformar a WGS84
                coords_wgs84 = transformar_coords_wgs84(coords)

                # Construir nombre legible
                tipo = props.get('tipo_via', '')
                numero = props.get('via_principal', '')
                apendice = props.get('apendice_via', '')
                nombre_parts = [TIPO_VIA_NOMBRE.get(tipo, tipo), str(numero)]
                if apendice:
                    nombre_parts.append(apendice)
                nombre = ' '.join(nombre_parts).strip()

                # Label del GeoJSON
                label = props.get('label', '')

                objectid = props.get('OBJECTID')
                if not objectid:
                    continue

                    # ── Guardar ──
                jerarquia = props.get('jerarquia_via')
                defaults = {
                    'nombre': nombre or label or f"Vía {objectid}",
                    'label': label or '',
                    'nombre_comun': props.get('nombre_comun') or '',
                    'via_principal': str(props.get('via_principal', '')),
                    'via_generadora': str(props.get('via_generadora', '')),
                    'tipo_via': tipo or '',
                    'jerarquia_via': jerarquia,
                    'comuna': str(props.get('comuna', '')),
                    'municipio': props.get('municipio', 'MEDELLIN'),
                    'longitud_m': float(props.get('Shape_Length', 0)),
                    'velocidad_maxima': _velocidad_por_jerarquia(jerarquia),
                    'geometria': geometry,
                    'geometria_wgs84': {
                        'type': 'LineString',
                        'coordinates': coords_wgs84,
                    } if coords_wgs84 else None,
                    'activo': True,
                }

                if dry_run:
                    self.stdout.write(f"  🔷 [{objectid}] {nombre}")
                    continue

                _, created = SegmentoVial.objects.update_or_create(
                    objectid=objectid,
                    defaults=defaults,
                )

                if created:
                    creados += 1
                else:
                    actualizados += 1

            except Exception as e:
                errores += 1
                self.stderr.write(f"  ❌ Error procesando feature: {e}")
                logger.exception("Error importando feature")

        # ── 4. Resumen ──
        self.stdout.write('\n' + '=' * 50)
        if dry_run:
            self.stdout.write(f"📍 DRY RUN — {len(features)} features listos para importar")
        else:
            self.stdout.write(f"✅ Importación completada:")
            self.stdout.write(f"   Creados:     {creados}")
            self.stdout.write(f"   Actualizados: {actualizados}")
            self.stdout.write(f"   Errores:     {errores}")
        self.stdout.write('=' * 50)

def _velocidad_por_jerarquia(jerarquia):
    """
    Asigna velocidad máxima según jerarquía de la vía.
    A menor jerarquía = vía más importante = mayor velocidad.
    """
    if jerarquia is None:
        return 50
    if jerarquia <= 10:
        return 80   # Autopistas/arterias principales
    elif jerarquia <= 20:
        return 60   # Avenidas principales
    elif jerarquia <= 30:
        return 50   # Calles principales
    elif jerarquia <= 40:
        return 40   # Calles secundarias
    else:
        return 30   # Vías locales
