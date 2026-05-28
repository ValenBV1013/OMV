"""
Servicio de carga y transformación de datos GeoJSON de la Alcaldía de Medellín.

Los GeoJSON de Medellín vienen en EPSG:9377 (MAGNA-SIRGAS / Medellín).
Este servicio los transforma a WGS84 (EPSG:4326) para usarlos con
OSRM, Google Maps y el modelo ZonaRiesgo.
"""

import json
import os
from datetime import datetime, timezone

from django.conf import settings
from django.utils import timezone as tz

from pyproj import Transformer

from ..models import ZonaRiesgo

# Transformador de EPSG:9377 (MAGNA-SIRGAS / Medellín) a WGS84
# EPSG:9377 es una proyección local en metros para Medellín
# Valores típicos: X ~ 4,700,000 — 4,720,000 / Y ~ 2,240,000 — 2,260,000
_transformer = Transformer.from_crs("EPSG:9377", "EPSG:4326", always_xy=True)

GEODATA_DIR = os.path.join(settings.BASE_DIR, "geodata")


def _reproject_coords(coords, geom_type):
    """
    Transforma coordenadas de EPSG:9377 (x, y) a WGS84 (lng, lat).
    Soporta Point, Polygon y MultiPolygon.
    """
    if geom_type == "Point":
        lng, lat = _transformer.transform(coords[0], coords[1])
        return [lng, lat]
    elif geom_type == "Polygon":
        return [
            [_transformer.transform(x, y) for x, y in ring]
            for ring in coords
        ]
    elif geom_type == "MultiPolygon":
        return [
            [
                [_transformer.transform(x, y) for x, y in ring]
                for ring in polygon
            ]
            for polygon in coords
        ]
    return coords


def _reproject_feature(feature):
    """Reproyecta un feature GeoJSON individual."""
    geom = feature["geometry"]
    new_coords = _reproject_coords(geom["coordinates"], geom["type"])
    feature["geometry"]["coordinates"] = new_coords
    return feature


def load_sensores_nivel(filepath=None):
    """
    Carga sensores de nivel de quebradas (EPSG:9377 → WGS84).
    archivo: sensores_de_nivel.geojson
    """
    if filepath is None:
        filepath = os.path.join(GEODATA_DIR, "sensores_de_nivel.geojson")

    with open(filepath, "r", encoding="utf-8") as f:
        data = json.load(f)

    count = 0
    for feature in data["features"]:
        feature = _reproject_feature(feature)
        props = feature.get("properties", {})

        obj, created = ZonaRiesgo.objects.update_or_create(
            tipo="sensor_nivel",
            nombre=(props.get("nombre_siata") or "").strip(),
            defaults={
                "geometria": feature["geometry"],
                "nivel_riesgo": 3,
                "fuente": "alcaldia_medellin",
                "descripcion": f"Sensor en {(props.get('nombre_barrio_vereda') or '')}",
                "subcuenca": (props.get("subcuenca") or "").strip(),
                "comuna": (props.get("nombre_comuna_corr") or "").strip(),
                "metadata_original": props,
            },
        )
        if created:
            count += 1

    return {"total": len(data["features"]), "creados": count}


def load_incidentes_transito(filepath=None):
    """
    Carga puntos de accidentes de tránsito (bulk_create para ~30MB de datos).
    archivo: total_incidentes_transito.geojson

    Este archivo YA tiene latitud/longitud en las propiedades,
    pero la geometría está en EPSG:9377. Usamos lat/lon directo.

    Usa bulk_create en batches de 500 para ser eficiente con SQLite3.
    """
    if filepath is None:
        filepath = os.path.join(GEODATA_DIR, "total_incidentes_transito.geojson")

    with open(filepath, "r", encoding="utf-8") as f:
        data = json.load(f)

    # Limpiar datos previos de accidentalidad (idempotencia)
    ZonaRiesgo.objects.filter(tipo="accidentalidad").delete()

    batch_size = 500
    total_features = len(data["features"])
    creados = 0
    batch = []

    for feature in data["features"]:
        props = feature.get("properties", {})

        # Usamos lat/long de las propiedades (ya están en WGS84)
        lat = props.get("latitud")
        lng = props.get("longitud")
        if lat is None or lng is None:
            continue

        wgs84_geom = {"type": "Point", "coordinates": [lng, lat]}

        # Parsear fecha
        fecha_ts = props.get("fecha")
        fecha_dt = None
        if fecha_ts:
            try:
                fecha_dt = datetime.fromtimestamp(fecha_ts / 1000, tz=timezone.utc)
            except (OSError, ValueError):
                pass

        nombre = f"{props.get('clase', 'Accidente')} en {props.get('direccion', '')}"
        gravedad_val = props.get("gravedad")

        batch.append(ZonaRiesgo(
            tipo="accidentalidad",
            nombre=nombre.strip(),
            geometria=wgs84_geom,
            nivel_riesgo=_gravedad_to_riesgo(gravedad_val),
            fuente="alcaldia_medellin",
            descripcion=f"{props.get('clase', '')} - {gravedad_val or ''}",
            comuna=(props.get("comuna") or "").strip(),
            barrio=(props.get("barrio") or "").strip(),
            gravedad=(gravedad_val or "").strip(),
            fecha_evento=fecha_dt,
            metadata_original=props,
        ))

        if len(batch) >= batch_size:
            ZonaRiesgo.objects.bulk_create(batch, ignore_conflicts=True)
            creados += len(batch)
            batch = []

    # Último batch
    if batch:
        ZonaRiesgo.objects.bulk_create(batch, ignore_conflicts=True)
        creados += len(batch)

    return {"total": total_features, "creados": creados}


def _gravedad_to_riesgo(gravedad):
    """Convierte gravedad del accidente a nivel de riesgo 1-5."""
    if not gravedad or not isinstance(gravedad, str):
        return 2
    mapping = {
        "FALLECIDO": 5,
        "HERIDO": 4,
        "SOLO DAÑOS": 2,
    }
    return mapping.get(gravedad.strip().upper(), 2)


def load_zonas_inundacion(filepath=None):
    """
    Carga zonas de riesgo de inundación (polígonos EPSG:9377 → WGS84).
    archivo: pot48_2014_riesgos_inunda.geojson
    """
    if filepath is None:
        filepath = os.path.join(GEODATA_DIR, "pot48_2014_riesgos_inunda.geojson")

    with open(filepath, "r", encoding="utf-8") as f:
        data = json.load(f)

    count = 0
    for feature in data["features"]:
        feature = _reproject_feature(feature)
        props = feature.get("properties", {})

        # Mapear nivel de riesgo según el campo "riesgo"
        riesgo_text = (props.get("riesgo") or "").lower()
        if "condiciones" in riesgo_text:
            nivel = 4
        elif "alto" in riesgo_text:
            nivel = 5
        elif "medio" in riesgo_text:
            nivel = 3
        else:
            nivel = 2

        # Parsear fecha de adopción
        fecha_adopcion = None
        if props.get("fecha_adopcion"):
            try:
                fecha_adopcion = datetime.fromtimestamp(
                    props["fecha_adopcion"] / 1000, tz=timezone.utc
                )
            except (OSError, ValueError):
                pass

        obj, created = ZonaRiesgo.objects.update_or_create(
            tipo="inundacion",
            nombre=(props.get("nombre") or "").strip(),
            defaults={
                "geometria": feature["geometry"],
                "nivel_riesgo": nivel,
                "fuente": "alcaldia_medellin",
                "descripcion": (props.get("descripcion") or "").strip(),
                "fecha_evento": fecha_adopcion,
                "metadata_original": props,
            },
        )
        if created:
            count += 1

    return {"total": len(data["features"]), "creados": count}


def load_all_geodata():
    """Carga los 3 archivos GeoJSON a la base de datos."""
    resultados = {}
    try:
        resultados["sensores"] = load_sensores_nivel()
    except Exception as e:
        resultados["sensores"] = {"error": str(e)}

    try:
        resultados["incidentes"] = load_incidentes_transito()
    except Exception as e:
        resultados["incidentes"] = {"error": str(e)}

    try:
        resultados["inundaciones"] = load_zonas_inundacion()
    except Exception as e:
        resultados["inundaciones"] = {"error": str(e)}

    return resultados
