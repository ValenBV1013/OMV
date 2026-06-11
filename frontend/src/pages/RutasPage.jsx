import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import Navbar from '../components/Navbar';
import SafeRouteForm from '../components/SafeRouteForm';
import SafeRouteResult from '../components/SafeRouteResult';
import { getSafeRoute } from '../services/safeRoutesApi';

export default function RutasPage() {
  const navigate = useNavigate();
  const [routeResult,  setRouteResult]  = useState(null);
  const [routeLoading, setRouteLoading] = useState(false);
  const [routeError,   setRouteError]   = useState(null);

  const handleSetVista = (vista) => {
    if (vista === 'estadisticas') navigate('/');
    else navigate(`/${vista}`);
  };

  const handleCalculateRoute = async (origen, destino, modoLluvias) => {
    setRouteLoading(true); setRouteError(null); setRouteResult(null);
    try {
      const result = await getSafeRoute(origen, destino, modoLluvias);
      if (result.error) setRouteError(result.error);
      else setRouteResult(result);
    } catch (err) {
      setRouteError(err.response?.data?.error || err.message || 'Error al calcular la ruta');
    } finally { setRouteLoading(false); }
  };

  return (
    <div className="bg-slate-900 min-h-screen text-slate-100">
      <Navbar setVista={handleSetVista} />
      <main className="max-w-2xl mx-auto px-4 py-10 space-y-6">
        <div className="bg-slate-800 rounded-xl p-6 border border-slate-700 shadow-lg">
          <SafeRouteForm onCalculate={handleCalculateRoute} loading={routeLoading} />
        </div>
        {routeError && (
          <div className="bg-rose-900/40 border border-rose-700 rounded-xl p-4 text-rose-300 text-sm">{routeError}</div>
        )}
        {routeResult && (
          <div className="bg-slate-800 rounded-xl p-6 border border-slate-700 shadow-lg">
            <SafeRouteResult result={routeResult} onNewSearch={() => { setRouteResult(null); setRouteError(null); }} />
          </div>
        )}
      </main>
    </div>
  );
}