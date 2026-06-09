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
import { useAuth } from './context/AuthContext';
import Login from './components/Login';
import { Toaster } from 'react-hot-toast';

// --- IMPORTACIÓN DE IMÁGENES PNG LOCALES ---
import imgVarianteCaldas from './assets/variante_caldas.png';
import imgSanJuan from './assets/accidente_san_juan.png';
import imgTunelOriente from './assets/tunel_oriente.png';

// --- DATOS DE RESPALDO (MOCK) CON latitud/longitud ---
const mockZonasCriticas = [
  { id: 1, sector_geografico: "Autopista Sur", latitud: 6.2442, longitud: -75.5812, total_accidentes: 45, total_lesionados: 32, total_fatalidades: 5, nivel_riesgo: "Alto", nivel_riesgo_predictivo: 78 },
  { id: 2, sector_geografico: "Calle 30", latitud: 6.2530, longitud: -75.5634, total_accidentes: 38, total_lesionados: 27, total_fatalidades: 3, nivel_riesgo: "Medio", nivel_riesgo_predictivo: 65 },
  { id: 3, sector_geografico: "Parque de los Deseos", latitud: 6.2670, longitud: -75.5700, total_accidentes: 12, total_lesionados: 9, total_fatalidades: 0, nivel_riesgo: "Bajo", nivel_riesgo_predictivo: 25 }
];

const mockInfracciones = [
  { id: 1, lugar: "Carrera 50 con Calle 10", tipo: "Fotomulta", valor: 450000, fecha: "2025-02-10" },
];

const RESPALDO_NOTICIAS = [
  { id: "fb-1", titulo: "En la variante a Caldas van nueve muertos: es la vía más letal del Valle de Aburrá", descripcion: "De acuerdo con los reportes judiciales, todas las víctimas...", imagen: imgVarianteCaldas, tipo_alerta_display: "Crítico", url: "https://www.elcolombiano.com/antioquia/accidentes-variante-a-caldas-medellin-MF35659335" },
  { id: "fb-2", titulo: "Un motociclista y un peatón muertos en trágicos accidentes de tránsito en Medellín", descripcion: "La ciudad sumó nuevas fatalidades viales...", imagen: imgSanJuan, tipo_alerta_display: "Crítico", url: "https://qhubomedellin.com/actualidad/movilidad/un-motociclista-y-un-peaton-muertos-en-accidentes-de-transito-en-medellin-HH34002140" },
  { id: "fb-3", titulo: "Una persona murió tras choque de camioneta contra una caseta en el Túnel de Oriente", descripcion: "Un trágico accidente de tránsito se registró en la mañana...", imagen: imgTunelOriente, tipo_alerta_display: "Crítico", url: "https://www.elcolombiano.com/antioquia/una-persona-murio-tras-choque-de-camioneta-contra-una-caseta-en-el-tunel-de-oriente-GI36584222" }
];

function App() {
  const [appLoading, setAppLoading] = useState(true);
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

  const [estadisticas, setEstadisticas] = useState({ total: 0, lesionados: 0, fatalidades: 0 });

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

  return (
    <>
      <Toaster position="top-right" />
      <div className="bg-slate-900 min-h-screen font-sans antialiased text-slate-100 flex flex-col">
        <Navbar setVista={setVista} />

        {/* Solo cambié el padding y agregué un contenedor centrado con max-w-7xl */}
        <main className="flex-1 w-full max-w-7xl mx-auto px-4 py-6 lg:py-8">
          {vista === 'mapa' ? (
            <div className="relative w-full h-[calc(100vh-120px)] min-h-[500px]">
              <div className="absolute inset-0 z-0 rounded-xl overflow-hidden shadow-2xl border border-slate-700">
                <MapSection 
                  onAddressSelect={(addr, pred) => { setSelectedAddress(addr); setPrediction(pred); }}
                  zonasCriticas={zonasCriticas}
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
                    zonasCriticas={zonasCriticas}
                    noticias={noticias}
                    onSearchAddress={handleSearchAddress}
                  />
                </div>
              </div>
              <div className="absolute bottom-4 left-4 right-104 z-10 bg-slate-950/90 backdrop-blur-md text-slate-300 rounded-xl px-5 py-3 shadow-2xl border border-slate-700/60 pointer-events-auto">
                <div className="flex flex-wrap items-center justify-start gap-6 text-[11px] font-medium tracking-wide">
                  <div className="text-slate-500 font-bold tracking-widest uppercase border-r border-slate-800 pr-5">
                    • LEYENDA
                  </div>
                  <div className="flex items-center gap-4 border-r border-slate-800 pr-5">
                    <span className="text-slate-400 font-bold uppercase tracking-wider text-[10px]">Tráfico</span>
                    <div className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 bg-red-500 rounded-full shadow-md shadow-red-500/30"></span><span>Alta</span></div>
                    <div className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 bg-amber-500 rounded-full shadow-md shadow-amber-500/30"></span><span>Media</span></div>
                    <div className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 bg-emerald-500 rounded-full shadow-md shadow-emerald-500/30"></span><span>Baja</span></div>
                  </div>
                  <div className="flex items-center gap-4">
                    <span className="text-slate-400 font-bold uppercase tracking-wider text-[10px]">Riesgo Vial</span>
                    <div className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 bg-red-900 rounded-full border border-red-500/50 animate-pulse"></span><span className="text-red-400 font-medium">Crítica</span></div>
                    <div className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 bg-red-500 rounded-full"></span><span>Alto</span></div>
                    <div className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 bg-amber-500 rounded-full"></span><span>Medio</span></div>
                    <div className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 bg-emerald-500 rounded-full"></span><span>Bajo</span></div>
                  </div>
                </div>
              </div>
            </div>

          ) : vista === 'rutas' ? (
            <div className="max-w-2xl mx-auto space-y-6" id="rutas-seguras">
              <div className="bg-slate-800 rounded-xl p-6 border border-slate-700 shadow-lg">
                <SafeRouteForm onCalculate={handleCalculateRoute} loading={routeLoading} />
              </div>
              {routeError && (
                <div className="bg-rose-900/40 border border-rose-700 rounded-xl p-4 text-rose-300 text-sm">
                  {routeError}
                </div>
              )}
              {routeResult && (
                <div className="bg-slate-800 rounded-xl p-6 border border-slate-700 shadow-lg">
                  <SafeRouteResult
                    result={routeResult}
                    onNewSearch={() => {
                      setRouteResult(null);
                      setRouteError(null);
                    }}
                  />
                </div>
              )}
            </div>

          ) : vista === 'trafico' ? (
            <div id="trafico-irl" className="h-full">
              <TrafficIRL />
            </div>

          ) : (
            <div className="space-y-8">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div className="bg-gradient-to-br from-rose-600 to-rose-700 rounded-xl p-6 text-white shadow-lg">
                  <div className="text-4xl font-extrabold mb-1">{estadisticas.total}</div>
                  <div className="text-sm font-medium uppercase tracking-wider opacity-90">Total Incidentes Registrados</div>
                  <div className="text-xs mt-3 bg-rose-800/40 px-2 py-1 rounded inline-block">⬆️ +12% vs mes anterior</div>
                </div>
                <div className="bg-gradient-to-br from-amber-500 to-amber-600 rounded-xl p-6 text-slate-950 shadow-lg">
                  <div className="text-4xl font-extrabold mb-1">{estadisticas.lesionados}</div>
                  <div className="text-sm font-medium uppercase tracking-wider opacity-95">Personas Lesionadas</div>
                  <div className="text-xs mt-3 bg-amber-600/30 px-2 py-1 rounded inline-block font-semibold">🚑 85% requirieron traslados</div>
                </div>
                <div className="bg-gradient-to-br from-slate-700 to-slate-800 rounded-xl p-6 text-slate-100 shadow-lg border border-slate-600">
                  <div className="text-4xl font-extrabold mb-1">{estadisticas.fatalidades}</div>
                  <div className="text-sm font-medium uppercase tracking-wider opacity-90">Víctimas Fatales</div>
                  <div className="text-xs mt-3 bg-slate-600/40 px-2 py-1 rounded inline-block">⚠️ -5% vs año pasado</div>
                </div>
              </div>

              <div className="bg-slate-800 rounded-xl p-6 border border-slate-700 shadow-lg">
                <h2 className="text-xl font-bold text-white mb-4 flex items-center gap-2">🚨 Puntos Críticos Identificados</h2>
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="bg-slate-700 text-gray-100 text-sm uppercase tracking-wider">
                        <th className="p-3 rounded-l-lg">Sector Geográfico</th>
                        <th className="p-3">Accidentes</th>
                        <th className="p-3">Lesionados</th>
                        <th className="p-3">Fatalidades</th>
                        <th className="p-3 text-center">Riesgo Predictivo</th>
                        <th className="p-3 text-center rounded-r-lg">Acción</th>
                       </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-600 text-sm">
                      {zonasCriticas.map((zona) => (
                        <tr key={zona.id} className="hover:bg-slate-700/70 transition-colors">
                          <td className="p-3 text-gray-100 font-semibold">{zona.sector_geografico || zona.nombre}</td>
                          <td className="p-3 text-rose-400 font-bold">{zona.total_accidentes || 0}</td>
                          <td className="p-3 text-amber-400 font-bold">{zona.total_lesionados || 0}</td>
                          <td className="p-3 text-gray-400 font-bold">{zona.total_fatalidades || 0}</td>
                          <td className="p-3 text-center">
                            <span className="bg-slate-900 px-3 py-1 rounded-full text-amber-400 font-mono font-bold border border-slate-600">
                              {zona.nivel_riesgo_predictivo || 0}%
                            </span>
                          </td>
                          <td className="p-3 text-center">
                            <button 
                              onClick={() => setVista('mapa')}
                              className="bg-amber-500 hover:bg-amber-600 text-black text-xs font-bold px-3 py-1.5 rounded-lg transition shadow"
                            >
                              Ver en Mapa
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              <div className="bg-slate-800 rounded-xl p-6 border border-slate-700 shadow-lg">
                <div className="flex justify-between items-center mb-4">
                  <h2 className="text-xl font-bold text-white flex items-center gap-2">📰 Siniestros e Información Vial (Última Hora)</h2>
                  {loadingNoticias && <span className="text-xs text-amber-400 animate-pulse">Sincronizando...</span>}
                </div>
                {noticias.length > 0 ? (
                  <div 
                    className="bg-slate-900 rounded-xl border border-slate-700 flex flex-col md:flex-row transition-all duration-500 hover:border-slate-500"
                    onMouseEnter={() => setIsCarouselPaused(true)}
                    onMouseLeave={() => setIsCarouselPaused(false)}
                  >
                    <div className="w-full md:w-1/3 h-48 md:h-64 overflow-hidden relative group">
                      <button onClick={handlePrevNews} className="absolute left-3 top-1/2 -translate-y-1/2 z-40 bg-white/10 backdrop-blur-md border border-white/20 hover:bg-white/20 text-white w-9 h-9 rounded-full flex items-center justify-center shadow-lg transition-all duration-200 cursor-pointer text-sm font-bold">◀</button>
                      <button onClick={handleNextNews} className="absolute right-3 top-1/2 -translate-y-1/2 z-40 bg-white/10 backdrop-blur-md border border-white/20 hover:bg-white/20 text-white w-9 h-9 rounded-full flex items-center justify-center shadow-lg transition-all duration-200 cursor-pointer text-sm font-bold">▶</button>
                      <img 
                        src={noticias[currentNewsIndex].imagen} 
                        alt="Registro de movilidad"
                        className="w-full h-full object-cover transition-transform duration-700 hover:scale-105"
                      />
                      <span className={`absolute top-3 left-3 text-xs px-2 py-1 rounded font-bold shadow z-30 ${noticias[currentNewsIndex].tipo_alerta_display === 'Crítico' ? 'bg-rose-600 text-white' : 'bg-amber-500 text-slate-950'}`}>
                        {noticias[currentNewsIndex].tipo_alerta_display}
                      </span>
                    </div>
                    <div className="p-6 flex flex-col justify-between flex-1">
                      <div>
                        <h3 className="font-bold text-xl text-amber-400 mb-3 line-clamp-2">{noticias[currentNewsIndex].titulo}</h3>
                        <p className="text-sm text-slate-300 leading-relaxed line-clamp-3 md:line-clamp-4">{noticias[currentNewsIndex].descripcion}</p>
                      </div>
                      <div className="pt-4 border-t border-slate-800 flex justify-between items-center mt-4">
                        <a href={noticias[currentNewsIndex].url} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-sm font-bold text-amber-500 hover:text-amber-400 transition">
                          Ver noticia original completa 🔗
                        </a>
                        <span className="text-xs text-slate-500 font-mono">Noticia {currentNewsIndex + 1} de {noticias.length}</span>
                      </div>
                    </div>
                  </div>
                ) : (
                  <p className="text-sm text-slate-400 text-center py-8">No hay alertas en este momento.</p>
                )}
              </div>

              <div className="bg-slate-800 rounded-xl p-6 border border-slate-700 shadow-lg">
                <FotomultasTable infracciones={infracciones} />
              </div>
            </div>
          )}
        </main>

        <footer className="bg-slate-950 text-slate-500 text-xs py-6 text-center border-t border-slate-800 mt-auto">
          <p>© 2026 OMV - Observatorio de Mitigación Vial.</p>
        </footer>
      </div>
    </>
  );
}

export default App;