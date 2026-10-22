# backend/api/services/tomtom_service.py
import requests
from django.conf import settings
from django.core.cache import cache
import random

class TomTomTrafficService:
    BASE_URL = "https://api.tomtom.com/traffic/services/4"
    
    @classmethod
    def get_traffic_flow(cls, lat, lng, zoom=15, use_cache=True):
        """
        Obtiene el flujo de tráfico para un punto (lat, lng)
        Retorna dict con 'congestion' (0-1), 'current_speed', 'free_flow_speed'
        """
        cache_key = f"tomtom_traffic_{lat}_{lng}"
        if use_cache:
            cached = cache.get(cache_key)
            if cached:
                return cached
        
        url = f"{cls.BASE_URL}/flowSegmentData/absolute/{zoom}/json"
        params = {
            'key': settings.TOMTOM_API_KEY,
            'point': f"{lat},{lng}",
            'unit': 'kmph'
        }
        try:
            response = requests.get(url, params=params, timeout=4)
            response.raise_for_status()
            data = response.json()
            flow = data.get('flowSegmentData', {})
            current = flow.get('currentSpeed')
            free = flow.get('freeFlowSpeed')
            if free and current:
                congestion = 1 - (current / free)
                congestion = max(0.0, min(1.0, congestion))
            else:
                congestion = 0.5
            result = {
                'congestion': round(congestion, 2),
                'current_speed': current,
                'free_flow_speed': free,
                'confidence': flow.get('confidence', 1)
            }
            # cache por 10 minutos
            cache.set(cache_key, result, 600)
            return result
        except Exception as e:
            # fallback simulado
            return {
                'congestion': round(random.uniform(0.2, 0.8), 2),
                'current_speed': None,
                'free_flow_speed': None,
                'confidence': 0,
                'error': str(e)
            }