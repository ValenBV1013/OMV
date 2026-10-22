import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import Navbar from '../components/Navbar';
import MapSection from '../components/MapSection';
import AIAssistant from '../components/AIAssistant';

import imgVarianteCaldas from '../assets/variante_caldas.png';
import imgSanJuan from '../assets/accidente_san_juan.png';
import imgTunelOriente from '../assets/tunel_oriente.png';

const mockZonasCriticas = [
  { id: 1, sector_geografico: "Autopista Norte - Cerca a la Terminal", latitud: 6.2750, longitud: -75.5650, total_accidentes: 150, total_lesionados: 110, total_fatalidades: 40, nivel_riesgo_predictivo: 88, nombre: "Autopista Norte", nivel_riesgo: "Alto" },
  { id: 2, sector_geografico: "Avenida San Juan con la 65",            latitud: 6.2485, longitud: -75.5790, total_accidentes: 120, total_lesionados: 95,  total_fatalidades: 25, nivel_riesgo_predictivo: 74, nombre: "Avenida San Juan", nivel_riesgo: "Alto" },
  { id: 3, sector_geografico: "Avenida El Poblado - Sector Lleras",    latitud: 6.2088, longitud: -75.5677, total_accidentes: 85,  total_lesionados: 70,  total_fatalidades: 15, nivel_riesgo_predictivo: 45, nombre: "Avenida El Poblado", nivel_riesgo: "Medio" },
];
const NOTICIAS = [
  { id:'fb-1', titulo:'En la variante a Caldas van nueve muertos', descripcion:'Corredor vial más letal...', imagen:imgVarianteCaldas, tipo_alerta_display:'Crítico', url:'#' },
  { id:'fb-2', titulo:'Un motociclista y un peatón muertos',        descripcion:'Nuevas fatalidades...',    imagen:imgSanJuan,        tipo_alerta_display:'Crítico', url:'#' },
  { id:'fb-3', titulo:'Choque en el Túnel de Oriente',              descripcion:'Accidente registrado...',  imagen:imgTunelOriente,   tipo_alerta_display:'Crítico', url:'#' },
];

export default function MapPage() {
  const navigate = useNavigate();
  const [selectedAddress, setSelectedAddress] = useState('');
  const [prediction,      setPrediction]      = useState(null);
  const [searchCoords,    setSearchCoords]    = useState(null);
  const [searchAddress,   setSearchAddress]   = useState('');
  const estadisticas = { total: 355, lesionados: 275, fatalidades: 80 };

  const handleSetVista = (vista) => {
    if (vista === 'estadisticas') navigate('/');
    else navigate(`/${vista}`);
  };

  return (
    <div className="bg-slate-900 min-h-screen flex flex-col text-slate-100">
      <Navbar setVista={handleSetVista} />

      <main className="flex-1 relative w-full overflow-hidden" style={{ height:'calc(100vh - 72px)' }}>
        <div className="absolute inset-0 z-0">
          <MapSection
            onAddressSelect={(addr, pred) => { setSelectedAddress(addr); setPrediction(pred); }}
            zonasCriticas={mockZonasCriticas}
            estadisticas={estadisticas}
            searchCoords={searchCoords}
            searchAddress={searchAddress}
            onClearSearch={() => setSearchCoords(null)}
          />
        </div>

        <div className="absolute top-4 right-4 bottom-20 z-10 w-96 flex flex-col pointer-events-auto">
          <div className="flex-1 bg-slate-950/85 backdrop-blur-md border border-slate-700/70 rounded-xl shadow-2xl overflow-hidden flex flex-col p-4">
            <AIAssistant
              address={selectedAddress}
              prediction={prediction}
              zonasCriticas={mockZonasCriticas}
              noticias={NOTICIAS}
              onSearchAddress={(addr, coords) => { setSearchAddress(addr); setSearchCoords(coords); }}
            />
          </div>
        </div>

        <div className="absolute bottom-4 left-4 right-104 z-10 bg-slate-950/90 backdrop-blur-md text-slate-300 rounded-xl px-5 py-3 shadow-2xl border border-slate-700/60 pointer-events-auto">
          <div className="flex flex-wrap items-center gap-6 text-[11px] font-medium tracking-wide">
            <span className="text-slate-500 font-bold tracking-widest uppercase border-r border-slate-800 pr-5">• LEYENDA</span>
            <div className="flex items-center gap-4 border-r border-slate-800 pr-5">
              <span className="text-slate-400 font-bold uppercase text-[10px]">Tráfico</span>
              {[['bg-red-500','Alta'],['bg-amber-500','Media'],['bg-emerald-500','Baja']].map(([c,l]) => (
                <div key={l} className="flex items-center gap-1.5"><span className={`w-2.5 h-2.5 ${c} rounded-full`}/><span>{l}</span></div>
              ))}
            </div>
            <div className="flex items-center gap-4">
              <span className="text-slate-400 font-bold uppercase text-[10px]">Riesgo Vial</span>
              <div className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 bg-red-900 rounded-full border border-red-500/50 animate-pulse"/><span className="text-red-400 font-medium">Crítica</span></div>
              {[['bg-red-500','Alto'],['bg-amber-500','Medio'],['bg-emerald-500','Bajo']].map(([c,l]) => (
                <div key={l} className="flex items-center gap-1.5"><span className={`w-2.5 h-2.5 ${c} rounded-full`}/><span>{l}</span></div>
              ))}
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}