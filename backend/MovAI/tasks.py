from celery import shared_task
from .services.traffic_engine import fetch_mapgis_data, analyze_congestion

@shared_task
def update_traffic_data():
    """
    Tarea periódica (cada 5 min) para consumir MapGIS
    y actualizar el estado de congestión.
    """
    # 1. Fetch GeoJSON from public MapGIS DB
    geojson_data = fetch_mapgis_data()
    
    # 2. Analyze Congestion & Dynamic Thresholds
    analyze_congestion(geojson_data)
    
    return "Traffic data updated and analyzed successfully."
