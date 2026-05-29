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

// ============================================================
// DATOS HISTÓRICOS SIMULADOS (últimos 4 trimestres)
// En producción, estos datos vendrían del backend
// ============================================================
const historicoPorSector = {
  1: [38, 42, 45, 40],
  2: [30, 35, 32, 38],
  3: [20, 22, 25, 28],
};

/**
 * Calcula si un sector es Zona Crítica según RN 1.2.1
 */
const calcularRiesgo = (sector) => {
  const historico = historicoPorSector[sector.id] || [0, 0, 0, 0];
  const mediaHistorica = historico.reduce((a, b) => a + b, 0) / historico.length;
  const umbralCritico = mediaHistorica * 1.25;
  const accidentesActual = sector.total_accidentes || 0;
  const esCritico = accidentesActual > umbralCritico;
  const porcentajeExceso = esCritico ? ((accidentesActual - umbralCritico) / umbralCritico) * 100 : 0;
  return {
    esCritico,
    mediaHistorica: mediaHistorica.toFixed(1),
    umbralCritico: umbralCritico.toFixed(1),
    porcentajeExceso: porcentajeExceso.toFixed(1),
  };
};

function MapSection({ 
  onAddressSelect, 
  zonasCriticas = [], 
  estadisticas = {}, 
  searchCoords = null, 
  searchAddress = '', 
  onClearSearch = null 
}) {
  const [heatmapData, setHeatmapData] = useState([]);
  const [selectedPosition, setSelectedPosition] = useState(null);
  const [prediction, setPrediction] = useState(null);
  const mapRef = useRef(null);

  // Cargar heatmap (simulado desde backend)
  useEffect(() => {
    const fetchHeatmap = async () => {
      try {
        const res = await axios.get(`${API_URL}/heatmap/`);
        setHeatmapData(res.data);
      } catch (error) {
        console.error('Error heatmap:', error);
      }
    };
    fetchHeatmap();
    const interval = setInterval(fetchHeatmap, 30000);
    return () => clearInterval(interval);
  }, []);

  // Centrar mapa cuando se recibe una dirección desde el asistente IA
  useEffect(() => {
    if (searchCoords && mapRef.current) {
      mapRef.current.flyTo([searchCoords.lat, searchCoords.lng], 15);
      setSelectedPosition([searchCoords.lat, searchCoords.lng]);
      
      const fetchPredictionForAddress = async () => {
        try {
          const res = await axios.post(`${API_URL}/predict/`, {
            sector_id: 1,
            address: searchAddress
          });
          const zonaCritica = zonasCriticas.find(zona => {
            const dist = Math.sqrt(
              Math.pow((zona.latitud || 0) - searchCoords.lat, 2) +
              Math.pow((zona.longitud || 0) - searchCoords.lng, 2)
            );
            return dist < 0.01;
          });
          if (zonaCritica) {
            res.data.zona_critica = zonaCritica.nombre || zonaCritica.sector_geografico;
            res.data.nivel_riesgo = zonaCritica.nivel_riesgo;
            const riesgo = calcularRiesgo(zonaCritica);
            res.data.riesgo_critico = riesgo.esCritico;
            res.data.media_historica = riesgo.mediaHistorica;
            res.data.umbral_critico = riesgo.umbralCritico;
            res.data.exceso_porcentaje = riesgo.porcentajeExceso;
          }
          setPrediction(res.data);
          onAddressSelect(searchAddress, res.data);
        } catch (error) {
          console.error('Error en predicción automática:', error);
        }
      };
      fetchPredictionForAddress();
      
      if (onClearSearch) onClearSearch();
    }
  }, [searchCoords, searchAddress, zonasCriticas, onAddressSelect, onClearSearch]);

  // Capturar clic en el mapa
  function MapClickHandler() {
    useMapEvents({
      async click(e) {
        const { lat, lng } = e.latlng;
        const address = `${lat.toFixed(4)}, ${lng.toFixed(4)}`;
        setSelectedPosition([lat, lng]);
        try {
          const res = await axios.post(`${API_URL}/predict/`, {
            sector_id: 1,
            address: address,
          });
          const zonaCritica = zonasCriticas.find((zona) => {
            const dist = Math.sqrt(
              Math.pow((zona.latitud || 0) - lat, 2) +
              Math.pow((zona.longitud || 0) - lng, 2)
            );
            return dist < 0.01;
          });
          if (zonaCritica) {
            res.data.zona_critica = zonaCritica.nombre || zonaCritica.sector_geografico;
            res.data.nivel_riesgo = zonaCritica.nivel_riesgo;
            const riesgo = calcularRiesgo(zonaCritica);
            res.data.riesgo_critico = riesgo.esCritico;
            res.data.media_historica = riesgo.mediaHistorica;
            res.data.umbral_critico = riesgo.umbralCritico;
            res.data.exceso_porcentaje = riesgo.porcentajeExceso;
          }
          setPrediction(res.data);
          onAddressSelect(address, res.data);
        } catch (error) {
          console.error('Error predicción:', error);
        }
      },
    });
    return null;
  }

  const getMarkerStyle = (zona) => {
    const riesgo = calcularRiesgo(zona);
    if (riesgo.esCritico) {
      return { color: '#B91C1C', size: 46, pulsante: true };
    }
    if (zona.nivel_riesgo === 'Alto') return { color: '#EF4444', size: 38, pulsante: false };
    if (zona.nivel_riesgo === 'Medio') return { color: '#EAB308', size: 32, pulsante: false };
    return { color: '#10B981', size: 28, pulsante: false };
  };

  return (
    <MapContainer
      ref={mapRef}
      center={[6.2476, -75.5658]}
      zoom={12}
      style={{ height: '100%', width: '100%' }}
      className="rounded-lg"
    >
      <TileLayer
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
      />

      {/* Círculos de calor */}
      {heatmapData.map((point, idx) => (
        <Circle
          key={idx}
          center={[point[0], point[1]]}
          radius={80}
          pathOptions={{
            fillColor: `rgba(255, ${Math.floor(100 * (1 - point[2]))}, 0, ${0.3 + point[2] * 0.5})`,
            fillOpacity: 0.6,
            color: `rgba(255, ${Math.floor(150 * (1 - point[2]))}, 0, 0.9)`,
            weight: 1.5,
          }}
        />
      ))}

      {/* Marcadores de zonas de riesgo */}
      {zonasCriticas.map((zona) => {
        const { color, size, pulsante } = getMarkerStyle(zona);
        const riesgo = calcularRiesgo(zona);
        return (
          <Marker
            key={zona.id}
            position={[zona.latitud, zona.longitud]}
            icon={L.divIcon({
              html: `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 24 24" fill="${color}" stroke="white" stroke-width="2"><path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7z"/><circle cx="12" cy="9" r="3" fill="white"/></svg>`,
              className: `custom-marker ${pulsante ? 'pulsante' : ''}`,
              iconSize: [size, size],
              iconAnchor: [size / 2, size],
            })}
          >
            <Popup>
              <div className="p-2 min-w-[240px]">
                <h3 className="font-bold text-gray-800">{zona.nombre || zona.sector_geografico}</h3>
                <p className="text-sm text-red-600">Nivel de riesgo: {zona.nivel_riesgo}</p>
                <p>🚗 Accidentes actuales: <strong>{zona.total_accidentes}</strong></p>
                <p>📊 Media histórica (4 trimestres): {riesgo.mediaHistorica}</p>
                <p>⚠️ Umbral crítico (+25%): {riesgo.umbralCritico}</p>
                {riesgo.esCritico && (
                  <div className="mt-2 p-2 bg-red-100 border border-red-500 rounded">
                    <span className="font-bold text-red-700">🔴 ZONA CRÍTICA ACTIVA</span><br />
                    Excede el umbral en <strong>{riesgo.porcentajeExceso}%</strong>
                  </div>
                )}
                <p className="text-xs text-gray-500 mt-2">
                  🚑 Lesionados: {zona.total_lesionados} | ⚰️ Fatalidades: {zona.total_fatalidades}
                </p>
              </div>
            </Popup>
          </Marker>
        );
      })}

      {/* Marcador del punto seleccionado (clic o búsqueda) */}
      {selectedPosition && prediction && (
        <Marker position={selectedPosition}>
          <Popup>
            <div className="p-2">
              <strong>📍 Ubicación seleccionada</strong><br />
              Estado: {prediction.estado}<br />
              Prob: {(prediction.probabilidad * 100).toFixed(0)}%<br />
              {prediction.zona_critica && (
                <>
                  <span className="text-red-600 font-bold">⚠️ {prediction.zona_critica}</span>
                  {prediction.riesgo_critico && (
                    <div className="text-xs mt-1">
                      Excede media histórica en {prediction.exceso_porcentaje}%
                    </div>
                  )}
                </>
              )}
            </div>
          </Popup>
        </Marker>
      )}

      <MapClickHandler />

      {/* Leyenda */}
      <div className="absolute bottom-4 right-4 bg-white/90 backdrop-blur rounded-lg shadow-lg p-3 z-[1000] text-xs space-y-1">
        <div className="font-bold mb-1">🚦 Intensidad Tráfico</div>
        <div className="flex items-center gap-2"><div className="w-3 h-3 bg-red-500 rounded-full"></div> Alta (&gt;70%)</div>
        <div className="flex items-center gap-2"><div className="w-3 h-3 bg-orange-400 rounded-full"></div> Media (40-70%)</div>
        <div className="flex items-center gap-2"><div className="w-3 h-3 bg-green-500 rounded-full"></div> Baja (&lt;40%)</div>
        <hr className="my-1" />
        <div className="font-bold mt-1">⚠️ Riesgo Vial (RF 1.2.1)</div>
        <div className="flex items-center gap-2"><div className="w-4 h-4 bg-red-800 rounded-full animate-pulse"></div> Zona Crítica (supera +25% media)</div>
        <div className="flex items-center gap-2"><div className="w-4 h-4 bg-red-500 rounded-full"></div> Riesgo Alto</div>
        <div className="flex items-center gap-2"><div className="w-4 h-4 bg-yellow-500 rounded-full"></div> Riesgo Medio</div>
        <div className="flex items-center gap-2"><div className="w-4 h-4 bg-green-500 rounded-full"></div> Riesgo Bajo</div>
      </div>
    </MapContainer>
  );
}

export default MapSection;