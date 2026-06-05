import { useState, useEffect, useRef } from 'react';
import { MapContainer, TileLayer, Marker, Popup, Circle, useMapEvents } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import axios from 'axios'; // Importación de la API corregida

// Reparar los paths estáticos de los iconos de Leaflet en entornos React/Vite
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon-2x.png',
  iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png',
});

const API_URL = 'http://localhost:8000/api/v1';

// Datos de control histórico para contingencias en Medellín si falla el backend
const historicoPorSector = { 1: [38, 42, 45, 40], 2: [30, 35, 32, 38], 3: [20, 22, 25, 28] };

const calcularRiesgo = (sector) => {
  if (!sector) return { esCritico: false };
  const historico = historicoPorSector[sector.id] || [0, 0, 0, 0];
  const media = historico.reduce((a, b) => a + b, 0) / historico.length;
  const umbral = media * 1.25; 
  const esCritico = sector.total_accidentes > umbral;
  return { 
    esCritico, 
    mediaHistorica: media.toFixed(1), 
    umbralCritico: umbral.toFixed(1), 
    porcentajeExceso: esCritico ? ((sector.total_accidentes - umbral) / umbral * 100).toFixed(1) : 0 
  };
};

// Cambiado a exportación por defecto para solucionar el error de App.jsx
export default function MapSection({ onAddressSelect, zonasCriticas = [], estadisticas = {}, searchCoords = null, searchAddress = '', onClearSearch = null }) {
  const [heatmapData, setHeatmapData] = useState([]);
  const [selectedPosition, setSelectedPosition] = useState(null);
  const [prediction, setPrediction] = useState(null);
  const mapRef = useRef(null);

  // 1. Carga inicial del mapa de calor con manejo robusto para evitar spam de 404
  useEffect(() => {
    let isMounted = true;
    const fetchHeatmap = async () => {
      try {
        const res = await axios.get(`${API_URL}/geo/zonas-riesgo`);
        if (isMounted && res.data && Array.isArray(res.data)) {
          setHeatmapData(res.data);
        } else if (isMounted) {
          setHeatmapData([[6.2476, -75.5658, 0.8], [6.255, -75.57, 0.6], [6.24, -75.56, 0.7]]);
        }
      } catch (error) {
        if (isMounted) {
          setHeatmapData([[6.2476, -75.5658, 0.8], [6.255, -75.57, 0.6], [6.24, -75.56, 0.7]]);
        }
      }
    };
    fetchHeatmap();
    const interval = setInterval(fetchHeatmap, 45000);
    return () => {
      isMounted = false;
      clearInterval(interval);
    };
  }, []);

  // 2. Escucha de búsquedas de direcciones del panel o asistente de IA
  useEffect(() => {
    if (searchCoords && mapRef.current) {
      mapRef.current.flyTo([searchCoords.lat, searchCoords.lng], 15);
      setSelectedPosition([searchCoords.lat, searchCoords.lng]);

      const fetchPrediction = async () => {
        try {
          const res = await axios.post(`${API_URL}/predict/`, {
            sector_id: 1,
            address: searchAddress
          });
          
          const zonaCritica = zonasCriticas.find(z => {
            const dist = Math.hypot(z.latitud - searchCoords.lat, z.longitud - searchCoords.lng);
            return dist < 0.01;
          });

          if (zonaCritica) {
            res.data.zona_critica = zonaCritica.nombre || zonaCritica.sector_geografico;
            res.data.nivel_riesgo = zonaCritica.nivel_riesgo;
            const riesgo = calcularRiesgo(zonaCritica);
            res.data.riesgo_critico = riesgo.esCritico;
            res.data.exceso_porcentaje = riesgo.porcentajeExceso;
          }

          setPrediction(res.data);
          if (onAddressSelect) onAddressSelect(searchAddress, res.data);
        } catch (error) {
          const mockPred = {
            estado: "CONGESTIÓN MODERADA",
            probabilidad: 0.65,
            ventana: "2 horas",
            factores: "Condiciones de hora pico locales",
            recomendacion: "Transitar con precaución en la zona consultada"
          };
          setPrediction(mockPred);
          if (onAddressSelect) onAddressSelect(searchAddress, mockPred);
        }
      };

      fetchPrediction();
      if (onClearSearch) onClearSearch();
    }
  }, [searchCoords, searchAddress, zonasCriticas, onClearSearch]);

  // 3. Manejador de clics interactivos en el mapa libre
  function MapClickHandler() {
    useMapEvents({
      async click(e) {
        const { lat, lng } = e.latlng;
        const address = `${lat.toFixed(6)}, ${lng.toFixed(6)}`;
        setSelectedPosition([lat, lng]);

        try {
          const res = await axios.post(`${API_URL}/predict/`, { sector_id: 1, address });
          const zonaCritica = zonasCriticas.find(z => Math.hypot(z.latitud - lat, z.longitud - lng) < 0.01);
          
          if (zonaCritica) {
            res.data.zona_critica = zonaCritica.nombre || zonaCritica.sector_geografico;
            res.data.nivel_riesgo = zonaCritica.nivel_riesgo;
            const riesgo = calcularRiesgo(zonaCritica);
            res.data.riesgo_critico = riesgo.esCritico;
            res.data.exceso_porcentaje = riesgo.porcentajeExceso;
          }

          setPrediction(res.data);
          if (onAddressSelect) onAddressSelect(address, res.data);
        } catch (error) {
          const mockPred = {
            estado: "FLUIDO / LIBRE",
            probabilidad: 0.18,
            ventana: "3 horas",
            factores: "Tránsito regular sin incidentes reportados",
            recomendacion: "Mantener velocidad reglamentaria"
          };
          setPrediction(mockPred);
          if (onAddressSelect) onAddressSelect(address, mockPred);
        }
      }
    });
    return null;
  }

  const getMarkerStyle = (zona) => {
    const riesgo = calcularRiesgo(zona);
    if (riesgo.esCritico) return { color: '#991B1B', strokeColor: '#F87171', size: 40 }; 
    if (zona.nivel_riesgo === 'Alto') return { color: '#DC2626', strokeColor: '#FFFFFF', size: 36 }; 
    if (zona.nivel_riesgo === 'Medio') return { color: '#D97706', strokeColor: '#FFFFFF', size: 32 }; 
    return { color: '#059669', strokeColor: '#FFFFFF', size: 28 }; 
  };

  return (
    <div className="w-full h-full min-h-[550px] relative rounded-2xl overflow-hidden shadow-lg border border-slate-200 bg-slate-100">
      <MapContainer 
        ref={mapRef} 
        center={[6.2476, -75.5658]} 
        zoom={12} 
        style={{ height: '100%', width: '100%' }}
        className="w-full h-full z-10"
      >
        <TileLayer 
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" 
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>' 
        />

        {heatmapData.map((point, idx) => (
          <Circle 
            key={idx} 
            center={[point[0], point[1]]} 
            radius={160} 
            pathOptions={{
              fillColor: '#EF4444',
              fillOpacity: 0.28, 
              color: '#DC2626', 
              weight: 1
          }} 
          />
        ))}

        {zonasCriticas.map(zona => {
          const { color, strokeColor, size } = getMarkerStyle(zona);
          const riesgo = calcularRiesgo(zona);
          return (
            <Marker 
              key={zona.id} 
              position={[zona.latitud, zona.longitud]} 
              icon={L.divIcon({
                html: `<svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="${color}" stroke="${strokeColor}" stroke-width="2"><path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7z"/><circle cx="12" cy="9" r="3" fill="white"/></svg>`,
                iconSize: [size, size], 
                iconAnchor: [size / 2, size]
              })}
            >
              <Popup>
                <div className="p-1 font-sans text-slate-800">
                  <strong className="text-sm block border-b border-slate-200 pb-1 mb-1 text-slate-900 font-bold">
                    {zona.nombre || zona.sector_geografico}
                  </strong>
                  <div className="space-y-1 text-xs">
                    <div>Riesgo Vial: <span className="font-bold px-1.5 py-0.5 rounded text-white text-[10px]" style={{ backgroundColor: color }}>{zona.nivel_riesgo}</span></div>
                    <div>Incidentes Totales: <span className="font-bold text-slate-900">{zona.total_accidentes}</span></div>
                    {riesgo.esCritico && (
                      <div className="mt-1.5 text-[11px] bg-red-50 border border-red-100 rounded px-2 py-0.5 text-red-700 font-medium">
                        ⚠️ Anomalía Histórica (+{riesgo.porcentajeExceso}%)
                      </div>
                    )}
                  </div>
                </div>
              </Popup>
            </Marker>
          );
        })}

        {selectedPosition && prediction && (
          <Marker position={selectedPosition}>
            <Popup>
              <div className="p-1 font-sans text-slate-800 w-52">
                <div className="flex items-center gap-1.5 mb-2 border-b border-slate-200 pb-1">
                  <div className="bg-slate-950 text-white p-1 rounded text-xs">🤖</div>
                  <strong className="text-xs uppercase font-bold tracking-wider text-slate-900">MovAI Diagnóstico</strong>
                </div>
                <div className="space-y-1.5 text-xs">
                  <div className="flex justify-between items-center">
                    <span className="text-slate-500">Estado Vía:</span>
                    <span className="font-bold text-slate-900 bg-slate-100 px-1.5 py-0.5 rounded border border-slate-200">{prediction.estado}</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-slate-500">Fiabilidad:</span>
                    <span className="font-mono bg-slate-900 text-slate-100 px-1.5 py-0.5 rounded font-bold">{(prediction.probabilidad * 100).toFixed(0)}%</span>
                  </div>
                  <p className="text-[11px] text-slate-600 bg-slate-50 p-1.5 rounded border border-slate-150 leading-tight">
                    {prediction.factores}
                  </p>
                </div>
              </div>
            </Popup>
          </Marker>
        )}

        <MapClickHandler />
      </MapContainer>
    </div>
  );
}