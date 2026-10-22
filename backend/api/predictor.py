# api/predictor.py
from datetime import datetime, timedelta
import random
import math

class TrafficPredictorLite:
    def __init__(self, zona_id):
        self.zona_id = zona_id

    def _flujo_esperado(self, timestamp):
        """Flujo con estacionalidad real (hora pico, día, fin de semana)"""
        hora = timestamp.hour
        dia = timestamp.weekday()
        base = 800
        pico_matutino = 600 * max(0, 1 - abs(hora - 8) / 4)
        pico_vespertino = 500 * max(0, 1 - abs(hora - 18) / 4)
        factor_dia = 0.6 if dia >= 5 else 1.0
        ruido = random.uniform(0.8, 1.2)
        flujo = (base + pico_matutino + pico_vespertino) * factor_dia * ruido
        return max(200, min(2000, flujo))

    def predecir(self, horizonte_horas=4):
        now = datetime.now()
        resultados = []
        for h in range(1, horizonte_horas+1):
            futuro = now + timedelta(hours=h)
            flujo = self._flujo_esperado(futuro)
            prob = max(0.0, min(1.0, 1 - (flujo / 1800)))
            resultados.append({
                'timestamp': futuro.isoformat(),
                'flujo_estimado': int(flujo),
                'probabilidad_congestion': round(prob, 2)
            })
        return resultados