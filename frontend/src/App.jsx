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
import { useAuth } from './context/AuthContext';
import Login from './components/Login';
import { Toaster } from 'react-hot-toast';

// --- IMPORTACIÓN DE IMÁGENES PNG LOCALES ---
import imgVarianteCaldas from './assets/variante_caldas.png';
import imgSanJuan from './assets/accidente_san_juan.png';
import imgTunelOriente from './assets/tunel_oriente.png';

// --- DATOS DE RESPALDO (MOCK) ---
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

function App() {
  const [appLoading, setAppLoading] = useState(true);
  const [showIndex, setShowIndex] = useState(true);

  // CONTROL DEL ASISTENTE FLOTANTE
  const [isAssistantOpen, setIsAssistantOpen] = useState(false);

  const { user, loading: authLoading } = useAuth();
  const [zonasCriticas, setZonasCriticas] = useState([]);
  const [infracciones, setInfracciones] = useState([]);

  useEffect(() => {
    const fetchDatosMovilidad = async () => {
      try {
        const response = await fetch('TU_API_ENDPOINT_AQUI');
        const data = await response.json();
        setZonasCriticas(data.zonas || mockZonasCriticas);
        setInfracciones(data.multas || mockInfracciones);
      } catch (error) {
        console.warn("API no disponible, usando datos de respaldo.");
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
      const totalAcc = zonasCriticas.reduce((sum, z) => sum + (z.total_accidentes || 0), 0);
      const totalLes = zonasCriticas.reduce((sum, z) => sum + (z.total_lesionados || 0), 0);
      const totalFat = zonasCriticas.reduce((sum, z) => sum + (z.total_fatalidades || 0), 0);
      setEstadisticas({ total: totalAcc, lesionados: totalLes, fatalidades: totalFat });
    }
  }, [zonasCriticas]);

  const [selectedAddress, setSelectedAddress] = useState('');
  const [prediction, setPrediction] = useState(null);
  const [vista, setVista] = useState('mapa');
  const [searchCoords, setSearchCoords] = useState(null);
  const [searchAddress, setSearchAddress] = useState('');
  const [routeResult, setRouteResult] = useState(null);
  const [routeLoading, setRouteLoading] = useState(false);
  const [routeError, setRouteError] = useState(null);
  const [noticias, setNoticias] = useState(RESPALDO_NOTICIAS);
  const [loadingNoticias, setLoadingNoticias] = useState(true);
  const [currentNewsIndex, setCurrentNewsIndex] = useState(0);
  const [isCarouselPaused, setIsCarouselPaused] = useState(false);

  useEffect(() => {
    const fetchLiveNews = async () => {
      try {
        const response = await fetch('https://newsapi.org/v2/top-headlines?country=co&category=general&apiKey=1312aa0f82e54b3ca5d885760c38036d');
        const data = await response.json();
        if (data.articles && data.articles.length > 0) {
          const noticiasFormateadas = data.articles.slice(0, 5).map((article, index) => ({
            id: `api-${index}`,
            titulo: article.title || "Reporte de Tránsito Local",
            descripcion: article.description || "Revise las condiciones de la calzada e informes oficiales de movilidad en el enlace adjunto.",
            imagen: article.urlToImage || RESPALDO_NOTICIAS[index % 3].imagen,
            tipo_alerta_display: index % 2 === 0 ? "Crítico" : "Reporte",
            url: article.url
          }));
          setNoticias(noticiasFormateadas);
        } else {
          setNoticias(RESPALDO_NOTICIAS);
        }
      } catch (error) {
        setNoticias(RESPALDO_NOTICIAS);
      } finally {
        setLoadingNoticias(false);
      }
    };
    fetchLiveNews();
  }, []);

  useEffect(() => {
    if (isCarouselPaused || noticias.length === 0) return;
    const interval = setInterval(() => {
      setCurrentNewsIndex((prev) => (prev + 1) % noticias.length);
    }, 3000);
    return () => clearInterval(interval);
  }, [noticias, isCarouselPaused]);

  const handleSearchAddress = (addr, coords) => {
    setSearchAddress(addr);
    setSearchCoords(coords);
    setVista('mapa');
  };

  const handleCalculateRoute = async (origen, destino, modoLluvias) => {
    setRouteLoading(true);
    setRouteError(null);
    setRouteResult(null);
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

  const handlePrevNews = (e) => {
    e.stopPropagation();
    setCurrentNewsIndex((prev) => (prev === 0 ? noticias.length - 1 : prev - 1));
  };

  const handleNextNews = (e) => {
    e.stopPropagation();
    setCurrentNewsIndex((prev) => (prev + 1) % noticias.length);
  };

  const handleSetVistaDesdeIndex = (vista) => {
    setShowIndex(false);
    setVista(vista);
  };

  const handleSetVista = (vista) => {
    if (vista === 'estadisticas') {
      setShowIndex(true);
    } else {
      setShowIndex(false);
      setVista(vista);
    }
  };

  if (authLoading || appLoading) {
    return <Loader onFinish={() => setAppLoading(false)} />;
  }

  if (!user) {
    return (
      <>
        <Toaster position="top-right" />
        <Login />
      </>
    );
  }

  if (showIndex) {
    return (
      <>
        <Toaster position="top-right" />
        <Index setVista={handleSetVistaDesdeIndex} />
      </>
    );
  }

  return (
    <>
      <Toaster position="top-right" />
      <div style={{background: '#070a13'}} className="min-h-screen font-sans antialiased flex flex-col relative text-slate-200">
        <Navbar setVista={handleSetVista} />

        <main className="flex-1 w-full">
          {vista === 'mapa' ? (
  <div style={{ height:'calc(100vh - 52px)', position:'relative', overflow:'hidden' }}>

    {/* MAPA full screen */}
    <div style={{ position:'absolute', inset:0 }}>
      <MapSection
        onAddressSelect={(addr, pred) => { setSelectedAddress(addr); setPrediction(pred); }}
        zonasCriticas={zonasCriticas}
        estadisticas={estadisticas}
        searchCoords={searchCoords}
        searchAddress={searchAddress}
        onClearSearch={() => setSearchCoords(null)}
      />
    </div>

    {/* PANEL AI — fijo izquierda, translúcido */}
<div style={{
  position:'absolute', top:'10px', left:'12px', bottom:'90px',
  width:'350px', zIndex:400,
  background:'rgba(6, 8, 18, 0.67)',
  backdropFilter:'blur(20px)',
  WebkitBackdropFilter:'blur(20px)',
  border:'0.5px solid rgba(255, 255, 255, 0)',
  borderRadius:'14px',
  display:'flex', flexDirection:'column',
  overflow:'hidden',
  boxShadow:'0 8px 32px rgba(0, 0, 0, 0.39)',
}}>
      {/* Header del panel */}
      <div style={{
        padding:'10px 14px',
        borderBottom:'0.5px solid rgba(255,255,255,0.07)',
        display:'flex', alignItems:'center', justifyContent:'space-between',
        flexShrink:0,
      }}>
        <div style={{ display:'flex', alignItems:'center', gap:'8px' }}>
          <div style={{
            width:'24px', height:'24px', borderRadius:'8px',
            background:'rgba(99,102,241,0.2)',
            border:'1px solid rgba(99,102,241,0.35)',
            display:'flex', alignItems:'center', justifyContent:'center', fontSize:'12px',
          }}>🤖</div>
          <div>
            <div style={{ color:'#e2e8f0', fontSize:'12px', fontWeight:600 }}>Tu Asistente AI</div>
            <div style={{ color:'#475569', fontSize:'10px' }}>Análisis en tiempo real</div>
          </div>
        </div>
        <div style={{
          width:'7px', height:'7px', borderRadius:'50%',
          background:'#22c55e', boxShadow:'0 0 6px #22c55e',
        }} />
      </div>

      {/* Chat */}
      <div style={{ flex:1, overflow:'hidden', display:'flex', flexDirection:'column' }}>
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
          ) : vista === 'rutas' ? (
            <div className="max-w-2xl mx-auto space-y-6 my-6 p-4">
              <div className="bg-slate-900 rounded-xl border border-slate-800 p-6">
                <SafeRouteForm onCalculate={handleCalculateRoute} loading={routeLoading} />
              </div>
              {routeError && (
                <div className="bg-red-950/40 border border-red-900 rounded-xl p-4 text-red-400 text-sm">
                  {routeError}
                </div>
              )}
              {routeResult && (
                <div className="bg-slate-900 rounded-xl border border-slate-800 p-6">
                  <SafeRouteResult result={routeResult} onNewSearch={() => { setRouteResult(null); setRouteError(null); }} />
                </div>
              )}
            </div>
          ) : vista === 'trafico' ? (
            <div className="bg-slate-900 rounded-xl border border-slate-800 p-6 max-w-4xl mx-auto my-6">
              <TrafficIRL />
            </div>
          ) : (
            <div className="max-w-6xl mx-auto space-y-8 p-6">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div className="bg-slate-900 rounded-xl p-6 border border-slate-800">
                  <div className="text-3xl font-bold text-white">{estadisticas.total}</div>
                  <div className="text-sm text-slate-400 mt-1">Total Incidentes</div>
                </div>
                <div className="bg-slate-900 rounded-xl p-6 border border-slate-800">
                  <div className="text-3xl font-bold text-white">{estadisticas.lesionados}</div>
                  <div className="text-sm text-slate-400 mt-1">Personas Lesionadas</div>
                </div>
                <div className="bg-slate-900 rounded-xl p-6 border border-slate-800">
                  <div className="text-3xl font-bold text-white">{estadisticas.fatalidades}</div>
                  <div className="text-sm text-slate-400 mt-1">Víctimas Fatales</div>
                </div>
              </div>

              <div className="bg-slate-900 rounded-xl border border-slate-800 p-6">
                <NewsFeed 
                  noticias={noticias} 
                  loading={loadingNoticias} 
                  currentIndex={currentNewsIndex}
                  onPrev={handlePrevNews}
                  onNext={handleNextNews}
                  onPause={() => setIsCarouselPaused(true)}
                  onResume={() => setIsCarouselPaused(false)}
                />
              </div>

              <div className="bg-slate-900 rounded-xl border border-slate-800 p-6">
                <FotomultasTable infracciones={infracciones} />
              </div>
            </div>
          )}
        </main>
      </div>
    </>
  );
}

export default App;