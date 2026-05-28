import React, { useState, useEffect } from 'react';
import Navbar from './components/Navbar';
import MapSection from './components/MapSection';
import NewsFeed from './components/NewsFeed';
import FotomultasTable from './components/FotomultasTable';

// --- DATOS DE PRUEBA CORREGIDOS ---
const mockZonasCriticas = [
  { id: 1, sector_geografico: "Autopista Norte - Cerca a la Terminal", latitud: 6.2750, longitud: -75.5650, total_accidentes: 150, total_lesionados: 110, total_fatalidades: 40, nivel_riesgo_predictivo: 88 },
  { id: 2, sector_geografico: "Avenida San Juan con la 65", latitud: 6.2485, longitud: -75.5790, total_accidentes: 120, total_lesionados: 95, total_fatalidades: 25, nivel_riesgo_predictivo: 74 },
  { id: 3, sector_geografico: "Avenida El Poblado - Sector Lleras", latitud: 6.2088, longitud: -75.5677, total_accidentes: 85, total_lesionados: 70, total_fatalidades: 15, nivel_riesgo_predictivo: 45 }
];

const mockNoticias = [
  {
    id: 1,
    titulo: "Colisión múltiple genera fuerte congestión en la Avenida Oriental",
    descripcion: "Un incidente que involucró a dos motocicletas y un autobús de servicio público dejó un saldo de dos heridos leves y parálisis total de la vía durante una hora en el centro de la ciudad.",
    imagen: "https://images.unsplash.com/photo-1518241353330-0f7941c2d9b5?auto=format&fit=crop&w=600&q=80",
    tipo_alerta_display: "Crítico"
  },
  {
    id: 2,
    titulo: "Instalan nuevos puntos de señalización previo a cámaras fijas",
    descripcion: "La Secretaría de Movilidad refuerza la señalización horizontal y vertical de velocidad máxima permitida (50 km/h) antes de las zonas de fotodetección crítica.",
    imagen: "https://images.unsplash.com/photo-1590674899484-d5640e854abe?auto=format&fit=crop&w=600&q=80",
    tipo_alerta_display: "Infraestructura"
  },
  {
    id: 3,
    titulo: "Disminución del 12% en atropellos gracias a campañas pedagógicas",
    descripcion: "El último balance del observatorio arroja cifras positivas respecto al comportamiento de los peatones en puentes viales de las calzadas principales de Medellín.",
    imagen: "https://images.unsplash.com/photo-1449965408869-eaa3f722e40d?auto=format&fit=crop&w=600&q=80",
    tipo_alerta_display: "Reporte"
  }
];

const mockInfracciones = [
  { id: 1, nombre_infraccion: "Exceso de Velocidad Detectado", codigo_simit: "C.29", advertencia_riesgo: "Conducir a velocidad superior a la permitida (50 km/h en avenidas principales, 30 km/h en zonas residenciales/escolares).", costo_cop: 650000 },
  { id: 2, nombre_infraccion: "No detención ante Luz Roja (Semáforo)", codigo_simit: "D.04", advertencia_riesgo: "Pasarse un semáforo en rojo o señal de PARE. Alta probabilidad de causar colisiones laterales de alto impacto.", costo_cop: 1300000 },
  { id: 3, nombre_infraccion: "Conducir en día de Pico y Placa", codigo_simit: "C.14", advertencia_riesgo: "Transitar por sitios prohibidos o en horas restringidas por la autoridad competente en Medellín.", costo_cop: 650000 },
  { id: 4, nombre_infraccion: "SOAT Vencido (Vía Fotodetección)", codigo_simit: "D.02", advertencia_riesgo: "No contar con el Seguro Obligatorio vigente. Implica la imposición de la multa económica de manera automatizada.", costo_cop: 1300000 }
];

function App() {
  const [zonasCriticas] = useState(mockZonasCriticas);
  const [noticias] = useState(mockNoticias);
  const [infracciones] = useState(mockInfracciones);
  const [estadisticas, setEstadisticas] = useState({ total: 0, lesionados: 0, fatalidades: 0 });

  useEffect(() => {
    if (zonasCriticas && zonasCriticas.length > 0) {
      const totalAcc = zonasCriticas.reduce((sum, z) => sum + (z.total_accidentes || 0), 0);
      const totalLes = zonasCriticas.reduce((sum, z) => sum + (z.total_lesionados || 0), 0);
      const totalFat = zonasCriticas.reduce((sum, z) => sum + (z.total_fatalidades || 0), 0);
      setEstadisticas({ total: totalAcc, lesionados: totalLes, fatalidades: totalFat });
    }
  }, [zonasCriticas]);

  return (
    <div className="bg-slate-100 min-h-screen font-sans antialiased text-slate-800">
      <Navbar />
      <main className="container mx-auto px-4 py-2">
        <MapSection zonasCriticas={zonasCriticas} estadisticas={estadisticas} />
        <NewsFeed noticias={noticias} />
        <FotomultasTable infracciones={infracciones} />
      </main>
      <footer className="bg-slate-900 text-slate-400 text-xs py-6 text-center border-t border-slate-800">
        <p>© 2026 OMV - Observatorio de Movilidad y Víctimas. Visualización en entorno local.</p>
      </footer>
    </div>
  );
}

export default App;