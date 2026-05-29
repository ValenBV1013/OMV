from django.contrib import admin

from .models import AlertaClima, EstadisticaAccidente, Navegacion, ZonaRiesgo


@admin.register(AlertaClima)
class AlertaClimaAdmin(admin.ModelAdmin):
    list_display = ["id_alerta_clima", "estado_clima", "nivel_precipitacion", "activa", "created_at"]
    list_filter = ["activa", "estado_clima"]
    search_fields = ["estado_clima"]


@admin.register(ZonaRiesgo)
class ZonaRiesgoAdmin(admin.ModelAdmin):
    list_display = ["id_zona", "tipo", "nombre", "nivel_riesgo", "comuna", "fecha_evento"]
    list_filter = ["tipo", "nivel_riesgo", "comuna"]
    search_fields = ["nombre", "comuna", "barrio"]


@admin.register(Navegacion)
class NavegacionAdmin(admin.ModelAdmin):
    list_display = ["id_navegacion", "id_cliente", "riesgo_promedio", "modo_lluvias", "created_at"]
    list_filter = ["modo_lluvias"]
    search_fields = ["restricciones_evitadas"]


@admin.register(EstadisticaAccidente)
class EstadisticaAccidenteAdmin(admin.ModelAdmin):
    list_display = ["id_estadistica", "fecha", "nivel_precipitacion", "num_accidentes"]
    list_filter = ["fecha"]
    date_hierarchy = "fecha"
