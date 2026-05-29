from rest_framework.decorators import api_view
from rest_framework.response import Response
import random
from datetime import datetime

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