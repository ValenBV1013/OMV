"""
Modelos de datos para el Observatorio de Movilidad Vial (OMV) Medellín.

Módulos incluidos:
- Rutas Seguras en Temporada de Lluvias
- Infraestructura y Tráfico / Congestión
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
    """Cámaras, semáforos, PMV, radares — datos de la Alcaldía de Medellín."""
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
    """
    Segmento de la red vial de Medellín importado desde GeoJSON de la Alcaldía.

    Las coordenadas en `geometria` vienen en **Magna-Sirgas Colombia (EPSG:9377)**.
    La transformación a WGS84 se hace bajo demanda en los servicios de tráfico.
    """
    objectid = models.IntegerField(unique=True, null=True, blank=True,
                                    help_text="OBJECTID del GeoJSON de la Alcaldía")

    nombre = models.CharField(max_length=255, blank=True, default='',
                              help_text="Nombre compuesto tipo_via + numero_via + apendice, ej. CL 104B")
    label = models.CharField(max_length=255, blank=True, default='',
                             help_text="Label corto del GeoJSON, ej. CL 104B")
    nombre_comun = models.CharField(max_length=255, blank=True, default='',
                                    help_text="Nombre común o sector, ej. BOMBONA")
    via_principal = models.CharField(max_length=100, blank=True, default='')
    via_generadora = models.CharField(max_length=100, blank=True, default='')

    tipo_via = models.CharField(max_length=10, blank=True, default='',
                                help_text="CL = Calle, CR = Carrera, AV = Avenida, DG = Diagonal, etc.")
    sentido = models.CharField(max_length=50, blank=True, default='')
    velocidad_maxima = models.IntegerField(default=50, help_text="km/h")

    jerarquia_via = models.IntegerField(null=True, blank=True,
                                        help_text="Jerarquía: menor número = vía más importante (arteria)")
    comuna = models.CharField(max_length=10, blank=True, default='')
    municipio = models.CharField(max_length=100, blank=True, default='MEDELLIN')

    longitud_m = models.FloatField(null=True, blank=True, help_text="Longitud del segmento en metros")

    geometria = models.JSONField(help_text="GeoJSON LineString original (proyectado EPSG:9377)")
    geometria_wgs84 = models.JSONField(null=True, blank=True,
                                       help_text="GeoJSON LineString transformado a WGS84 (lat/lng)")

    activo = models.BooleanField(default=True,
                                 help_text="Si está activo para monitoreo de tráfico")

    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        verbose_name = "Segmento Vial"
        verbose_name_plural = "Segmentos Viales"
        indexes = [
            models.Index(fields=['jerarquia_via']),
            models.Index(fields=['activo']),
        ]

    def __str__(self):
        return self.nombre or self.label or f"Segmento #{self.objectid}"


class FlujoVehicular(models.Model):
    """Lectura de flujo vehicular para un segmento en un instante dado (cada 5 min)."""
    NIVEL_CHOICES = [
        ('BAJO', 'Bajo'),
        ('MODERADO', 'Moderado'),
        ('ALTO', 'Alto'),
        ('SEVERO', 'Severo'),
    ]
    segmento = models.ForeignKey(SegmentoVial, on_delete=models.CASCADE, related_name='flujos')
    volumen = models.IntegerField(default=0, help_text="Vehículos por hora (si la fuente lo provee)")
    velocidad_promedio = models.FloatField(help_text="Velocidad actual en km/h")
    velocidad_libre = models.FloatField(null=True, blank=True,
                                        help_text="Velocidad sin congestión (free flow) en km/h")
    nivel_congestion = models.CharField(max_length=10, choices=NIVEL_CHOICES, default='BAJO')
    congestionado = models.BooleanField(default=False)
    fuente = models.CharField(max_length=20, default='tomtom',
                              help_text="Fuente del dato: tomtom, here, mapa_colaborativo")
    timestamp = models.DateTimeField(auto_now_add=True)

    class Meta:
        verbose_name = "Flujo Vehicular"
        verbose_name_plural = "Flujos Vehiculares"
        ordering = ['-timestamp']
        indexes = [
            models.Index(fields=['segmento', '-timestamp']),
            models.Index(fields=['congestionado']),
        ]

    def __str__(self):
        return f"{self.segmento.nombre} — {self.velocidad_promedio} km/h ({self.nivel_congestion})"


class EventoCongestion(models.Model):
    """
    Evento de congestión ALTO o SEVERO persistido.

    Se marca como activo cuando se detecta y se resuelve automáticamente
    cuando el nivel baja a BAJO/MODERADO o tras timeout de 2h.
    """
    segmento = models.ForeignKey(SegmentoVial, on_delete=models.CASCADE, related_name='eventos')
    nivel = models.CharField(max_length=10, choices=FlujoVehicular.NIVEL_CHOICES)
    velocidad_promedio = models.FloatField()
    velocidad_libre = models.FloatField(null=True, blank=True)
    timestamp = models.DateTimeField(auto_now_add=True)
    activo = models.BooleanField(default=True)
    resuelto_en = models.DateTimeField(null=True, blank=True)

    class Meta:
        verbose_name = "Evento de Congestión"
        verbose_name_plural = "Eventos de Congestión"
        ordering = ['-timestamp']
        indexes = [
            models.Index(fields=['activo', '-timestamp']),
            models.Index(fields=['segmento', 'activo']),
        ]

    def __str__(self):
        estado = "🔴" if self.activo else "✅"
        return f"{estado} {self.segmento.nombre} — {self.nivel} @ {self.timestamp}"

    @property
    def duracion_segundos(self):
        if not self.resuelto_en:
            return None
        return int((self.resuelto_en - self.timestamp).total_seconds())


class ZonaEspecial(models.Model):
    """Zonas con regulación especial de tránsito (pico y placa, vías exentas)."""
    TIPO_CHOICES = [
        ('PICO_Y_PLACA', 'Zona Pico y Placa'),
        ('VIA_EXENTA', 'Vía Exenta'),
    ]
    nombre = models.CharField(max_length=255)
    tipo = models.CharField(max_length=20, choices=TIPO_CHOICES)
    geometria = models.JSONField(help_text="GeoJSON Polygon de la zona")

    class Meta:
        verbose_name = "Zona Especial"
        verbose_name_plural = "Zonas Especiales"

    def __str__(self):
        return f"{self.nombre} ({self.get_tipo_display()})"


class RutaSugerida(models.Model):
    """
    Ruta alternativa sugerida al usuario para evitar congestión.

    Cumple con RN 2.2.1: ahorro >= 15% O 5 minutos mínimos.
    """
    coordenadas_trayecto = models.TextField(help_text="GeoJSON LineString de la ruta alterna")
    tiempo_estimado_original = models.IntegerField(help_text="Tiempo original estimado en segundos")
    tiempo_estimado_alterno = models.IntegerField(help_text="Tiempo alternativo estimado en segundos")
    ahorro_porcentaje = models.FloatField(help_text="Porcentaje de ahorro calculado")
    ahorro_segundos = models.IntegerField(help_text="Ahorro absoluto en segundos")
    cumple_regla = models.BooleanField(default=False,
                                       help_text="True si ahorro >= 15% o >= 300s")
    distancia_km = models.FloatField()
    origen_coords = models.CharField(max_length=100, help_text="lat,lng")
    destino_coords = models.CharField(max_length=100, help_text="lat,lng")
    timestamp = models.DateTimeField(auto_now_add=True)
    fue_aceptada = models.BooleanField(default=False)
    aceptada_en = models.DateTimeField(null=True, blank=True)

    class Meta:
        verbose_name = "Ruta Sugerida"
        verbose_name_plural = "Rutas Sugeridas"
        ordering = ['-timestamp']

    def __str__(self):
        aceptada = "✓" if self.fue_aceptada else "○"
        return f"{aceptada} Alternativa — ahorro {self.ahorro_porcentaje}% ({self.ahorro_segundos}s)"


class DashboardConfig(models.Model):
    """
    Configuración del dashboard del frontend.

    Se usa como singleton: load() siempre retorna la única instancia.
    """
    centro_mapa_lat = models.FloatField(default=6.2476)
    centro_mapa_lng = models.FloatField(default=-75.5658)
    zoom_default = models.IntegerField(default=13)
    intervalo_refresco = models.IntegerField(default=300, help_text="Intervalo en segundos (5 min)")
    eventos_limite = models.IntegerField(default=20, help_text="Máx eventos recientes en la respuesta")
    segmentos_monitoreados = models.IntegerField(default=12,
                                                 help_text="Top N segmentos más importantes a monitorear")

    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        verbose_name = "Configuración del Dashboard"

    @classmethod
    def load(cls):
        """Retorna la única instancia (singleton), creándola si no existe."""
        obj, _ = cls.objects.get_or_create(pk=1)
        return obj

    def __str__(self):
        return f"DashboardConfig — zoom {self.zoom_default} / refresh {self.intervalo_refresco}s"


class RegistroKPI(models.Model):
    """Registro de KPIs operativos del sistema."""
    TIPO_CHOICES = [
        ('ALERTA_ENVIADA', 'Alerta de congestión enviada'),
        ('RUTA_SUGERIDA', 'Ruta alterna sugerida'),
        ('RUTA_ACEPTADA', 'Ruta alterna aceptada por el usuario'),
        ('TIEMPO_RESPUESTA_MS', 'Tiempo de respuesta del sistema (ms)'),
        ('ERROR_API', 'Error en API externa (TomTom/HERE)'),
        ('CICLO_COMPLETADO', 'Ciclo de actualización completado'),
    ]
    tipo = models.CharField(max_length=30, choices=TIPO_CHOICES, db_index=True)
    valor = models.FloatField(help_text="Valor del KPI (conteo, ms, etc.)")
    timestamp = models.DateTimeField(auto_now_add=True, db_index=True)
    metadata = models.JSONField(default=dict, blank=True,
                                help_text="Datos adicionales (segmento_id, api, error_msg, etc.)")

    class Meta:
        verbose_name = "Registro KPI"
        verbose_name_plural = "Registros KPI"
        indexes = [
            models.Index(fields=['tipo', 'timestamp']),
        ]
        ordering = ['-timestamp']

    def __str__(self):
        return f"{self.tipo}: {self.valor} @ {self.timestamp}"
