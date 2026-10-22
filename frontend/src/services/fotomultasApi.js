// Simulación de API en tiempo real para fotomultas
// En producción, reemplazar por fetch a tu backend real

const FOTOMULTAS_BASE = [
  { id: 1, tipo: 'Exceso de Velocidad Detectado', codigo: 'C.29', criterio: 'Conducir a velocidad superior a la permitida en vías urbanas (más de 60 km/h)', costo: 650000, categoria: 'velocidad', icono: '⚡' },
  { id: 2, tipo: 'No detención ante Luz Roja (Semáforo)', codigo: 'D.04', criterio: 'Pasar un semáforo en rojo sin detenerse completamente', costo: 1300000, categoria: 'semaforo', icono: '🚦' },
  { id: 3, tipo: 'Conducir en día de Pico y Placa', codigo: 'C.14', criterio: 'Transitar por sitios prohibidos durante restricción vehicular', costo: 650000, categoria: 'pico_placa', icono: '🚫' },
  { id: 4, tipo: 'SOAT Vencido (Vía Fotodetección)', codigo: 'D.02', criterio: 'No contar con el Seguro Obligatorio de Accidentes de Tránsito vigente', costo: 1300000, categoria: 'soat', icono: '📄' },
  { id: 5, tipo: 'Exceso de Velocidad en Vía Rural', codigo: 'C.30', criterio: 'Conducir a velocidad superior a 80 km/h en corredores rurales', costo: 975000, categoria: 'velocidad', icono: '⚡' },
  { id: 6, tipo: 'Invadir Carril de TransMilenio', codigo: 'C.18', criterio: 'Circular por carriles exclusivos de sistema de transporte masivo', costo: 845000, categoria: 'carril', icono: '🚌' },
];

// Simular variaciones en tiempo real (costos que cambian, nuevas infracciones)
export async function getFotomultasRealtime() {
  // Simular delay de red
  await new Promise(r => setTimeout(r, 300));
  
  const now = new Date();
  const horaPico = now.getHours() >= 7 && now.getHours() <= 9 || now.getHours() >= 17 && now.getHours() <= 19;
  
  // Variar costos según hora del día (simulando dinamismo)
  const factorHora = horaPico ? 1.0 : 0.95; // Descuento por horas valle
  
  // Simular descuento por pronto pago (48 horas)
  const descuentoProntoPago = 0.5;
  
  return FOTOMULTAS_BASE.map(f => ({
    ...f,
    costoActual: Math.round(f.costo * factorHora),
    costoConDescuento: Math.round(f.costo * factorHora * descuentoProntoPago),
    fechaActualizacion: now.toISOString(),
    esHoraPico: horaPico,
    vigente: true,
  }));
}

// WebSocket simulado para actualizaciones en tiempo real
export function subscribeFotomultas(callback, interval = 30000) {
  // Llamada inicial
  getFotomultasRealtime().then(callback);
  
  // Actualizaciones periódicas
  const id = setInterval(() => {
    getFotomultasRealtime().then(data => {
      // Simular cambios aleatorios
      const variacion = Math.random() > 0.7; // 30% de probabilidad de cambio
      if (variacion) {
        data[0].costoActual = Math.round(data[0].costoActual * (0.95 + Math.random() * 0.1));
      }
      callback(data);
    });
  }, interval);
  
  return () => clearInterval(id);
}