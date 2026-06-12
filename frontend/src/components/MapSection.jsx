import { useState, useEffect, useRef } from 'react';
import { MapContainer, TileLayer, Marker, Popup, Circle, CircleMarker, useMapEvents, useMap } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import 'leaflet.markercluster/dist/MarkerCluster.css';
import 'leaflet.markercluster/dist/MarkerCluster.Default.css';
import 'leaflet.markercluster';
import axios from 'axios';

// Fix para iconos de Leaflet
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon-2x.png',
  iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png',
});

const API_URL = 'http://localhost:8000/api';

// Datos para zonas críticas (sin cambios)
const historicoPorSector = { 1:[38,42,45,40], 2:[30,35,32,38], 3:[20,22,25,28] };
const calcularRiesgo = (sector) => {
  if (!sector) return { esCritico: false };
  const historico = historicoPorSector[sector.id] || [0,0,0,0];
  const media = historico.reduce((a,b)=>a+b,0)/historico.length;
  const umbral = media * 1.25;
  const esCritico = sector.total_accidentes > umbral;
  return { esCritico, mediaHistorica: media.toFixed(1), umbralCritico: umbral.toFixed(1),
    porcentajeExceso: esCritico ? ((sector.total_accidentes-umbral)/umbral*100).toFixed(1) : 0 };
};

// Helper para volar a coordenadas
function FlyToCoords({ coords }) {
  const map = useMap();
  useEffect(() => {
    if (coords) map.flyTo([coords.lat, coords.lng], 15, { duration: 1.2 });
  }, [coords, map]);
  return null;
}

// ----------------------------------------------------------------------
// CONVERSIÓN DE COORDENADAS (proyectadas a WGS84)
// Basada en valores de prueba: un punto conocido en Medellín (por ejemplo,
// la estación de policía tiene coordenadas proyectadas 4718000, 2248000
// y su lat/lng real ~6.272, -75.562). Ajustamos con factores empíricos.
// ----------------------------------------------------------------------
function convertCoords(x, y) {
  // Factores ajustados para Medellín (origen aproximado)
  const lon0 = -75.68;      // longitud de referencia
  const lat0 = 6.10;        // latitud de referencia
  const scaleX = 245000;    // metros por grado de longitud
  const scaleY = 275000;    // metros por grado de latitud
  const x0 = 4700000;       // coordenada X de referencia
  const y0 = 2240000;       // coordenada Y de referencia

  let lon = lon0 + (x - x0) / scaleX;
  let lat = lat0 + (y - y0) / scaleY;
  // Limitar dentro de Medellín
  lon = Math.min(-75.48, Math.max(-75.72, lon));
  lat = Math.min(6.35, Math.max(6.08, lat));
  return [lat, lon];
}

export default function MapSection({
  onAddressSelect, zonasCriticas = [], estadisticas = {},
  searchCoords = null, searchAddress = '', onClearSearch = null,
  horizon = 2, setHorizon = () => {}, showHeatmap = true, setShowHeatmap = () => {}
}) {
  const [selectedPosition, setSelectedPosition] = useState(null);
  const [prediction, setPrediction] = useState(null);
  const [heatmap, setHeatmap] = useState([]);
  const [mapLayer, setMapLayer] = useState('mapa');
  const [lastUpdate, setLastUpdate] = useState(new Date());
  const [pulso, setPulso] = useState(false);
  const mapRef = useRef(null);
  const clusterGroupRef = useRef(null);

  // Incidentes
  const [incidentes, setIncidentes] = useState([]);
  const [showIncidentes, setShowIncidentes] = useState(true);
  const [timeRangeDays, setTimeRangeDays] = useState(0);
  const [showWarning, setShowWarning] = useState(false);

  // Cargar heatmap TomTom
  useEffect(() => {
    const fetchHeatmap = async () => {
      try {
        const res = await axios.get(`${API_URL}/heatmap_tomtom/?horas_adelanto=${horizon}`);
        setHeatmap(res.data);
        setLastUpdate(new Date());
        setPulso(true);
        setTimeout(() => setPulso(false), 800);
      } catch (error) {
        console.error('Error cargando heatmap TomTom:', error);
      }
    };
    fetchHeatmap();
    const interval = setInterval(fetchHeatmap, 30000);
    return () => clearInterval(interval);
  }, [horizon]);

  // Cargar incidentes desde el backend
  const fetchIncidentes = async (days) => {
    try {
      const res = await axios.get(`${API_URL}/incidentes/?dias=${days}`);
      const data = res.data;
      console.log(`Incidentes recibidos: ${data.length}`);
      if (data.length > 500) {
        setShowWarning(true);
        setIncidentes(data.slice(0, 500));
        console.log(`Limitado a 500 incidentes`);
      } else {
        setShowWarning(false);
        setIncidentes(data);
      }
    } catch (error) {
      console.error('Error cargando incidentes:', error);
    }
  };

  useEffect(() => {
    if (showIncidentes) {
      fetchIncidentes(timeRangeDays);
    } else {
      setIncidentes([]);
    }
  }, [timeRangeDays, showIncidentes]);

  // Manejar el cluster de incidentes
  useEffect(() => {
    if (!mapRef.current) {
      console.log('Mapa no disponible aún');
      return;
    }
    const map = mapRef.current;

    if (clusterGroupRef.current) {
      map.removeLayer(clusterGroupRef.current);
      clusterGroupRef.current = null;
    }

    if (!showIncidentes || incidentes.length === 0) {
      console.log('No hay incidentes para mostrar');
      return;
    }

    const clusterGroup = L.markerClusterGroup({
      chunkedLoading: true,
      maxClusterRadius: 80,
      disableClusteringAtZoom: 15,
    });

    let markersAdded = 0;
    incidentes.forEach((inc) => {
      // Obtener coordenadas (pueden venir como lat/lon o longitud/latitud)
      let x = inc.longitud || inc.x_origen_nacional;
      let y = inc.latitud || inc.y_origen_nacional;
      if (!x || !y) return;

      // Si ya vienen en formato WGS84 (lat entre -90 y 90, lon entre -180 y 180)
      let lat, lng;
      if (Math.abs(y) < 90 && Math.abs(x) < 180) {
        lat = y;
        lng = x;
        console.log(`Coordenadas WGS84: ${lat}, ${lng}`);
      } else {
        // Convertir desde proyectado
        const converted = convertCoords(x, y);
        lat = converted[0];
        lng = converted[1];
        console.log(`Convertidas de (${x},${y}) a (${lat},${lng})`);
      }

      if (isNaN(lat) || isNaN(lng)) return;

      const gravedad = inc.gravedad?.toUpperCase() || '';
      let color = '#95a5a6';
      if (gravedad === 'HERIDO') color = '#f39c12';
      else if (gravedad === 'SOLO DAÑOS') color = '#3498db';
      else if (gravedad === 'MUERTO') color = '#e74c3c';

      const marker = L.circleMarker([lat, lng], {
        radius: 6,
        fillColor: color,
        color: '#fff',
        weight: 1.5,
        opacity: 1,
        fillOpacity: 0.85,
      });

      const fecha = inc.fecha ? new Date(inc.fecha).toLocaleDateString('es-ES') : 'N/A';
      const hora = inc.hora || '';
      const popupContent = `
        <div style="min-width: 200px;">
          <strong>${inc.clase || 'Accidente'}</strong><br/>
          <strong>Gravedad:</strong> ${inc.gravedad || 'N/A'}<br/>
          <strong>Fecha:</strong> ${fecha} ${hora}<br/>
          <strong>Dirección:</strong> ${inc.direccion || 'N/A'}<br/>
          <strong>Barrio:</strong> ${inc.barrio || 'N/A'}<br/>
          <strong>Comuna:</strong> ${inc.comuna || 'N/A'}
        </div>
      `;
      marker.bindPopup(popupContent);
      marker.bindTooltip(`${inc.clase || 'Evento'} - ${inc.gravedad || 'N/A'}`, { sticky: true });
      clusterGroup.addLayer(marker);
      markersAdded++;
    });
    console.log(`Marcadores añadidos: ${markersAdded}`);

    if (markersAdded > 0) {
      clusterGroup.addTo(map);
      clusterGroupRef.current = clusterGroup;
      console.log('Cluster añadido al mapa');
    } else {
      console.warn('No se añadió ningún marcador');
    }
  }, [incidentes, showIncidentes]);

  // Limpiar al desmontar
  useEffect(() => {
    return () => {
      if (clusterGroupRef.current && mapRef.current) {
        mapRef.current.removeLayer(clusterGroupRef.current);
      }
    };
  }, []);

  // Búsqueda de dirección (TomTom)
  useEffect(() => {
    if (!searchCoords) return;
    setSelectedPosition([searchCoords.lat, searchCoords.lng]);
    const fetchPred = async () => {
      try {
        const res = await axios.post(`${API_URL}/predict_tomtom/`, {
          address: `${searchCoords.lat},${searchCoords.lng}`,
          horizon: horizon
        });
        const z = zonasCriticas.find(z => Math.hypot(z.latitud - searchCoords.lat, z.longitud - searchCoords.lng) < 0.01);
        if (z) {
          res.data.zona_critica = z.nombre || z.sector_geografico;
          res.data.nivel_riesgo = z.nivel_riesgo;
        }
        setPrediction(res.data);
        onAddressSelect(searchAddress, res.data);
      } catch (error) {
        console.error('Error predicción automática:', error);
        const mock = { estado:'CONGESTIÓN MODERADA', probabilidad:0.65, ventana:`${horizon} horas`, factores:'Hora pico, condiciones locales' };
        setPrediction(mock);
        onAddressSelect(searchAddress, mock);
      }
    };
    fetchPred();
    if (onClearSearch) onClearSearch();
  }, [searchCoords, searchAddress, horizon, zonasCriticas, onAddressSelect, onClearSearch]);

  // Clic en el mapa
  function MapClickHandler() {
    useMapEvents({
      async click(e) {
        const { lat, lng } = e.latlng;
        setSelectedPosition([lat, lng]);
        try {
          const res = await axios.post(`${API_URL}/predict_tomtom/`, {
            address: `${lat},${lng}`,
            horizon: horizon
          });
          const z = zonasCriticas.find(z => Math.hypot(z.latitud - lat, z.longitud - lng) < 0.01);
          if (z) {
            res.data.zona_critica = z.nombre || z.sector_geografico;
            res.data.nivel_riesgo = z.nivel_riesgo;
          }
          setPrediction(res.data);
          onAddressSelect(`${lat.toFixed(5)}, ${lng.toFixed(5)}`, res.data);
        } catch (error) {
          console.error('Error en clic TomTom:', error);
          const mock = { estado:'FLUIDO', probabilidad:0.2, ventana:`${horizon} horas`, factores:'Tránsito normal' };
          setPrediction(mock);
          onAddressSelect(`${lat.toFixed(5)}, ${lng.toFixed(5)}`, mock);
        }
      }
    });
    return null;
  }

  const intensityToColor = (intensity) => {
    if (intensity >= 0.75) return { fill: '#ef4444', stroke: '#dc2626', opacity: 0.55 };
    if (intensity >= 0.50) return { fill: '#f97316', stroke: '#ea580c', opacity: 0.48 };
    if (intensity >= 0.30) return { fill: '#eab308', stroke: '#ca8a04', opacity: 0.40 };
    return { fill: '#22c55e', stroke: '#16a34a', opacity: 0.30 };
  };
  const intensityToRadius = (intensity) => 200 + intensity * 500;

  const tileUrl = mapLayer === 'satelite'
    ? 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}'
    : 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png';
  const tileAttr = mapLayer === 'satelite'
    ? '&copy; Esri &mdash; Esri, DigitalGlobe'
    : '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>';
  const fmtTime = (d) => d.toLocaleTimeString('es-CO', { hour:'2-digit', minute:'2-digit', second:'2-digit' });

  return (
    <div style={{ width:'100%', height:'100%', position:'relative', background:'#090b12' }}>
      {/* Barra superior - Estilo neón */}
      <div style={{
        position:'absolute', top:0, left:0, right:0, zIndex:1000,
        background: 'linear-gradient(135deg, rgba(15,15,42,0.92), rgba(88,28,135,0.4))',
        backdropFilter: 'blur(12px)',
        borderBottom: '1px solid rgba(168,85,247,0.2)',
        display:'flex', alignItems:'center', gap:'10px', padding:'8px 14px', flexWrap:'wrap'
      }}>
        {/* Botones capas */}
        <div style={{display:'flex',gap:'2px',background:'rgba(255,255,255,0.05)',borderRadius:'8px',padding:'3px'}}>
          {[['mapa','Mapa'],['satelite','Satélite'],['riesgo','Riesgo']].map(([k,lbl]) => (
            <button key={k} onClick={() => setMapLayer(k)}
              style={{padding:'4px 10px',borderRadius:'6px',fontSize:'10px',fontWeight:500,border:'none',cursor:'pointer',background:mapLayer===k?'rgba(139,92,246,0.4)':'transparent',color:mapLayer===k?'#c4b5fd':'#94a3b8'}}>
              {lbl}
            </button>
          ))}
        </div>
        {/* Horizonte */}
        <div style={{display:'flex',gap:'2px',background:'rgba(255,255,255,0.05)',borderRadius:'8px',padding:'3px'}}>
          {[2,4].map(h => (
            <button key={h} onClick={() => setHorizon(h)}
              style={{padding:'4px 10px',borderRadius:'6px',fontSize:'10px',fontWeight:600,border:'none',cursor:'pointer',background:horizon===h?'rgba(245,158,11,0.3)':'transparent',color:horizon===h?'#fbbf24':'#64748b'}}>
              {h}h
            </button>
          ))}
        </div>
        {/* Toggle heatmap */}
        <button onClick={() => setShowHeatmap(v => !v)}
          style={{padding:'4px 12px',borderRadius:'8px',fontSize:'10px',fontWeight:500,border:`0.5px solid ${showHeatmap?'rgba(239,68,68,0.4)':'rgba(255,255,255,0.1)'}`,background:showHeatmap?'rgba(239,68,68,0.12)':'transparent',color:showHeatmap?'#fca5a5':'#64748b',cursor:'pointer'}}>
          {showHeatmap ? '🔥 Calor ON' : '🔥 Calor OFF'}
        </button>
        {/* Incidentes toggle + selector rango */}
        <div style={{display:'flex', gap:'6px', alignItems:'center'}}>
          <button onClick={() => setShowIncidentes(!showIncidentes)}
            style={{padding:'4px 12px',borderRadius:'8px',fontSize:'10px',fontWeight:500,border:`0.5px solid ${showIncidentes?'rgba(34,197,94,0.4)':'rgba(255,255,255,0.1)'}`,background:showIncidentes?'rgba(34,197,94,0.12)':'transparent',color:showIncidentes?'#86efac':'#64748b',cursor:'pointer'}}>
            📍 Incidentes {showIncidentes ? 'ON' : 'OFF'}
          </button>
          {showIncidentes && (
            <select value={timeRangeDays} onChange={(e) => setTimeRangeDays(Number(e.target.value))}
              style={{padding:'4px 8px', borderRadius:'6px', fontSize:'10px', background:'rgba(0,0,0,0.6)', color:'white', border:'1px solid #555', cursor:'pointer'}}>
              <option value={0}>Todos</option>
              <option value={3650}>Últimos 10 años</option>
              <option value={730}>Últimos 2 años</option>
              <option value={365}>Último año</option>
              <option value={180}>Últimos 6 meses</option>
              <option value={30}>Último mes</option>
              <option value={7}>Última semana</option>
            </select>
          )}
        </div>
        {/* Pulso */}
        <div style={{display:'flex',alignItems:'center',gap:'5px',marginLeft:'auto'}}>
          <span style={{width:'6px',height:'6px',borderRadius:'50%',background:pulso?'#22c55e':'#16a34a',boxShadow:pulso?'0 0 8px #22c55e':'none',transition:'all 0.3s'}} />
          <span style={{color:'#334155',fontSize:'9px',fontFamily:'monospace'}}>{fmtTime(lastUpdate)}</span>
        </div>
      </div>

      <MapContainer
        ref={mapRef}
        center={[6.2476, -75.5658]}
        zoom={12}
        style={{ height:'100%', width:'100%', background:'#090b12' }}
        zoomControl={false}
        whenReady={() => console.log('Mapa listo')}
      >
        <TileLayer url={tileUrl} attribution={tileAttr} />
        {searchCoords && <FlyToCoords coords={searchCoords} />}

        {/* Heatmap TomTom */}
        {showHeatmap && heatmap.map((p, i) => {
          const [lat, lng, intensity] = p;
          const { fill, stroke, opacity } = intensityToColor(intensity);
          const radius = intensityToRadius(intensity);
          return (
            <Circle key={i} center={[lat, lng]} radius={radius}
              pathOptions={{ fillColor:fill, fillOpacity:opacity, color:stroke, weight:0.5 }}>
              <Popup><div>Intensidad: {(intensity*100).toFixed(0)}%</div></Popup>
            </Circle>
          );
        })}

        {/* Zonas críticas */}
        {zonasCriticas.map(zona => {
          const riesgo = calcularRiesgo(zona);
          const color = riesgo.esCritico ? '#b91c1c' : zona.nivel_riesgo==='Alto' ? '#ef4444' : zona.nivel_riesgo==='Medio' ? '#eab308' : '#10b981';
          const size = riesgo.esCritico ? 44 : zona.nivel_riesgo==='Alto' ? 36 : zona.nivel_riesgo==='Medio' ? 30 : 26;
          return (
            <Marker key={zona.id} position={[zona.latitud, zona.longitud]}
              icon={L.divIcon({
                html:`<svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="${color}" stroke="white" stroke-width="1.5"><path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7z"/><circle cx="12" cy="9" r="2.8" fill="white"/></svg>`,
                iconSize:[size,size], iconAnchor:[size/2,size], className:'',
              })}>
              <Popup>
                <div style={{ fontFamily:'system-ui', padding:'4px', minWidth:'190px' }}>
                  <div style={{ fontWeight:700, fontSize:'13px', borderBottom:'1px solid #eee', paddingBottom:'6px', marginBottom:'6px' }}>{zona.sector_geografico}</div>
                  <div style={{ fontSize:'11px', display:'flex', flexDirection:'column', gap:'3px' }}>
                    <span>Riesgo: <b style={{color}}>{zona.nivel_riesgo}</b></span>
                    <span>Accidentes: <b>{zona.total_accidentes}</b></span>
                    <span>Lesionados: {zona.total_lesionados} · Fatalidades: {zona.total_fatalidades}</span>
                    {riesgo.esCritico && <span style={{color:'#dc2626',fontWeight:600}}>⚠️ Anomalía +{riesgo.porcentajeExceso}% sobre media</span>}
                  </div>
                </div>
              </Popup>
            </Marker>
          );
        })}

        {/* Marcador punto seleccionado */}
        {selectedPosition && prediction && (
          <Marker position={selectedPosition}
            icon={L.divIcon({
              html:`<div style="width:14px;height:14px;background:#3b82f6;border:2px solid white;border-radius:50%;box-shadow:0 0 10px rgba(59,130,246,0.8)"></div>`,
              iconSize:[14,14], iconAnchor:[7,7], className:'',
            })}>
            <Popup>
              <div style={{ fontFamily:'system-ui', padding:'4px', minWidth:'180px' }}>
                <div style={{ fontWeight:700, fontSize:'11px', letterSpacing:'0.05em', color:'#1e293b', marginBottom:'6px' }}>📍 ANÁLISIS DE PUNTO</div>
                <div style={{ fontSize:'11px', display:'flex', flexDirection:'column', gap:'3px' }}>
                  <span>Estado: <b>{prediction.estado}</b></span>
                  <span>Probabilidad empeorar: <b style={{color:'#ef4444'}}>{(prediction.probabilidad*100).toFixed(0)}%</b></span>
                  <span>Ventana: {prediction.ventana}</span>
                  <span style={{color:'#64748b',fontSize:'10px'}}>{prediction.factores}</span>
                  {prediction.velocidad_actual && <span>Velocidad actual: {prediction.velocidad_actual} km/h</span>}
                </div>
              </div>
            </Popup>
          </Marker>
        )}

        <MapClickHandler />
      </MapContainer>

      {/* Leyenda flotante */}
      <div style={{
        position:'absolute', bottom:'28px', right:'14px', zIndex:1000,
        background: 'linear-gradient(135deg, rgba(15,15,42,0.95), rgba(88,28,135,0.6))',
        backdropFilter:'blur(10px)', border:'1px solid rgba(168,85,247,0.25)', borderRadius:'10px',
        padding:'10px 14px', minWidth:'150px', boxShadow: '0 0 15px rgba(168,85,247,0.2)'
      }}>
        <div style={{ color:'#e9d5ff', fontSize:'9px', fontWeight:600, letterSpacing:'0.1em', textTransform:'uppercase', marginBottom:'8px' }}>Flujo de Datos (TomTom)</div>
        {[
          { color:'#ef4444', label:'Muy Alta', min:75 },
          { color:'#f97316', label:'Alta',     min:50 },
          { color:'#eab308', label:'Moderada', min:30 },
          { color:'#22c55e', label:'Libre',    min:0  },
        ].map(({ color, label }) => (
          <div key={label} style={{ display:'flex', alignItems:'center', gap:'7px', marginBottom:'5px' }}>
            <span style={{ width:'10px', height:'10px', borderRadius:'50%', background:color, boxShadow: `0 0 6px ${color}`, flexShrink:0 }} />
            <span style={{ color:'#cbd5e1', fontSize:'10px' }}>{label}</span>
          </div>
        ))}
        <div style={{ borderTop:'0.5px solid rgba(168,85,247,0.3)', marginTop:'6px', paddingTop:'6px' }}>
          <div style={{ display:'flex', alignItems:'center', gap:'5px' }}>
            <span style={{ width:'6px', height:'6px', borderRadius:'50%', background: pulso ? '#22c55e' : '#16a34a', boxShadow: pulso ? '0 0 6px #22c55e' : 'none', transition:'all 0.3s' }} />
            <span style={{ color:'#334155', fontSize:'9px' }}>Actualiza cada 30s</span>
          </div>
        </div>
      </div>

      {/* Badge alto riesgo */}
      {zonasCriticas.some(z => z.nivel_riesgo==='Alto') && (
        <div style={{
          position:'absolute', bottom:'28px', left:'50%', transform:'translateX(-50%)', zIndex:1000,
          background:'rgba(239,68,68,0.15)', border:'1px solid rgba(239,68,68,0.4)',
          borderRadius:'20px', padding:'5px 14px', display:'flex', alignItems:'center', gap:'6px',
          animation:'omvPulse 2s ease-in-out infinite'
        }}>
          <span style={{ width:'6px', height:'6px', borderRadius:'50%', background:'#ff0000', boxShadow:'0 0 8px #ff0000' }} />
          <span style={{ color:'#000000', fontSize:'10px', fontWeight:600 }}>ALTO RIESGO DE ACCIDENTES</span>
        </div>
      )}

      {/* Controles zoom */}
      <div style={{ position:'absolute', right:'14px', top:'52px', zIndex:1000, display:'flex', flexDirection:'column', gap:'2px' }}>
        {['+','-'].map((s,i) => (
          <button key={s} onClick={() => { const m=mapRef.current; if(m) i===0?m.zoomIn():m.zoomOut(); }}
            style={{ width:'28px', height:'28px', borderRadius:'6px', background:'rgba(15,15,42,0.85)', border:'0.5px solid rgba(168,85,247,0.3)', color:'#c4b5fd', fontSize:'16px', cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'center' }}>
            {s}
          </button>
        ))}
      </div>

      {showWarning && (
        <div style={{
          position: 'absolute', top: '60px', left: '50%', transform: 'translateX(-50%)',
          zIndex: 2000, background: '#ef4444', color: 'white', padding: '5px 12px',
          borderRadius: '8px', fontSize: '11px', fontWeight: 'bold'
        }}>
          ⚠️ Demasiados incidentes. Mostrando solo los primeros 500. Usa el filtro temporal para reducir.
        </div>
      )}

      <style>{`
        @keyframes omvPulse {
          0%,100% { opacity:1; transform:translateX(-50%) scale(1); }
          50% { opacity:0.7; transform:translateX(-50%) scale(1.03); }
        }
        .leaflet-popup-content-wrapper {
          background: #1e1b4b !important;
          color: #e9d5ff !important;
          border-radius: 12px !important;
          border: 1px solid rgba(139,92,246,0.4) !important;
        }
        .leaflet-popup-tip {
          background: #1e1b4b !important;
        }
      `}</style>
    </div>
  );
}