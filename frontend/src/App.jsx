import { useState, useEffect } from 'react';
import Navbar from './components/Navbar';
import MapSection from './components/MapSection';
import NewsFeed from './components/NewsFeed';
import FotomultasTable from './components/FotomultasTable';
import AIAssistant from './components/AIAssistant';
import SafeRouteForm from './components/SafeRouteForm';
import SafeRouteResult from './components/SafeRouteResult';
import TrafficIRL from './components/TrafficIRL';
import { getSafeRoute } from './services/safeRoutesApi';
import Loader from "./components/Loader";
import Index from "./components/Index";
import { useAuth } from './context/useAuth';
import Login from './components/Login';
import { Toaster } from 'react-hot-toast';

import imgVarianteCaldas from './assets/variante_caldas.png';
import imgSanJuan from './assets/accidente_san_juan.png';
import imgTunelOriente from './assets/tunel_oriente.png';

// ─── TOKENS (estilos) ─────────────────────────────────────────────────────────
const T = {
  bg:        '#060B18',
  surface:   '#0D1425',
  surfaceUp: '#111827',
  border:    '#1E2D45',
  borderSub: '#162032',
  accent:    '#3B82F6',
  accentDim: 'rgba(59,130,246,0.12)',
  danger:    '#EF4444',
  warn:      '#F59E0B',
  safe:      '#22C55E',
  text:      '#E2E8F0',
  textSub:   '#64748B',
  textMuted: '#334155',
};

// ─── MOCK DATA ────────────────────────────────────────────────────────────────
const mockZonasCriticas = [
  { id: 1, sector_geografico: "Autopista Sur", latitud: 6.2442, longitud: -75.5812, total_accidentes: 45, total_lesionados: 32, total_fatalidades: 5, nivel_riesgo: "Alto", nivel_riesgo_predictive: 78, descripcion: "Colisiones múltiples en horas pico", modificado: "09/06/2026", tiempo: "2 hrs" },
  { id: 2, sector_geografico: "Calle 30", latitud: 6.2530, longitud: -75.5634, total_accidentes: 38, total_lesionados: 27, total_fatalidades: 3, nivel_riesgo: "Medio", nivel_riesgo_predictive: 65, descripcion: "Incidentes con motocicletas recurrentes", modificado: "09/06/2026", tiempo: "6 hrs" },
  { id: 3, sector_geografico: "Parque de los Deseos", latitud: 6.2670, longitud: -75.5700, total_accidentes: 12, total_lesionados: 9, total_fatalidades: 0, nivel_riesgo: "Bajo", nivel_riesgo_predictive: 25, descripcion: "Congestión peatonal y cruces lentos", modificado: "09/06/2026", tiempo: "5 días" }
];

const mockInfracciones = [
  { id: 1, lugar: "Carrera 50 con Calle 10", tipo: "Fotomulta", valor: 450000, fecha: "2025-02-10" },
];

const RESPALDO_NOTICIAS = [
  { id: "fb-1", titulo: "En la variante a Caldas van nueve muertos: es la vía más letal del Valle de Aburrá", descripcion: "De acuerdo con los reportes judiciales...", imagen: imgVarianteCaldas, tipo_alerta_display: "Crítico", url: "https://www.elcolombiano.com/antioquia/accidentes-variante-a-caldas-medellin-MF35659335" },
  { id: "fb-2", titulo: "Un motociclista y un peatón muertos en trágicos accidentes de tránsito en Medellín", descripcion: "La ciudad sumó nuevas fatalidades viales...", imagen: imgSanJuan, tipo_alerta_display: "Crítico", url: "https://qhubomedellin.com/actualidad/movilidad/un-motociclista-and-un-peaton-muertos-en-accidentes-de-transito-en-medellin-HH34002140" },
  { id: "fb-3", titulo: "Una persona murió tras choque de camioneta contra una caseta en el Túnel de Oriente", descripcion: "Un trágico accidente de tránsito se registró...", imagen: imgTunelOriente, tipo_alerta_display: "Crítico", url: "https://www.elcolombiano.com/antioquia/una-persona-murio-tras-choque-de-camioneta-contra-una-caseta-en-el-tunel-de-oriente-GI36584222" }
];

// ─── SUB-COMPONENTS (respetando tu código original) ───────────────────────────
function HeatmapLegend() {
  const entries = [
    { color: '#EF4444', label: 'Muy Alta' },
    { color: '#F97316', label: 'Alta' },
    { color: '#EAB308', label: 'Moderada' },
    { color: '#22C55E', label: 'Libre' },
  ];
  return (
    <div style={{
      position: 'absolute',
      bottom: '32px',
      right: '12px',
      zIndex: 400,
      background: 'rgba(6, 11, 24, 0.88)',
      backdropFilter: 'blur(16px)',
      WebkitBackdropFilter: 'blur(16px)',
      border: `1px solid ${T.border}`,
      borderRadius: '8px',
      padding: '10px 14px',
      minWidth: '140px',
    }}>
      <div style={{
        fontSize: '9px',
        fontFamily: 'monospace',
        letterSpacing: '0.08em',
        color: T.textSub,
        marginBottom: '8px',
        textTransform: 'uppercase',
      }}>Flujo de datos</div>
      {entries.map(e => (
        <div key={e.label} style={{
          display: 'flex', alignItems: 'center', gap: '8px',
          marginBottom: '5px',
        }}>
          <div style={{
            width: '10px', height: '10px', borderRadius: '50%',
            background: e.color,
            boxShadow: `0 0 6px ${e.color}80`,
            flexShrink: 0,
          }} />
          <span style={{ fontSize: '11px', color: T.text }}>{e.label}</span>
        </div>
      ))}
    </div>
  );
}

function SystemStatusBar({ estadisticas, zonasCriticas }) {
  const [tick, setTick] = useState(true);
  const highRisk = zonasCriticas.filter(z => z.nivel_riesgo === 'Alto').length;

  useEffect(() => {
    const id = setInterval(() => setTick(t => !t), 1000);
    return () => clearInterval(id);
  }, []);

  const now = new Date().toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false });

  // Se mantiene el estilo original (aunque en tu código no había return, lo dejamos igual)
  return null;
}

function StatCard({ label, value, color = T.text, accent }) {
  return (
    <div style={{
      background: T.surface,
      border: `1px solid ${T.border}`,
      borderLeft: `3px solid ${accent || color}`,
      borderRadius: '8px',
      padding: '20px 24px',
    }}>
      <div style={{
        fontSize: '28px',
        fontWeight: 700,
        color,
        fontVariantNumeric: 'tabular-nums',
        letterSpacing: '-0.02em',
        lineHeight: 1,
      }}>{value}</div>
      <div style={{
        fontSize: '11px',
        color: T.textSub,
        marginTop: '8px',
        textTransform: 'uppercase',
        letterSpacing: '0.08em',
        fontWeight: 500,
      }}>{label}</div>
    </div>
  );
}

function Panel({ children, style }) {
  return (
    <div style={{
      background: T.surface,
      border: `1px solid ${T.border}`,
      borderRadius: '10px',
      overflow: 'hidden',
      ...style,
    }}>{children}</div>
  );
}

function PanelHeader({ title, subtitle, badge }) {
  return (
    <div style={{
      padding: '14px 20px',
      borderBottom: `1px solid ${T.borderSub}`,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
    }}>
      <div>
        <span style={{ color: T.text, fontWeight: 600, fontSize: '13px' }}>{title}</span>
        {subtitle && <span style={{ color: T.textSub, fontSize: '11px', marginLeft: '10px' }}>{subtitle}</span>}
      </div>
      {badge && (
        <span style={{
          fontSize: '10px',
          fontFamily: 'monospace',
          letterSpacing: '0.06em',
          color: T.accent,
          background: T.accentDim,
          border: `1px solid rgba(59,130,246,0.2)`,
          borderRadius: '4px',
          padding: '2px 8px',
        }}>{badge}</span>
      )}
    </div>
  );
}

// ─── APP PRINCIPAL (MODIFICADA) ──────────────────────────────────────────────
function App() {
  const [appLoading, setAppLoading] = useState(true);
  const { user, loading: authLoading, logout } = useAuth();
  const [zonasCriticas, setZonasCriticas] = useState([]);
  const [infracciones, setInfracciones] = useState([]);

  // Cargar datos de movilidad
  useEffect(() => {
    const fetchDatosMovilidad = async () => {
      try {
        const response = await fetch('TU_API_ENDPOINT_AQUI');
        const data = await response.json();
        setZonasCriticas(data.zonas || mockZonasCriticas);
        setInfracciones(data.multas || mockInfracciones);
      } catch {
        setZonasCriticas(mockZonasCriticas);
        setInfracciones(mockInfracciones);
      }
    };
    fetchDatosMovilidad();
    const interval = setInterval(fetchDatosMovilidad, 60000);
    return () => clearInterval(interval);
  }, []);

  const [estadisticas, setEstadisticas] = useState({ total: 95, lesionados: 68, fatalidades: 8 });
  useEffect(() => {
    if (zonasCriticas.length > 0) {
      setEstadisticas({
        total:       zonasCriticas.reduce((s, z) => s + (z.total_accidentes  || 0), 0),
        lesionados:  zonasCriticas.reduce((s, z) => s + (z.total_lesionados  || 0), 0),
        fatalidades: zonasCriticas.reduce((s, z) => s + (z.total_fatalidades || 0), 0),
      });
    }
  }, [zonasCriticas]);

  const [selectedAddress, setSelectedAddress] = useState('');
  const [prediction, setPrediction] = useState(null);
  const [vista, setVista] = useState('index'); // Pantalla inicial después del login
  const [searchCoords, setSearchCoords] = useState(null);
  const [searchAddress, setSearchAddress] = useState('');
  const [routeResult, setRouteResult] = useState(null);
  const [routeLoading, setRouteLoading] = useState(false);
  const [routeError, setRouteError] = useState(null);
  const [noticias, setNoticias] = useState(RESPALDO_NOTICIAS);
  const [loadingNoticias, setLoadingNoticias] = useState(true);
  const [currentNewsIndex, setCurrentNewsIndex] = useState(0);
  const [isCarouselPaused, setIsCarouselPaused] = useState(false);

  // 👇 NUEVOS ESTADOS PARA CONTROLAR EL MAPA DE CALOR
  const [horizon, setHorizon] = useState(2);          // horizonte de predicción (2h / 4h)
  const [showHeatmap, setShowHeatmap] = useState(true); // mostrar/ocultar heatmap

  // Cargar noticias externas
  useEffect(() => {
    const fetchLiveNews = async () => {
      try {
        const response = await fetch('https://newsapi.org/v2/top-headlines?country=co&category=general&apiKey=1312aa0f82e54b3ca5d885760c38036d');
        const data = await response.json();
        if (data.articles?.length > 0) {
          setNoticias(data.articles.slice(0, 5).map((a, i) => ({
            id: `api-${i}`,
            titulo: a.title || "Reporte de Tránsito Local",
            descripcion: a.description || "Revise las condiciones de la calzada e informes oficiales.",
            imagen: a.urlToImage || RESPALDO_NOTICIAS[i % 3].imagen,
            tipo_alerta_display: i % 2 === 0 ? "Crítico" : "Reporte",
            url: a.url,
          })));
        } else {
          setNoticias(RESPALDO_NOTICIAS);
        }
      } catch {
        setNoticias(RESPALDO_NOTICIAS);
      } finally {
        setLoadingNoticias(false);
      }
    };
    fetchLiveNews();
  }, []);

  // Carrusel automático de noticias
  useEffect(() => {
    if (isCarouselPaused || noticias.length === 0) return;
    const id = setInterval(() => setCurrentNewsIndex(p => (p + 1) % noticias.length), 3000);
    return () => clearInterval(id);
  }, [noticias, isCarouselPaused]);

  const handleSearchAddress = (addr, coords) => {
    setSearchAddress(addr);
    setSearchCoords(coords);
    setVista('mapa');
  };
  const handlePrevNews = e => { e.stopPropagation(); setCurrentNewsIndex(p => (p === 0 ? noticias.length - 1 : p - 1)); };
  const handleNextNews = e => { e.stopPropagation(); setCurrentNewsIndex(p => (p + 1) % noticias.length); };
  const handleCalculateRoute = async (origen, destino, modoLluvias) => {
    setRouteLoading(true); setRouteError(null); setRouteResult(null);
    try {
      const result = await getSafeRoute(origen, destino, modoLluvias);
      if (result.error) setRouteError(result.error);
      else setRouteResult(result);
    } catch (err) {
      setRouteError(err.response?.data?.error || err.message || 'Error al calcular la ruta');
    } finally {
      setRouteLoading(false);
    }
  };
  const handleSetVista = (nuevaVista) => setVista(nuevaVista);
  const handleLogout = () => logout();

  // ── GUARDS ──
  if (!user) return <Login />;
  if (authLoading || appLoading) return <Loader onFinish={() => setAppLoading(false)} />;

  // ── RENDER ──
  return (
    <>
      <Toaster
        position="top-right"
        toastOptions={{
          style: {
            background: T.surfaceUp,
            color: T.text,
            border: `1px solid ${T.border}`,
            fontSize: '13px',
            borderRadius: '8px',
          },
        }}
      />
      <div style={{
        background: T.bg,
        minHeight: '100vh',
        display: 'flex',
        flexDirection: 'column',
        color: T.text,
        fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", system-ui, sans-serif',
        WebkitFontSmoothing: 'antialiased',
      }}>
        <Navbar setVista={handleSetVista} onLogout={handleLogout} />
        <SystemStatusBar estadisticas={estadisticas} zonasCriticas={zonasCriticas} />
        <main style={{ flex: 1, display: 'flex', flexDirection: 'column', minHeight: 0 }}>
          {vista === 'index' && <Index setVista={handleSetVista} />}
          {vista === 'mapa' && (
            <div style={{ flex: 1, position: 'relative', overflow: 'hidden' }}>
              <div style={{ position: 'absolute', inset: 0 }}>
                <MapSection
                  onAddressSelect={(addr, pred) => { setSelectedAddress(addr); setPrediction(pred); }}
                  zonasCriticas={zonasCriticas}
                  estadisticas={estadisticas}
                  searchCoords={searchCoords}
                  searchAddress={searchAddress}
                  onClearSearch={() => setSearchCoords(null)}
                  horizon={horizon}                 // ← nueva prop
                  setHorizon={setHorizon}           // ← nueva prop
                  showHeatmap={showHeatmap}         // ← nueva prop
                  setShowHeatmap={setShowHeatmap}   // ← nueva prop
                />
              </div>
              <HeatmapLegend />
              <div style={{
                position: 'absolute',
                top: '56px', left: '12px', bottom: '16px',
                width: '340px',
                zIndex: 400,
                display: 'flex',
                flexDirection: 'column',
                borderRadius: '10px',
                overflow: 'hidden',
                border: `1px solid ${T.border}`,
                background: 'rgba(6, 11, 24, 0.85)',
                backdropFilter: 'blur(24px)',
                WebkitBackdropFilter: 'blur(24px)',
                boxShadow: '0 24px 48px rgba(0,0,0,0.6)',
              }}>
                {/* Aquí iba el header del asistente, pero tu código lo dejó vacío – lo conservo igual */}
                <div style={{}}></div>
                <div style={{ flex: 1, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
                  <AIAssistant
                    address={selectedAddress}
                    prediction={prediction}
                    zonasCriticas={zonasCriticas}
                    noticias={noticias}
                    estadisticas={estadisticas}
                    onSearchAddress={handleSearchAddress}
                  />
                </div>
              </div>
            </div>
          )}
          {vista === 'rutas' && (
            <div style={{ maxWidth: '680px', margin: '32px auto', padding: '0 20px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <Panel>
                <PanelHeader title="Planificador de Rutas" subtitle="Análisis de seguridad vial" badge="BETA" />
                <div style={{ padding: '20px' }}>
                  <SafeRouteForm onCalculate={handleCalculateRoute} loading={routeLoading} />
                </div>
              </Panel>
              {routeError && (
                <div style={{
                  background: 'rgba(239,68,68,0.06)',
                  border: `1px solid rgba(239,68,68,0.25)`,
                  borderLeft: `3px solid ${T.danger}`,
                  borderRadius: '8px',
                  padding: '14px 18px',
                  fontSize: '13px',
                  color: '#FCA5A5',
                }}>
                  {routeError}
                </div>
              )}
              {routeResult && (
                <Panel>
                  <PanelHeader title="Resultado" subtitle="Ruta optimizada por seguridad" />
                  <div style={{ padding: '20px' }}>
                    <SafeRouteResult
                      result={routeResult}
                      onNewSearch={() => { setRouteResult(null); setRouteError(null); }}
                    />
                  </div>
                </Panel>
              )}
            </div>
          )}
          {vista === 'trafico' && (
            <div style={{ maxWidth: '960px', margin: '32px auto', padding: '0 20px', width: '100%' }}>
              <Panel>
                <PanelHeader title="Tráfico en Tiempo Real" badge="LIVE" />
                <div style={{ padding: '20px' }}>
                  <TrafficIRL />
                </div>
              </Panel>
            </div>
          )}
        </main>
      </div>
      <style>{`
        @keyframes pulse { 0%,100% { opacity:1; } 50% { opacity:0.4; } }
        * { box-sizing: border-box; }
        ::-webkit-scrollbar { width: 4px; height: 4px; }
        ::-webkit-scrollbar-track { background: transparent; }
        ::-webkit-scrollbar-thumb { background: #1E2D45; border-radius: 2px; }
        ::-webkit-scrollbar-thumb:hover { background: #2D4060; }
      `}</style>
    </>
  );
}

export default App;