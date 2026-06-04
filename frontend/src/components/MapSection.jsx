import { useState, useEffect, useRef } from 'react';
import { MapContainer, TileLayer, Marker, Popup, Circle, useMapEvents } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import axios from 'axios';

// Fix iconos Leaflet
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon-2x.png',
  iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png',
});

const API_URL = 'http://localhost:8000/api';

// Datos históricos (mock)
const historicoPorSector = { 1: [38,42,45,40], 2: [30,35,32,38], 3: [20,22,25,28] };
const calcularRiesgo = (sector) => {
  if (!sector) return { esCritico: false };
  const historico = historicoPorSector[sector.id] || [0,0,0,0];
  const media = historico.reduce((a,b)=>a+b,0)/historico.length;
  const umbral = media * 1.25;
  const esCritico = sector.total_accidentes > umbral;
  return { esCritico, mediaHistorica: media.toFixed(1), umbralCritico: umbral.toFixed(1), porcentajeExceso: esCritico ? ((sector.total_accidentes - umbral)/umbral*100).toFixed(1) : 0 };
};

function MapSection({ onAddressSelect, zonasCriticas = [], estadisticas = {}, searchCoords = null, searchAddress = '', onClearSearch = null }) {
  const [heatmapData, setHeatmapData] = useState([]);
  const [selectedPosition, setSelectedPosition] = useState(null);
  const [prediction, setPrediction] = useState(null);
  const mapRef = useRef(null);

  // Cargar heatmap
  useEffect(() => {
    const fetchHeatmap = async () => {
      try {
        const res = await axios.get(`${API_URL}/heatmap/`);
        setHeatmapData(res.data);
      } catch (error) {
        console.error('Heatmap error, usando datos locales:', error);
        // Datos locales de ejemplo (círculos alrededor de Medellín)
        const mockHeat = [[6.2476,-75.5658,0.8],[6.255,-75.57,0.6],[6.24,-75.56,0.7]];
        setHeatmapData(mockHeat);
      }
    };
    fetchHeatmap();
    const interval = setInterval(fetchHeatmap, 30000);
    return () => clearInterval(interval);
  }, []);

  // Cuando se recibe una búsqueda de dirección
  useEffect(() => {
    if (searchCoords && mapRef.current) {
      // Centrar mapa
      mapRef.current.flyTo([searchCoords.lat, searchCoords.lng], 15);
      setSelectedPosition([searchCoords.lat, searchCoords.lng]);

      // Obtener predicción para esa coordenada
      const fetchPrediction = async () => {
        try {
          const res = await axios.post(`${API_URL}/predict/`, {
            sector_id: 1,
            address: searchAddress
          });
          // Verificar zona crítica cercana
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
          onAddressSelect(searchAddress, res.data);
        } catch (error) {
          console.error('Error predicción automática, usando mock:', error);
          // Respuesta mock para demostración
          const mockPred = {
            estado: "CONGESTIÓN MODERADA",
            probabilidad: 0.65,
            ventana: "2 horas",
            factores: "clima nublado, hora punta",
            recomendacion: "Precaución, posible tráfico moderado"
          };
          setPrediction(mockPred);
          onAddressSelect(searchAddress, mockPred);
        }
      };
      fetchPrediction();
      if (onClearSearch) onClearSearch();
    }
  }, [searchCoords, searchAddress, zonasCriticas, onAddressSelect, onClearSearch]);

  // Capturar clic en el mapa
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
          onAddressSelect(address, res.data);
        } catch (error) {
          console.error('Error en click, usando mock:', error);
          const mockPred = {
            estado: "LIBRE",
            probabilidad: 0.2,
            ventana: "4 horas",
            factores: "clima soleado, hora normal",
            recomendacion: "Tránsito normal"
          };
          setPrediction(mockPred);
          onAddressSelect(address, mockPred);
        }
      }
    });
    return null;
  }

  const getMarkerStyle = (zona) => {
    const riesgo = calcularRiesgo(zona);
    if (riesgo.esCritico) return { color: '#B91C1C', size: 46 };
    if (zona.nivel_riesgo === 'Alto') return { color: '#EF4444', size: 38 };
    if (zona.nivel_riesgo === 'Medio') return { color: '#EAB308', size: 32 };
    return { color: '#10B981', size: 28 };
  };

  return (
    <MapContainer ref={mapRef} center={[6.2476, -75.5658]} zoom={12} style={{ height: '100%', width: '100%' }} className="rounded-lg">
      <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" attribution='&copy; OpenStreetMap' />
      {heatmapData.map((point, idx) => (
        <Circle key={idx} center={[point[0], point[1]]} radius={80} pathOptions={{
          fillColor: `rgba(255, ${Math.floor(100*(1-point[2]))}, 0, ${0.3+point[2]*0.5})`,
          fillOpacity: 0.6, color: `rgba(255, ${Math.floor(150*(1-point[2]))}, 0, 0.9)`, weight: 1.5
        }} />
      ))}
      {zonasCriticas.map(zona => {
        const { color, size } = getMarkerStyle(zona);
        const riesgo = calcularRiesgo(zona);
        return (
          <Marker key={zona.id} position={[zona.latitud, zona.longitud]} icon={L.divIcon({
            html: `<svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="${color}" stroke="white"><path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7z"/><circle cx="12" cy="9" r="3" fill="white"/></svg>`,
            iconSize: [size, size], iconAnchor: [size/2, size]
          })}>
            <Popup><div><strong>{zona.nombre}</strong><br/>Riesgo: {zona.nivel_riesgo}<br/>Accidentes: {zona.total_accidentes}<br/>Media histórica: {riesgo.mediaHistorica}<br/>Crítica: {riesgo.esCritico ? 'Sí' : 'No'}</div></Popup>
          </Marker>
        );
      })}
      {selectedPosition && prediction && (
        <Marker position={selectedPosition}>
          <Popup>
            <strong>📍 Ubicación</strong><br/>
            Estado: {prediction.estado}<br/>
            Probabilidad: {(prediction.probabilidad*100).toFixed(0)}%<br/>
            Ventana: {prediction.ventana}<br/>
            Factores: {prediction.factores}<br/>
            {prediction.zona_critica && <span className="text-red-600">⚠️ Zona crítica: {prediction.zona_critica}</span>}
          </Popup>
        </Marker>
      )}
      <MapClickHandler />

      {/* Leyenda profesional sin emojis */}
<div className="absolute bottom-4 right-4 bg-white/90 backdrop-blur rounded-lg p-3 shadow-lg z-[1000] text-xs space-y-1">
  <div className="font-bold text-gray-800">Intensidad de Tráfico</div>
  <div className="flex items-center gap-2">
    <span className="w-3 h-3 bg-red-500 rounded-full"></span>
    <span>Alta (&gt;70%)</span>
  </div>
  <div className="flex items-center gap-2">
    <span className="w-3 h-3 bg-orange-400 rounded-full"></span>
    <span>Media (40-70%)</span>
  </div>
  <div className="flex items-center gap-2">
    <span className="w-3 h-3 bg-green-500 rounded-full"></span>
    <span>Baja (&lt;40%)</span>
  </div>
  <hr className="my-1" />
  <div className="font-bold text-gray-800">Riesgo Vial</div>
  <div className="flex items-center gap-2">
    <span className="w-4 h-4 bg-red-800 rounded-full animate-pulse"></span>
    <span>Zona Crítica (&gt;+25% media)</span>
  </div>
  <div className="flex items-center gap-2">
    <span className="w-4 h-4 bg-red-500 rounded-full"></span>
    <span>Riesgo Alto</span>
  </div>
  <div className="flex items-center gap-2">
    <span className="w-4 h-4 bg-yellow-500 rounded-full"></span>
    <span>Riesgo Medio</span>
  </div>
  <div className="flex items-center gap-2">
    <span className="w-4 h-4 bg-green-500 rounded-full"></span>
    <span>Riesgo Bajo</span>
  </div>
</div>

    </MapContainer>
  );
}

export default MapSection;