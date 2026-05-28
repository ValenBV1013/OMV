from django.db import models


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
    centro_mapa_lat = models.FloatField(default=6.2476)   # Medellín centro
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
