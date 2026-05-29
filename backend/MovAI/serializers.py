"""
Serializadores DRF para módulos de Rutas Seguras e Infraestructura/Tráfico.
"""

from rest_framework import serializers

from .models import (
    AlertaClima, DashboardConfig, EstadisticaAccidente, EventoCongestion,
    FlujoVehicular, Navegacion, RegistroKPI, RutaSugerida, SegmentoVial,
    ZonaRiesgo,
)


# ═══════════════════════════════════════════════
# Rutas Seguras — Clima
# ═══════════════════════════════════════════════

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
    origen = serializers.JSONField()
    destino = serializers.JSONField()
    modo_lluvias = serializers.BooleanField(default=True, required=False)
    id_cliente = serializers.CharField(required=False, allow_null=True, allow_blank=True)

    def _validar_punto(self, value, campo: str):
        if isinstance(value, dict):
            if "lat" not in value or "lng" not in value:
                raise serializers.ValidationError(
                    f"{campo} como coordenadas debe contener 'lat' y 'lng'"
                )
        elif isinstance(value, str):
            if len(value.strip()) < 3:
                raise serializers.ValidationError(
                    f"{campo} como dirección debe tener al menos 3 caracteres"
                )
        else:
            raise serializers.ValidationError(
                f"{campo} debe ser string (dirección) u objeto {{'lat': ..., 'lng': ...}}"
            )
        return value

    def validate_origen(self, value):
        return self._validar_punto(value, "origen")

    def validate_destino(self, value):
        return self._validar_punto(value, "destino")


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


# ═══════════════════════════════════════════════
# Infraestructura / Tráfico
# ═══════════════════════════════════════════════

class SegmentoListSerializer(serializers.ModelSerializer):
    """Serializer plano para listar segmentos con su último estado."""
    ultimo_flujo = serializers.SerializerMethodField()

    class Meta:
        model = SegmentoVial
        fields = [
            'id', 'objectid', 'nombre', 'label', 'nombre_comun',
            'tipo_via', 'sentido', 'velocidad_maxima', 'jerarquia_via',
            'comuna', 'municipio', 'activo', 'geometria',
            'geometria_wgs84',
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
        qs = obj.flujos.order_by('-timestamp')[:48]
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
