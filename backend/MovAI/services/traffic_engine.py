import random
import requests
from channels.layers import get_channel_layer
from asgiref.sync import async_to_sync

def fetch_mapgis_data():
    """
    Simula la consulta a la base de datos pública MapGIS.
    Retorna un GeoJSON ficticio de segmentos y flujo.
    """
    return {
        "type": "FeatureCollection",
        "features": [
            # Datos simulados de MapGIS
        ]
    }

def analyze_congestion(geojson_data):
    """
    Analiza umbrales dinámicos. Si el volumen actual supera
    el promedio histórico, marca como congestionado y 
    emite alerta vía WebSocket.
    """
    # Simulación de detección de congestión
    congestion_detectada = random.choice([True, False])
    
    if congestion_detectada:
        segmento_id = random.randint(1, 100)
        # Obtenemos ruta alterna usando API gratuita (ej. OSRM)
        ruta_alterna = get_alternative_route(start_coord="-74.0,4.6", end_coord="-74.1,4.7")
        
        # Emitir evento al frontend
        channel_layer = get_channel_layer()
        async_to_sync(channel_layer.group_send)(
            "traffic_alerts",
            {
                "type": "traffic_update",
                "data": {
                    "tipo": "CONGESTION",
                    "segmento_id": segmento_id,
                    "mensaje": f"Congestión detectada en segmento {segmento_id}",
                    "ruta_sugerida": ruta_alterna
                }
            }
        )

def get_alternative_route(start_coord, end_coord):
    """
    Consulta a la API gratuita de OSRM para obtener ruta alterna.
    """
    try:
        # url = f"http://router.project-osrm.org/route/v1/driving/{start_coord};{end_coord}?overview=full&geometries=geojson"
        # response = requests.get(url)
        # return response.json()['routes'][0]['geometry']
        
        # Retorno de un GeoJSON LineString simulado por simplicidad
        return {
            "type": "LineString",
            "coordinates": [
                [-74.0, 4.6],
                [-74.05, 4.65],
                [-74.1, 4.7]
            ]
        }
    except Exception as e:
        return None
