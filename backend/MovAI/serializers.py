"""
Serializers DRF para el módulo de Rutas Seguras.
"""

from rest_framework import serializers

from .models import AlertaClima, EstadisticaAccidente, Navegacion, ZonaRiesgo


class AlertaClimaSerializer(serializers.ModelSerializer):
    estado_display = serializers.CharField(
        source="get_estado_clima_display", read_only=True
    )

    class Meta:
        model = AlertaClima
        fields = [
            "id_alerta_clima",
            "nivel_precipitacion",
            "estado_clima",
            "estado_display",
            "coordenadas_afectadas",
            "activa",
            "created_at",
            "expires_at",
        ]


class ZonaRiesgoSerializer(serializers.ModelSerializer):
    tipo_display = serializers.CharField(source="get_tipo_display", read_only=True)

    class Meta:
        model = ZonaRiesgo
        fields = [
            "id_zona",
            "tipo",
            "tipo_display",
            "geometria",
            "nivel_riesgo",
            "nombre",
            "descripcion",
            "comuna",
            "barrio",
        ]


class NavegacionSerializer(serializers.ModelSerializer):
    class Meta:
        model = Navegacion
        fields = [
            "id_navegacion",
            "origen",
            "destino",
            "ruta_segura_coordenadas",
            "restricciones_evitadas",
            "tiempo_estimado",
            "distancia",
            "modo_lluvias",
            "riesgo_promedio",
            "created_at",
        ]
        read_only_fields = [
            "id_navegacion", "ruta_segura_coordenadas",
            "tiempo_estimado", "distancia", "riesgo_promedio", "created_at",
        ]


class RutaSeguraInputSerializer(serializers.Serializer):
    """Validación del input para POST /api/v1/rutas/segura/"""
    origen = serializers.DictField(
        child=serializers.FloatField(),
        help_text='{"lat": 6.2442, "lng": -75.5812}',
    )
    destino = serializers.DictField(
        child=serializers.FloatField(),
        help_text='{"lat": 6.2500, "lng": -75.5900}',
    )
    modo_lluvias = serializers.BooleanField(default=True, required=False)
    id_cliente = serializers.CharField(required=False, allow_null=True, allow_blank=True)

    def validate_origen(self, value):
        if "lat" not in value or "lng" not in value:
            raise serializers.ValidationError(
                "origen debe contener 'lat' y 'lng'"
            )
        return value

    def validate_destino(self, value):
        if "lat" not in value or "lng" not in value:
            raise serializers.ValidationError(
                "destino debe contener 'lat' y 'lng'"
            )
        return value


class EstadisticaAccidenteSerializer(serializers.ModelSerializer):
    class Meta:
        model = EstadisticaAccidente
        fields = "__all__"


class CorrelacionClimaAccidenteSerializer(serializers.Serializer):
    """Serializer para el reporte de correlación."""
    fecha_inicio = serializers.DateField()
    fecha_fin = serializers.DateField()
    total_accidentes = serializers.IntegerField()
    promedio_precipitacion = serializers.FloatField()
    dias_lluvia = serializers.IntegerField()
    accidentes_en_dias_lluvia = serializers.IntegerField()
    correlacion_estimada = serializers.FloatField()


class ClimaActualSerializer(serializers.Serializer):
    """Serializer para la respuesta del clima actual."""
    temp = serializers.FloatField(allow_null=True)
    humidity = serializers.IntegerField(allow_null=True)
    pressure = serializers.IntegerField(allow_null=True)
    description = serializers.CharField()
    estado_normalizado = serializers.CharField()
    precipitacion_mmh = serializers.FloatField()
    wind_speed = serializers.FloatField(allow_null=True)
    icon = serializers.CharField()
    timestamp = serializers.CharField()
    alertas_activas = serializers.IntegerField()
