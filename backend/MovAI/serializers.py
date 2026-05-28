"""
Serializadores DRF para el módulo de detección de congestión.
"""

from rest_framework import serializers

from .models import (
    SegmentoVial, FlujoVehicular, EventoCongestion,
    RutaSugerida, DashboardConfig, RegistroKPI,
)


class SegmentoListSerializer(serializers.ModelSerializer):
    """Serializer plano para listar segmentos con su último estado."""
    ultimo_flujo = serializers.SerializerMethodField()

    class Meta:
        model = SegmentoVial
        fields = [
            'id', 'objectid', 'nombre', 'label', 'nombre_comun',
            'tipo_via', 'sentido', 'velocidad_maxima', 'jerarquia_via',
            'comuna', 'municipio', 'activo', 'geometria',
            'ultimo_flujo',
        ]

    def get_ultimo_flujo(self, obj):
        ultimo = obj.flujos.order_by('-timestamp').first()
        if not ultimo:
            return None
        return {
            "velocidad_promedio": ultimo.velocidad_promedio,
            "velocidad_libre": ultimo.velocidad_libre,
            "nivel_congestion": ultimo.nivel_congestion,
            "congestionado": ultimo.congestionado,
            "fuente": ultimo.fuente,
            "timestamp": ultimo.timestamp.isoformat(),
        }


class SegmentoDetailSerializer(serializers.ModelSerializer):
    """Serializer detallado con historial de flujos."""
    flujos = serializers.SerializerMethodField()

    class Meta:
        model = SegmentoVial
        fields = '__all__'

    def get_flujos(self, obj):
        qs = obj.flujos.order_by('-timestamp')[:48]  # últimas 4h (c/5min)
        return [
            {
                "velocidad_promedio": f.velocidad_promedio,
                "nivel_congestion": f.nivel_congestion,
                "timestamp": f.timestamp.isoformat(),
            }
            for f in qs
        ]


class EventoCongestionSerializer(serializers.ModelSerializer):
    """Serializer para eventos de congestión."""
    segmento_nombre = serializers.CharField(source='segmento.nombre', read_only=True)
    duracion_s = serializers.IntegerField(source='duracion_segundos', read_only=True)

    class Meta:
        model = EventoCongestion
        fields = [
            'id', 'segmento_id', 'segmento_nombre',
            'nivel', 'velocidad_promedio', 'velocidad_libre',
            'timestamp', 'activo', 'resuelto_en', 'duracion_s',
        ]


class RutaSugeridaSerializer(serializers.ModelSerializer):
    """Serializer para rutas sugeridas."""
    class Meta:
        model = RutaSugerida
        fields = '__all__'


class RutaAlternativaInputSerializer(serializers.Serializer):
    """Validador para el endpoint de rutas alternativas."""
    start_lat = serializers.FloatField(required=True)
    start_lng = serializers.FloatField(required=True)
    end_lat = serializers.FloatField(required=True)
    end_lng = serializers.FloatField(required=True)


class RutaAcceptSerializer(serializers.Serializer):
    """Validador para aceptar una ruta sugerida."""
    aceptada = serializers.BooleanField(required=True)
