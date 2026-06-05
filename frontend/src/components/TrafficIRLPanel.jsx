import { useState } from 'react';
import { MapPin, Navigation, Route, Clock, Gauge, AlertTriangle, Loader2 } from 'lucide-react';

export default function TrafficIRLPanel({
  onCalculate,
  loading,
  error,
  routeData,
  selectedAlternative,
  onSelectAlternative
}) {
  const [origen, setOrigen] = useState('');
  const [destino, setDestino] = useState('');

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!origen.trim() || !destino.trim()) return;
    onCalculate(origen.trim(), destino.trim());
  };

  const main = routeData?.main_route;
  const mainSummary = main?.summary;
  const alternatives = routeData?.alternatives || [];
  const minutos = mainSummary ? Math.round(mainSummary.travelTimeInSeconds / 60) : 0;
  const retrasoMin = mainSummary ? Math.round((mainSummary.trafficDelayInSeconds || 0) / 60) : 0;
  const distanciaKm = mainSummary ? (mainSummary.lengthInMeters / 1000).toFixed(1) : 0;
  const velocidad = main?.average_speed_kmh;

  // Congestion level based on speed
  let congestionLevel = 'bajo';
  let congestionColor = '#22c55e';
  if (velocidad) {
    if (velocidad < 15) { congestionLevel = 'severe'; congestionColor = '#dc2626'; }
    else if (velocidad < 25) { congestionLevel = 'high'; congestionColor = '#ea580c'; }
    else if (velocidad < 40) { congestionLevel = 'moderate'; congestionColor = '#eab308'; }
  }

  return (
    <div className="bg-slate-800 rounded-xl border border-slate-700 shadow-lg p-5 h-full overflow-y-auto">
      <h2 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
        <Route className="w-5 h-5 text-amber-400" />
        Tráfico IRL
      </h2>

      <form onSubmit={handleSubmit} className="space-y-4">
        {/* Origen */}
        <div>
          <label className="block text-sm font-semibold text-slate-300 mb-1.5 flex items-center gap-2">
            <MapPin className="w-4 h-4 text-emerald-400" />
            Punto de partida
          </label>
          <input
            type="text"
            value={origen}
            onChange={(e) => setOrigen(e.target.value)}
            placeholder="Cra 80 # 30-15, Medellín"
            className="w-full bg-slate-900 border border-slate-600 rounded-lg px-4 py-2.5 text-sm text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-amber-500 focus:border-transparent transition"
            required
          />
        </div>

        {/* Destino */}
        <div>
          <label className="block text-sm font-semibold text-slate-300 mb-1.5 flex items-center gap-2">
            <Navigation className="w-4 h-4 text-rose-400" />
            Punto de destino
          </label>
          <input
            type="text"
            value={destino}
            onChange={(e) => setDestino(e.target.value)}
            placeholder="Cl 10 # 41-20, Medellín"
            className="w-full bg-slate-900 border border-slate-600 rounded-lg px-4 py-2.5 text-sm text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-amber-500 focus:border-transparent transition"
            required
          />
        </div>

        {/* Submit */}
        <button
          type="submit"
          disabled={loading}
          className="w-full bg-amber-500 hover:bg-amber-600 disabled:bg-slate-600 disabled:cursor-not-allowed text-slate-900 font-bold py-3 rounded-lg transition flex items-center justify-center gap-2 shadow-lg"
        >
          {loading ? (
            <><Loader2 className="w-5 h-5 animate-spin" /> Calculando ruta...</>
          ) : (
            <><Route className="w-5 h-5" /> Calcular Ruta</>
          )}
        </button>
      </form>

      {/* Error */}
      {error && (
        <div className="mt-4 bg-rose-900/40 border border-rose-700 rounded-xl p-4 text-rose-300 text-sm">
          {error}
        </div>
      )}

      {/* Results */}
      {routeData && !error && (
        <div className="mt-6 space-y-4">
          <hr className="border-slate-700" />
          <h3 className="text-sm font-bold text-slate-300 uppercase tracking-wider">Resultados</h3>

          {/* Speed gauge */}
          <div className="bg-slate-900/50 rounded-xl p-4 border border-slate-700">
            <div className="flex items-center gap-2 mb-1">
              <Gauge className="w-5 h-5 text-amber-400" />
              <span className="text-xs font-semibold uppercase text-slate-400">Velocidad promedio</span>
            </div>
            <p className="text-3xl font-extrabold text-white">
              {velocidad?.toFixed(0) || '--'} <span className="text-sm font-normal text-slate-400">km/h</span>
            </p>
            {/* Speed bar */}
            <div className="mt-2 h-2 bg-slate-700 rounded-full overflow-hidden">
              <div
                className="h-full rounded-full transition-all"
                style={{
                  width: `${Math.min((velocidad || 0) / 60 * 100, 100)}%`,
                  backgroundColor: congestionColor,
                }}
              />
            </div>
            <span className="inline-block mt-1.5 text-xs font-bold px-2 py-0.5 rounded capitalize"
              style={{ backgroundColor: congestionColor + '33', color: congestionColor }}>
              Tráfico {congestionLevel}
            </span>
          </div>

          {/* Stats grid */}
          <div className="grid grid-cols-2 gap-3">
            <div className="bg-slate-900/50 rounded-xl p-3 border border-slate-700">
              <div className="flex items-center gap-1.5 mb-1">
                <Clock className="w-4 h-4 text-cyan-400" />
                <span className="text-[10px] font-semibold uppercase text-slate-400">Duración</span>
              </div>
              <p className="text-xl font-extrabold text-white">{minutos} <span className="text-xs font-normal text-slate-400">min</span></p>
            </div>
            <div className="bg-slate-900/50 rounded-xl p-3 border border-slate-700">
              <div className="flex items-center gap-1.5 mb-1">
                <MapPin className="w-4 h-4 text-indigo-400" />
                <span className="text-[10px] font-semibold uppercase text-slate-400">Distancia</span>
              </div>
              <p className="text-xl font-extrabold text-white">{distanciaKm} <span className="text-xs font-normal text-slate-400">km</span></p>
            </div>
          </div>

          {/* Traffic delay */}
          {retrasoMin > 0 && (
            <div className="bg-rose-900/30 border border-rose-700 rounded-xl p-3 flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-rose-400 shrink-0" />
              <div>
                <p className="text-xs font-bold text-rose-300">Retraso por tráfico</p>
                <p className="text-sm text-rose-200">{retrasoMin} min adicionales</p>
              </div>
            </div>
          )}

          {/* Alternatives */}
          {alternatives.length > 0 && (
            <div>
              <h4 className="text-sm font-bold text-slate-300 mb-2">Rutas alternativas</h4>
              <div className="space-y-2">
                {alternatives.map((alt, idx) => (
                  <button
                    key={idx}
                    onClick={() => onSelectAlternative(idx)}
                    className={`w-full text-left p-3 rounded-lg border transition flex items-center justify-between ${
                      selectedAlternative === idx
                        ? 'bg-blue-900/40 border-blue-600'
                        : 'bg-slate-900/50 border-slate-700 hover:border-slate-500'
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      <div className={`w-4 h-4 rounded-full border-2 flex items-center justify-center ${
                        selectedAlternative === idx ? 'border-blue-400' : 'border-slate-500'
                      }`}>
                        {selectedAlternative === idx && <div className="w-2 h-2 rounded-full bg-blue-400" />}
                      </div>
                      <div>
                        <p className="text-sm font-medium text-white">Ruta {idx + 1}</p>
                        <p className="text-xs text-slate-400">{alt.average_speed_kmh?.toFixed(0)} km/h</p>
                      </div>
                    </div>
                    <span className="text-xs text-slate-400">
                      {alt.summary?.travelTimeInSeconds ? `${Math.round(alt.summary.travelTimeInSeconds / 60)} min` : ''}
                    </span>
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
