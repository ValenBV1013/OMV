from rest_framework.decorators import api_view
from rest_framework.response import Response
from rest_framework.views import APIView
from rest_framework import status
from supabase import create_client, Client
from django.conf import settings
import random
from datetime import datetime
from .predictor import TrafficPredictorLite   

# ---------- CLIENTE SUPABASE (usando variables desde settings) ----------
supabase: Client = create_client(
    settings.SUPABASE_URL,
    settings.SUPABASE_ANON_KEY
)

# ---------- TUS ENDPOINTS ORIGINALES ----------
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

    # ---------- NUEVO ENDPOINT CON PREDICCIÓN REAL (series temporales) ----------
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
        'predicciones': predicciones,   # array de 4 horas
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

# ---------- NUEVO ENDPOINT PARA VALIDAR TOKEN ----------
class ValidateTokenView(APIView):
    def post(self, request):
        auth_header = request.headers.get('Authorization')
        if not auth_header or not auth_header.startswith('Bearer '):
            return Response({'error': 'Token no proporcionado'}, status=status.HTTP_401_UNAUTHORIZED)
        
        token = auth_header.split(' ')[1]
        
        try:
            user = supabase.auth.get_user(token)
            return Response({
                'id': user.user.id,
                'email': user.user.email,
                'user_metadata': user.user.user_metadata
            })
        except Exception as e:
            return Response({'error': str(e)}, status=status.HTTP_401_UNAUTHORIZED)