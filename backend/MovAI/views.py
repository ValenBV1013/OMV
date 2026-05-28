from rest_framework.views import APIView
from rest_framework.response import Response
from .models import InfraestructuraFija, SegmentoVial

class DashboardInitView(APIView):
    def get(self, request):
        infra = InfraestructuraFija.objects.filter(activo=True)
        # Convert to GeoJSON manually or use DRF-GIS. 
        # Manual is fine for this small set.
        features = []
        for item in infra:
            features.append({
                "type": "Feature",
                "geometry": {
                    "type": "Point",
                    "coordinates": item.ubicacion if isinstance(item.ubicacion, list) else item.ubicacion.get('coordinates', [0, 0])
                },
                "properties": {
                    "id": item.id,
                    "nombre": item.nombre,
                    "tipo": item.tipo
                }
            })
        
        return Response({
            "type": "FeatureCollection",
            "features": features
        })
