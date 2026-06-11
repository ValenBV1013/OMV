// MapSection.jsx — CITYSAFE style + heatmap tiempo real simulado
import { useState, useEffect, useRef, useCallback } from 'react';
import { MapContainer, TileLayer, Marker, Popup, Circle, useMapEvents, useMap } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import axios from 'axios';

delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon-2x.png',
  iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png',
});

const API_URL = 'http://localhost:8000/api';

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

// ── Puntos base del heatmap para Medellín ────────────────────────────────────
// Intensidad: 1.0 = crítico (rojo), 0.6 = alto (naranja), 0.3 = moderado (amarillo)
const BASE_HEATMAP = [
  // Zonas muy críticas
  { lat:6.2442, lng:-75.5812, base:0.95, label:'Autopista Sur' },
  { lat:6.2530, lng:-75.5634, base:0.82, label:'Calle 30' },
  { lat:6.2476, lng:-75.5658, base:0.78, label:'Centro' },
  { lat:6.2390, lng:-75.5720, base:0.70, label:'La América' },
  { lat:6.2590, lng:-75.5580, base:0.65, label:'Aranjuez' },
  // Zonas medias
  { lat:6.2670, lng:-75.5700, base:0.45, label:'Parque Deseos' },
  { lat:6.2320, lng:-75.5850, base:0.50, label:'Belén' },
  { lat:6.2750, lng:-75.5620, base:0.40, label:'Robledo' },
  { lat:6.2460, lng:-75.5490, base:0.55, label:'Buenos Aires' },
  { lat:6.2200, lng:-75.5760, base:0.48, label:'Itagüi Norte' },
  // Zonas bajas
  { lat:6.2850, lng:-75.5680, base:0.25, label:'Bello Sur' },
  { lat:6.2100, lng:-75.5900, base:0.20, label:'La Estrella' },
  { lat:6.2600, lng:-75.5400, base:0.30, label:'El Poblado' },
];

// Genera intensidad dinámica con variación aleatoria ±15% cada refresh
const generarHeatmap = (horizon = 2) => {
  const hora = new Date().getHours();
  // Factor hora pico: mañana 7-9, tarde 5-7 → incrementa congestión
  const esHoraPico = (hora >= 7 && hora <= 9) || (hora >= 17 && hora <= 19);
  const factorHora = esHoraPico ? 1.25 : 1.0;
  const factorHorizonte = horizon === 4 ? 1.1 : 1.0; // 4h predice más congestión

  return BASE_HEATMAP.map(p => ({
    ...p,
    intensity: Math.min(1, p.base * factorHora * factorHorizonte * (0.85 + Math.random() * 0.30)),
  }));
};

const intensityToColor = (intensity) => {
  if (intensity >= 0.75) return { fill: '#ef4444', stroke: '#dc2626', opacity: 0.55 };
  if (intensity >= 0.50) return { fill: '#f97316', stroke: '#ea580c', opacity: 0.48 };
  if (intensity >= 0.30) return { fill: '#eab308', stroke: '#ca8a04', opacity: 0.40 };
  return { fill: '#22c55e', stroke: '#16a34a', opacity: 0.30 };
};

const intensityToRadius = (intensity) => 200 + intensity * 500;

// ── Fly-to helper ─────────────────────────────────────────────────────────────
function FlyToCoords({ coords }) {
  const map = useMap();
  useEffect(() => {
    if (coords) map.flyTo([coords.lat, coords.lng], 15, { duration: 1.2 });
  }, [coords, map]);
  return null;
}

// ── Componente principal ──────────────────────────────────────────────────────
export default function MapSection({
  onAddressSelect, zonasCriticas = [], estadisticas = {},
  searchCoords = null, searchAddress = '', onClearSearch = null
}) {
  const [selectedPosition, setSelectedPosition] = useState(null);
  const [prediction, setPrediction]             = useState(null);
  const [horizon, setHorizon]                   = useState(2);
  const [heatmap, setHeatmap]                   = useState(() => generarHeatmap(2));
  const [showHeatmap, setShowHeatmap]           = useState(true);
  const [mapLayer, setMapLayer]                 = useState('mapa'); // mapa | satelite | riesgo
  const [lastUpdate, setLastUpdate]             = useState(new Date());
  const [pulso, setPulso]                       = useState(false);
  const mapRef = useRef(null);

  // ── Actualización en tiempo real cada 30s ────────────────────────────────
  useEffect(() => {
    const refresh = () => {
      setHeatmap(generarHeatmap(horizon));
      setLastUpdate(new Date());
      setPulso(true);
      setTimeout(() => setPulso(false), 800);
    };
    refresh();
    const interval = setInterval(refresh, 30000);
    return () => clearInterval(interval);
  }, [horizon]);

  // ── Búsqueda de dirección ─────────────────────────────────────────────────
  useEffect(() => {
    if (!searchCoords) return;
    setSelectedPosition([searchCoords.lat, searchCoords.lng]);
    const fetchPred = async () => {
      try {
        const res = await axios.post(`${API_URL}/predict/`, { sector_id:1, address:searchAddress, horizon });
        const z = zonasCriticas.find(z => Math.hypot(z.latitud-searchCoords.lat, z.longitud-searchCoords.lng)<0.01);
        if (z) { res.data.zona_critica=z.nombre||z.sector_geografico; res.data.nivel_riesgo=z.nivel_riesgo; }
        onAddressSelect(searchAddress, res.data);
      } catch {
        const mock = { estado:'CONGESTIÓN MODERADA', probabilidad:0.65, ventana:`${horizon} horas`, factores:'Hora pico, condiciones locales' };
        onAddressSelect(searchAddress, mock);
      }
    };
    fetchPred();
    if (onClearSearch) onClearSearch();
  }, [searchCoords, searchAddress]);

  // ── Clic en el mapa ───────────────────────────────────────────────────────
  function MapClickHandler() {
    useMapEvents({
      async click(e) {
        const { lat, lng } = e.latlng;
        setSelectedPosition([lat, lng]);
        try {
          const res = await axios.post(`${API_URL}/predict/`, { sector_id:1, address:`${lat},${lng}`, horizon });
          const z = zonasCriticas.find(z => Math.hypot(z.latitud-lat, z.longitud-lng)<0.01);
          if (z) { res.data.zona_critica=z.nombre||z.sector_geografico; res.data.nivel_riesgo=z.nivel_riesgo; }
          setPrediction(res.data);
          onAddressSelect(`${lat.toFixed(5)}, ${lng.toFixed(5)}`, res.data);
        } catch {
          const mock = { estado:'FLUIDO', probabilidad:0.2, ventana:`${horizon} horas`, factores:'Tránsito normal' };
          setPrediction(mock);
          onAddressSelect(`${lat.toFixed(5)}, ${lng.toFixed(5)}`, mock);
        }
      }
    });
    return null;
  }

  const tileUrl = mapLayer === 'satelite'
    ? 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}'
    : 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png';

  const tileAttr = mapLayer === 'satelite'
    ? '&copy; Esri &mdash; Esri, DigitalGlobe'
    : '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>';

  const fmtTime = (d) => d.toLocaleTimeString('es-CO', { hour:'2-digit', minute:'2-digit', second:'2-digit' });

  return (
    <div style={{ width:'100%', height:'100%', position:'relative', background:'#090b12' }}>

      {/* ── Barra superior tipo CITYSAFE ── */}
<div style={{
  position:'absolute', top:0, left:0, right:0, zIndex:1000,
  background:'rgba(6,8,16,0.82)', backdropFilter:'blur(12px)',
  borderBottom:'0.5px solid rgba(255,255,255,0.08)',
  display:'flex', alignItems:'center', gap:'10px', padding:'8px 14px',
}}>
  {/* Toggle capas */}
  <div style={{display:'flex',gap:'2px',background:'rgba(255,255,255,0.05)',borderRadius:'8px',padding:'3px'}}>
    {[['mapa','Mapa'],['satelite','Satélite'],['riesgo','Riesgo']].map(([k,lbl]) => (
      <button key={k} onClick={() => setMapLayer(k)}
        style={{padding:'4px 10px',borderRadius:'6px',fontSize:'10px',fontWeight:500,border:'none',cursor:'pointer',transition:'all 0.15s',background:mapLayer===k?'rgba(59,130,246,0.4)':'transparent',color:mapLayer===k?'#93c5fd':'#64748b'}}>
        {lbl}
      </button>
    ))}
  </div>

  {/* Horizonte */}
  <div style={{display:'flex',gap:'2px',background:'rgba(255,255,255,0.05)',borderRadius:'8px',padding:'3px'}}>
    {[2,4].map(h => (
      <button key={h} onClick={() => setHorizon(h)}
        style={{padding:'4px 10px',borderRadius:'6px',fontSize:'10px',fontWeight:600,border:'none',cursor:'pointer',transition:'all 0.15s',background:horizon===h?'rgba(245,158,11,0.3)':'transparent',color:horizon===h?'#fbbf24':'#64748b'}}>
        {h}h
      </button>
    ))}
  </div>

  {/* Toggle heatmap */}
  <button onClick={() => setShowHeatmap(v => !v)}
    style={{padding:'4px 12px',borderRadius:'8px',fontSize:'10px',fontWeight:500,border:`0.5px solid ${showHeatmap?'rgba(239,68,68,0.4)':'rgba(255,255,255,0.1)'}`,background:showHeatmap?'rgba(239,68,68,0.12)':'transparent',color:showHeatmap?'#fca5a5':'#64748b',cursor:'pointer'}}>
    {showHeatmap ? '🔥 Calor ON' : '🔥 Calor OFF'}
  </button>

  {/* Pulso tiempo real */}
  <div style={{display:'flex',alignItems:'center',gap:'5px',marginLeft:'auto'}}>
    <span style={{width:'6px',height:'6px',borderRadius:'50%',background:pulso?'#22c55e':'#16a34a',boxShadow:pulso?'0 0 8px #22c55e':'none',transition:'all 0.3s'}} />
    <span style={{color:'#334155',fontSize:'9px',fontFamily:'monospace'}}>{fmtTime(lastUpdate)}</span>
  </div>
</div>

      {/* ── Mapa ── */}
      <MapContainer
        ref={mapRef}
        center={[6.2476, -75.5658]}
        zoom={12}
        style={{ height:'100%', width:'100%', background:'#090b12' }}
        zoomControl={false}
      >
        <TileLayer url={tileUrl} attribution={tileAttr} />

        {searchCoords && <FlyToCoords coords={searchCoords} />}

        {/* Heatmap en tiempo real */}
        {showHeatmap && heatmap.map((p, i) => {
          const { fill, stroke, opacity } = intensityToColor(p.intensity);
          const radius = intensityToRadius(p.intensity);
          return (
            <Circle key={i} center={[p.lat, p.lng]} radius={radius}
              pathOptions={{ fillColor:fill, fillOpacity:opacity, color:stroke, weight:0.5 }}>
              <Popup>
                <div style={{ fontFamily:'system-ui', fontSize:'12px', minWidth:'160px' }}>
                  <div style={{ fontWeight:600, marginBottom:'4px' }}>{p.label}</div>
                  <div>Intensidad: <b style={{ color:fill }}>{(p.intensity*100).toFixed(0)}%</b></div>
                  <div style={{ fontSize:'10px', color:'#666', marginTop:'3px' }}>Predicción {horizon}h · {fmtTime(lastUpdate)}</div>
                </div>
              </Popup>
            </Circle>
          );
        })}

        {/* Marcadores zonas críticas */}
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
                  <div style={{ fontWeight:700, fontSize:'13px', borderBottom:'1px solid #eee', paddingBottom:'6px', marginBottom:'6px' }}>
                    {zona.sector_geografico}
                  </div>
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
                </div>
              </div>
            </Popup>
          </Marker>
        )}

        <MapClickHandler />
      </MapContainer>

      {/* ── Leyenda FLUJO DE DATOS (esquina inferior derecha) ── */}
      <div style={{
        position:'absolute', bottom:'28px', right:'14px', zIndex:1000,
        background:'rgba(6,8,16,0.85)', backdropFilter:'blur(10px)',
        border:'0.5px solid rgba(255,255,255,0.1)', borderRadius:'10px',
        padding:'10px 14px', minWidth:'150px',
      }}>
        <div style={{ color:'#94a3b8', fontSize:'9px', fontWeight:600, letterSpacing:'0.1em', textTransform:'uppercase', marginBottom:'8px' }}>
          Flujo de Datos
        </div>
        {[
          { color:'#ef4444', label:'Muy Alta', min:75 },
          { color:'#f97316', label:'Alta',     min:50 },
          { color:'#eab308', label:'Moderada', min:30 },
          { color:'#22c55e', label:'Libre',    min:0  },
        ].map(({ color, label }) => (
          <div key={label} style={{ display:'flex', alignItems:'center', gap:'7px', marginBottom:'5px' }}>
            <span style={{ width:'10px', height:'10px', borderRadius:'50%', background:color, flexShrink:0 }} />
            <span style={{ color:'#cbd5e1', fontSize:'10px' }}>{label}</span>
          </div>
        ))}
        <div style={{ borderTop:'0.5px solid rgba(255,255,255,0.07)', marginTop:'6px', paddingTop:'6px' }}>
          <div style={{ display:'flex', alignItems:'center', gap:'5px' }}>
            <span style={{ width:'6px', height:'6px', borderRadius:'50%', background: pulso ? '#22c55e' : '#16a34a',
              boxShadow: pulso ? '0 0 6px #22c55e' : 'none', transition:'all 0.3s' }} />
            <span style={{ color:'#334155', fontSize:'9px' }}>Actualiza cada 30s</span>
          </div>
        </div>
      </div>

      {/* ── Badge ALTO RIESGO animado si hay zonas críticas ── */}
      {zonasCriticas.some(z => z.nivel_riesgo==='Alto') && (
        <div style={{
          position:'absolute', bottom:'28px', left:'50%', transform:'translateX(-50%)',
          zIndex:1000,
          background:'rgba(239,68,68,0.15)', border:'1px solid rgba(239,68,68,0.4)',
          borderRadius:'20px', padding:'5px 14px',
          display:'flex', alignItems:'center', gap:'6px',
          animation:'omvPulse 2s ease-in-out infinite',
        }}>
          <span style={{ width:'6px', height:'6px', borderRadius:'50%', background:'#ff0000',
            boxShadow:'0 0 8px #ff0000' }} />
          <span style={{ color:'#000000', fontSize:'10px', fontWeight:600, letterSpacing:'0.05em' }}>
            ALTO RIESGO DE ACCIDENTES
          </span>
        </div>
      )}

      {/* ── Controles zoom ── */}
      <div style={{ position:'absolute', right:'14px', top:'52px', zIndex:1000, display:'flex', flexDirection:'column', gap:'2px' }}>
        {['+','-'].map((s,i) => (
          <button key={s} onClick={() => { const m=mapRef.current; if(m) i===0?m.zoomIn():m.zoomOut(); }}
            style={{
              width:'28px', height:'28px', borderRadius:'6px',
              background:'rgba(6,8,16,0.85)', border:'0.5px solid rgba(255,255,255,0.12)',
              color:'#94a3b8', fontSize:'16px', cursor:'pointer',
              display:'flex', alignItems:'center', justifyContent:'center', lineHeight:1,
            }}>
            {s}
          </button>
        ))}
      </div>

      <style>{`
        @keyframes omvPulse {
          0%,100% { opacity:1; transform:translateX(-50%) scale(1); }
          50%      { opacity:0.7; transform:translateX(-50%) scale(1.03); }
        }
      `}</style>
    </div>
  );
}