"""
Modelos de datos para el Observatorio de Movilidad Vial (OMV) Medellín.

Módulos incluidos:
- Rutas Seguras en Temporada de Lluvias
- Infraestructura y Tráfico
"""

from django.db import models



# ═══════════════════════════════════════════════
# MÓDULO: RUTAS SEGURAS
# ═══════════════════════════════════════════════

class AlertaClima(models.Model):
    """
    RI 4.1.1 — Alertas climáticas en tiempo real desde OpenWeatherMap.
    Cada alerta representa una condición meteorológica activa que afecta
    un área geográfica específica de Medellín.
    """
    ESTADO_CHOICES = [
        ("tormenta", "Tormenta"),
        ("lluvia_fuerte", "Lluvia Fuerte"),
        ("lluvia_moderada", "Lluvia Moderada"),
        ("lluvia_ligera", "Lluvia Ligera"),
        ("niebla", "Niebla"),
        ("normal", "Normal"),
    ]

    id_alerta_clima = models.AutoField(primary_key=True, verbose_name="ID Alerta Clima")
    nivel_precipitacion = models.FloatField(
        verbose_name="Nivel de Precipitación (mm/h)",
        help_text="Intensidad de lluvia en milímetros por hora"
    )
    estado_clima = models.CharField(
        max_length=50,
        choices=ESTADO_CHOICES,
        verbose_name="Estado del Clima"
    )
    coordenadas_afectadas = models.JSONField(
        verbose_name="Coordenadas Afectadas (GeoJSON)",
        help_text="FeatureCollection GeoJSON con las áreas o puntos afectados",
        null=True, blank=True
    )
    fuente_api = models.CharField(
        max_length=50,
        default="openweathermap",
        verbose_name="API de Origen"
    )
    activa = models.BooleanField(
        default=True,
        verbose_name="Alerta Activa",
        help_text="Si la alerta sigue vigente o ya expiró"
    )
    created_at = models.DateTimeField(
        auto_now_add=True,
        verbose_name="Creado"
    )
    expires_at = models.DateTimeField(
        null=True, blank=True,
        verbose_name="Expira",
        help_text="Momento en que la alerta pierde vigencia"
    )

    class Meta:
        verbose_name = "Alerta Climática"
        verbose_name_plural = "Alertas Climáticas"
        ordering = ["-created_at"]

    def __str__(self):
        return f"[{self.estado_clima}] {self.nivel_precipitacion}mm/h - {'Activa' if self.activa else 'Inactiva'}"


class ZonaRiesgo(models.Model):
    """
    Zonas de riesgo geoespaciales importadas desde los GeoJSON de la Alcaldía de Medellín.
    Incluye zonas de inundación, arroyos (sensores de nivel) y puntos de accidentalidad.
    """
    TIPO_CHOICES = [
        ("inundacion", "Riesgo de Inundación"),
        ("sensor_nivel", "Sensor de Nivel (Arroyo)"),
        ("accidentalidad", "Punto de Accidentalidad"),
    ]

    id_zona = models.AutoField(primary_key=True, verbose_name="ID Zona")
    tipo = models.CharField(
        max_length=30,
        choices=TIPO_CHOICES,
        verbose_name="Tipo de Riesgo"
    )
    geometria = models.JSONField(
        verbose_name="Geometría (GeoJSON)",
        help_text="Geometría en GeoJSON: Point, Polygon o MultiPolygon en WGS84"
    )
    nivel_riesgo = models.IntegerField(
        default=1,
        verbose_name="Nivel de Riesgo (1-5)",
        help_text="1 = riesgo bajo, 5 = riesgo crítico"
    )
    fuente = models.CharField(
        max_length=50,
        default="alcaldia_medellin",
        verbose_name="Fuente del Dato"
    )

    # Metadatos del GeoJSON original
    nombre = models.CharField(max_length=255, blank=True, null=True, verbose_name="Nombre")
    descripcion = models.TextField(blank=True, null=True, verbose_name="Descripción")
    subcuenca = models.CharField(max_length=255, blank=True, null=True, verbose_name="Subcuenca")
    comuna = models.CharField(max_length=255, blank=True, null=True, verbose_name="Comuna")
    barrio = models.CharField(max_length=255, blank=True, null=True, verbose_name="Barrio")
    gravedad = models.CharField(max_length=50, blank=True, null=True, verbose_name="Gravedad")
    fecha_evento = models.DateTimeField(null=True, blank=True, verbose_name="Fecha del Evento")
    metadata_original = models.JSONField(
        blank=True, null=True,
        verbose_name="Metadatos Originales",
        help_text="Propiedades completas del feature original en el GeoJSON"
    )

    last_updated = models.DateTimeField(auto_now=True, verbose_name="Última Actualización")

    class Meta:
        verbose_name = "Zona de Riesgo"
        verbose_name_plural = "Zonas de Riesgo"
        indexes = [
            models.Index(fields=["tipo"]),
            models.Index(fields=["nivel_riesgo"]),
        ]

    def __str__(self):
        return f"[{self.get_tipo_display()}] {self.nombre or f'ID {self.id_zona}'} - Riesgo: {self.nivel_riesgo}"


class Navegacion(models.Model):
    """
    RI 4.2.1 — Historial de navegaciones seguras.
    Almacena cada ruta calculada con el modo "Temporada de Lluvias".
    """
    id_navegacion = models.AutoField(primary_key=True, verbose_name="ID Navegación")
    id_cliente = models.CharField(
        max_length=100,
        blank=True, null=True,
        verbose_name="ID Cliente",
        help_text="UUID del cliente generado en frontend y guardado en localStorage"
    )
    origen = models.JSONField(verbose_name="Origen {lat, lng}")
    destino = models.JSONField(verbose_name="Destino {lat, lng}")
    ruta_segura_coordenadas = models.JSONField(
        verbose_name="Ruta Segura (GeoJSON)",
        help_text="FeatureCollection GeoJSON con la polyline de la ruta recomendada"
    )
    restricciones_evitadas = models.CharField(
        max_length=500,
        blank=True, null=True,
        verbose_name="Restricciones Evitadas",
        help_text="Lista separada por comas de las vías/zonas peligrosas evitadas"
    )
    tiempo_estimado = models.IntegerField(
        blank=True, null=True,
        verbose_name="Tiempo Estimado (segundos)"
    )
    distancia = models.FloatField(
        blank=True, null=True,
        verbose_name="Distancia (km)"
    )
    modo_lluvias = models.BooleanField(
        default=True,
        verbose_name="Modo Temporada de Lluvias Activo"
    )
    riesgo_promedio = models.FloatField(
        blank=True, null=True,
        verbose_name="Riesgo Promedio (0.0 - 1.0)"
    )
    created_at = models.DateTimeField(
        auto_now_add=True,
        verbose_name="Creado"
    )

    class Meta:
        verbose_name = "Navegación"
        verbose_name_plural = "Navegaciones"
        ordering = ["-created_at"]

    def __str__(self):
        return f"Ruta segura #{self.id_navegacion} - Riesgo: {self.riesgo_promedio}"


class EstadisticaAccidente(models.Model):
    """
    Datos históricos de accidentalidad correlacionados con clima.
    Sirve para análisis estadístico y mejora del modelo predictivo.
    """
    id_estadistica = models.AutoField(primary_key=True, verbose_name="ID Estadística")
    fecha = models.DateField(verbose_name="Fecha")
    nivel_precipitacion = models.FloatField(
        verbose_name="Precipitación (mm)",
        help_text="Precipitación acumulada del día"
    )
    num_accidentes = models.IntegerField(
        verbose_name="Número de Accidentes",
        default=0
    )
    zonas_afectadas = models.JSONField(
        blank=True, null=True,
        verbose_name="Zonas Afectadas (GeoJSON)",
        help_text="Puntos de accidentes ocurridos en esa fecha"
    )
    created_at = models.DateTimeField(auto_now_add=True, verbose_name="Creado")

    class Meta:
        verbose_name = "Estadística de Accidente"
        verbose_name_plural = "Estadísticas de Accidentes"
        ordering = ["-fecha"]
        unique_together = ["fecha"]

    def __str__(self):
        return f"{self.fecha} — {self.num_accidentes} accidentes, {self.nivel_precipitacion}mm"


# ═══════════════════════════════════════════════
# MÓDULO: INFRAESTRUCTURA Y TRÁFICO
# ═══════════════════════════════════════════════

class InfraestructuraFija(models.Model):
    """Elementos de infraestructura vial fija en la ciudad."""
    TIPO_CHOICES = [
        ('CAMARA_ARS', 'Cámara ARS'),
        ('CAMARA_FDT', 'Cámara Fotodetección'),
        ('SEMAFORO', 'Cruce Semafórico'),
        ('PMV', 'Panel de Mensajería Variable'),
        ('SEDE', 'Sede Movilidad'),
        ('RADAR', 'Radar Estático'),
    ]
    nombre = models.CharField(max_length=255)
    tipo = models.CharField(max_length=20, choices=TIPO_CHOICES)
    ubicacion = models.JSONField(help_text="Coordenadas del punto [lng, lat] o GeoJSON Point")
    activo = models.BooleanField(default=True)

    def __str__(self):
        return f"{self.nombre} ({self.tipo})"


class SegmentoVial(models.Model):
    """Segmento de vía con características geométricas y de tránsito."""
    nombre = models.CharField(max_length=255)
    sentido = models.CharField(max_length=50)
    velocidad_maxima = models.IntegerField(default=50)
    geometria = models.JSONField(help_text="GeoJSON LineString de la vía")

    def __str__(self):
        return self.nombre


class FlujoVehicular(models.Model):
    """Mediciones de flujo vehicular por segmento vial."""
    segmento = models.ForeignKey(SegmentoVial, on_delete=models.CASCADE, related_name='flujos')
    volumen = models.IntegerField(help_text="Vehículos por hora")
    velocidad_promedio = models.FloatField(help_text="Velocidad en km/h")
    timestamp = models.DateTimeField(auto_now_add=True)
    congestionado = models.BooleanField(default=False)

    def __str__(self):
        return f"{self.segmento.nombre} - {self.timestamp}"


class ZonaEspecial(models.Model):
    """Zonas con regulación especial de tránsito (pico y placa, vías exentas)."""
    TIPO_CHOICES = [
        ('PICO_Y_PLACA', 'Zona Pico y Placa'),
        ('VIA_EXENTA', 'Vía Exenta'),
    ]
    nombre = models.CharField(max_length=255)
    tipo = models.CharField(max_length=20, choices=TIPO_CHOICES)
    geometria = models.JSONField(help_text="GeoJSON Polygon de la zona")

    def __str__(self):
        return f"{self.nombre} ({self.tipo})"
