from rest_framework.decorators import api_view
from rest_framework.response import Response
from rest_framework.views import APIView
from rest_framework import status
from supabase import create_client, Client
from django.conf import settings
import random
from datetime import datetime
from .predictor import TrafficPredictorLite
from .services.tomtom_service import TomTomTrafficService
import json
from pathlib import Path

# Opcional: convertir coordenadas con pyproj (descomentar si instalas)
# from pyproj import Transformer
# transformer = Transformer.from_crs("EPSG:3116", "EPSG:4326")

supabase: Client = create_client(
    settings.SUPABASE_URL,
    settings.SUPABASE_ANON_KEY
)

# ==============================================================================
# TUS ENDPOINTS ORIGINALES (sin modificar)
# ==============================================================================
@api_view(['POST'])
def predict_congestion(request):
    hora_actual = datetime.now().hour
    hora_factor = 1.0 if (7 <= hora_actual <= 9 or 17 <= hora_actual <= 19) else 0.3
    dia_factor = 0.8 if datetime.now().weekday() >= 5 else 0.4
    clima = random.choice(["soleado", "lluvia", "nublado"])
    
    prob = min(0.95, (hora_factor + dia_factor + (0.3 if clima == "lluvia" else 0)) / 2.2)
    
    ventana = "2 horas" if prob > 0.6 else "4 horas"
    factores = f"{clima}, {'hora punta' if hora_factor>0.8 else 'hora normal'}"
    
    if prob > 0.7:
        estado = "CONGESTION ALTA"
        recomendacion = "Evite la zona por las próximas 2-4 horas"
    elif prob > 0.4:
        estado = "CONGESTION MODERADA"
        recomendacion = "Precaución, posible tráfico moderado"
    else:
        estado = "LIBRE"
        recomendacion = "Tránsito normal"
    
    return Response({
        "probabilidad": round(prob, 2),
        "ventana": ventana,
        "factores": factores,
        "estado": estado,
        "recomendacion": recomendacion
    })

@api_view(['POST'])
def predict_congestion_v2(request):
    zona_id = request.data.get('sector_id', 1)
    predictor = TrafficPredictorLite(zona_id)
    predicciones = predictor.predecir(horizonte_horas=4)
    prob_max = max(p['probabilidad_congestion'] for p in predicciones)
    if prob_max > 0.7:
        estado = "CONGESTION ALTA"
        recomendacion = "Evite la zona durante las próximas horas"
    elif prob_max > 0.4:
        estado = "CONGESTION MODERADA"
        recomendacion = "Precaución, tráfico irregular"
    else:
        estado = "LIBRE"
        recomendacion = "Tránsito normal"
    return Response({
        'predicciones': predicciones,
        'probabilidad_maxima': prob_max,
        'ventana': '4 horas',
        'estado': estado,
        'recomendacion': recomendacion
    })

@api_view(['GET'])
def heatmap_data(request):
    heatmap_points = []
    center_lat = 4.624
    center_lng = -74.065
    
    zonas_calientes = [
        (4.634, -74.071, 0.85), (4.674, -74.055, 0.78),
        (4.714, -74.035, 0.65), (4.701, -74.146, 0.72),
    ]
    
    for lat, lng, intensidad in zonas_calientes:
        heatmap_points.append([lat, lng, intensidad])
        for _ in range(5):
            heatmap_points.append([
                lat + random.uniform(-0.01, 0.01),
                lng + random.uniform(-0.01, 0.01),
                intensidad * random.uniform(0.6, 0.9)
            ])
    
    for _ in range(40):
        heatmap_points.append([
            center_lat + random.uniform(-0.1, 0.1),
            center_lng + random.uniform(-0.1, 0.1),
            random.uniform(0.2, 0.8)
        ])
    
    return Response(heatmap_points)

# ==============================================================================
# NUEVOS ENDPOINTS CON TOMTOM (datos reales de tráfico)
# ==============================================================================

def extraer_coordenadas(address):
    try:
        parts = address.split(',')
        if len(parts) >= 2:
            lat = float(parts[0].strip())
            lng = float(parts[1].strip())
            return lat, lng
    except:
        pass
    return None, None

@api_view(['POST'])
def predict_tomtom(request):
    address = request.data.get('address', '')
    horizon = request.data.get('horizon', 2)
    
    lat, lng = extraer_coordenadas(address)
    if lat is None or lng is None:
        lat, lng = 6.2476, -75.5658
    
    traffic = TomTomTrafficService.get_traffic_flow(lat, lng)
    prob = traffic['congestion']
    
    hora = datetime.now().hour
    es_hora_punta = (7 <= hora <= 9) or (17 <= hora <= 19)
    prob = prob * (1.2 if es_hora_punta else 0.9)
    prob = prob * (1.05 if horizon == 4 else 1.0)
    prob = min(0.95, max(0.05, prob))
    
    ventana = f"{horizon} horas"
    factores = f"TomTom real-time, {'hora punta' if es_hora_punta else 'hora normal'}"
    
    if prob > 0.7:
        estado = "CONGESTION ALTA"
        recomendacion = "Evite la zona por las próximas horas"
    elif prob > 0.4:
        estado = "CONGESTION MODERADA"
        recomendacion = "Precaución, tráfico irregular"
    else:
        estado = "LIBRE"
        recomendacion = "Tránsito normal"
    
    return Response({
        "probabilidad": round(prob, 2),
        "ventana": ventana,
        "factores": factores,
        "estado": estado,
        "recomendacion": recomendacion,
        "velocidad_actual": traffic.get('current_speed'),
        "velocidad_libre": traffic.get('free_flow_speed')
    })

@api_view(['GET'])
def heatmap_tomtom(request):
    horizon = int(request.GET.get('horas_adelanto', 2))
    puntos = [
        (6.2442, -75.5812), (6.2530, -75.5634), (6.2476, -75.5658),
        (6.2390, -75.5720), (6.2590, -75.5580), (6.2670, -75.5700),
        (6.2320, -75.5850), (6.2750, -75.5620), (6.2460, -75.5490),
        (6.2200, -75.5760), (6.2850, -75.5680), (6.2100, -75.5900),
        (6.2600, -75.5400)
    ]
    heatmap = []
    for lat, lng in puntos:
        traffic = TomTomTrafficService.get_traffic_flow(lat, lng)
        intensidad = traffic['congestion']
        if horizon == 4:
            intensidad = min(1.0, intensidad * 1.08)
        heatmap.append([lat, lng, round(intensidad, 2)])
    return Response(heatmap)

# ==============================================================================
# ENDPOINT PARA INCIDENTES HISTÓRICOS (CON FILTRO POR DÍAS Y CONVERSIÓN DE COORDS)
# ==============================================================================
@api_view(['GET'])
def incidentes_historicos(request):
    dias = int(request.GET.get('dias', 0))
    data_path = Path(__file__).resolve().parent.parent / 'data' / 'incidentes.json'
    
    try:
        with open(data_path, 'r', encoding='utf-8') as f:
            todos = json.load(f)
    except FileNotFoundError:
        return Response({"error": "Archivo de incidentes no encontrado"}, status=404)

    # Aplicar filtro temporal solo si dias > 0 y < 3650 (para no filtrar todos)
    if dias > 0 and dias < 3650:
        ahora = datetime.now().timestamp() * 1000
        limite = ahora - (dias * 24 * 60 * 60 * 1000)
        incidentes = [inc for inc in todos if inc.get('fecha') and inc['fecha'] >= limite]
    else:
        incidentes = todos  # dias == 0 o mayor a 10 años → todos

    # Convertir coordenadas de proyectadas a WGS84 (si pyproj está instalado)
    try:
        from pyproj import Transformer
        transformer = Transformer.from_crs("EPSG:3116", "EPSG:4326")
        for inc in incidentes:
            x = inc.get('longitud') or inc.get('x_origen_nacional')
            y = inc.get('latitud') or inc.get('y_origen_nacional')
            if x and y:
                lon, lat = transformer.transform(x, y)
                inc['lng'] = lon
                inc['lat'] = lat
    except ImportError:
        # Si no hay pyproj, dejar coordenadas originales (se convertirán en frontend)
        pass

    return Response(incidentes)

# ==============================================================================
# ENDPOINT PARA VALIDAR TOKEN
# ==============================================================================
class ValidateTokenView(APIView):
    def post(self, request):
        auth_header = request.headers.get('Authorization')
        if not auth_header or not auth_header.startswith('Bearer '):
            return Response({'error': 'Token no proporcionado'}, status=status.HTTP_401_UNAUTHORIZED)
        token = auth_header.split(' ')[1]
        try:
            user = supabase.auth.get_user(token)
            return Response({'id': user.user.id, 'email': user.user.email})
        except Exception as e:
            return Response({'error': str(e)}, status=status.HTTP_401_UNAUTHORIZED)