from django.db import models

class InfraestructuraFija(models.Model):
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
    nombre = models.CharField(max_length=255)
    sentido = models.CharField(max_length=50)
    velocidad_maxima = models.IntegerField(default=50)
    geometria = models.JSONField(help_text="GeoJSON LineString de la vía")
    
    def __str__(self):
        return self.nombre

class FlujoVehicular(models.Model):
    segmento = models.ForeignKey(SegmentoVial, on_delete=models.CASCADE, related_name='flujos')
    volumen = models.IntegerField(help_text="Vehículos por hora")
    velocidad_promedio = models.FloatField(help_text="Velocidad en km/h")
    timestamp = models.DateTimeField(auto_now_add=True)
    congestionado = models.BooleanField(default=False)

    def __str__(self):
        return f"{self.segmento.nombre} - {self.timestamp}"

class ZonaEspecial(models.Model):
    TIPO_CHOICES = [
        ('PICO_Y_PLACA', 'Zona Pico y Placa'),
        ('VIA_EXENTA', 'Vía Exenta'),
    ]
    nombre = models.CharField(max_length=255)
    tipo = models.CharField(max_length=20, choices=TIPO_CHOICES)
    geometria = models.JSONField(help_text="GeoJSON Polygon de la zona")

    def __str__(self):
        return f"{self.nombre} ({self.tipo})"
