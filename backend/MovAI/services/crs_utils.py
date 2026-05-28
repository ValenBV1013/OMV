"""
Utilidades de transformación de coordenadas.

El GeoJSON de la Alcaldía de Medellín usa Magna-Sirgas Colombia
proyectado (EPSG:9377 / origen Bogotá). Las APIs de TomTom y HERE
trabajan con WGS84 (EPSG:4326) en formato lat/lng.

Esta utilidad transforma entre ambos sistemas usando pyproj.
"""

from django.conf import settings


def transformar_coords_wgs84(coords_proyectadas):
    """
    Transforma coordenadas de EPSG:9377 (Magna-Sirgas Colombia proyectado)
    a EPSG:4326 (WGS84 lat/lng).

    Args:
        coords_proyectadas: lista de pares [x, y] en el CRS origen

    Returns:
        lista de pares [lng, lat] en WGS84, o None si pyproj no está disponible
    """
    try:
        import pyproj
        crs_origen = pyproj.CRS.from_epsg(9377)  # Magna-Sirgas Colombia
        crs_destino = pyproj.CRS.from_epsg(4326)  # WGS84
        transformer = pyproj.Transformer.from_crs(crs_origen, crs_destino, always_xy=True)

        return [transformer.transform(x, y) for x, y in coords_proyectadas]
    except ImportError:
        return None
    except Exception as e:
        import logging
        logger = logging.getLogger(__name__)
        logger.warning("Error transformando coordenadas: %s", e)
        return None


def transformar_punto_wgs84(x, y):
    """
    Transforma un único punto [x, y] del CRS proyectado a WGS84.

    Returns:
        tupla (lng, lat) o None
    """
    try:
        import pyproj
        crs_origen = pyproj.CRS.from_epsg(9377)
        crs_destino = pyproj.CRS.from_epsg(4326)
        transformer = pyproj.Transformer.from_crs(crs_origen, crs_destino, always_xy=True)
        return transformer.transform(x, y)
    except ImportError:
        return None
    except Exception as e:
        import logging
        logger = logging.getLogger(__name__)
        logger.warning("Error transformando punto: %s", e)
        return None


def calcular_midpoint_wgs84(geometria_wgs84):
    """
    Calcula el punto medio de un LineString WGS84 para pasárselo a TomTom/HERE.

    Args:
        geometria_wgs84: dict GeoJSON LineString con coords [lng, lat]

    Returns:
        str "lat,lng" para usar como parámetro en APIs, o None
    """
    if not geometria_wgs84 or 'coordinates' not in geometria_wgs84:
        return None

    coords = geometria_wgs84['coordinates']
    if not coords:
        return None

    idx = len(coords) // 2
    lng, lat = coords[idx]
    return f"{lat},{lng}"
