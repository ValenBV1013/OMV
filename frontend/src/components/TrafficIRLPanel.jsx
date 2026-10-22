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
  let congestionColor = '#22d3ee';
  if (velocidad) {
    if (velocidad < 15) { congestionLevel = 'severe'; congestionColor = '#f43f5e'; }
    else if (velocidad < 25) { congestionLevel = 'high'; congestionColor = '#f97316'; }
    else if (velocidad < 40) { congestionLevel = 'moderate'; congestionColor = '#fbbf24'; }
  }

  return (
    <div className="bg-[#0f0f2a] rounded-xl border border-violet-800/50 shadow-lg p-5 h-full overflow-y-auto">
      <h2 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
        <Route className="w-5 h-5 text-fuchsia-400" />
        Tráfico IRL
      </h2>

      <form onSubmit={handleSubmit} className="space-y-4">
        {/* Origen */}
        <div>
          <label className="block text-sm font-semibold text-violet-200 mb-1.5 flex items-center gap-2">
            <MapPin className="w-4 h-4 text-fuchsia-400" />
            Punto de partida
          </label>
          <input
            type="text"
            value={origen}
            onChange={(e) => setOrigen(e.target.value)}
            placeholder="Cra 80 # 30-15, Medellín"
            className="w-full bg-black/40 border border-violet-800/60 rounded-xl px-4 py-2.5 text-sm text-white placeholder-violet-500/50 focus:outline-none focus:ring-2 focus:ring-fuchsia-500/50 focus:border-fuchsia-500/50 transition-all backdrop-blur-sm"
            required
          />
        </div>

        {/* Destino */}
        <div>
          <label className="block text-sm font-semibold text-violet-200 mb-1.5 flex items-center gap-2">
            <Navigation className="w-4 h-4 text-rose-400" />
            Punto de destino
          </label>
          <input
            type="text"
            value={destino}
            onChange={(e) => setDestino(e.target.value)}
            placeholder="Cl 10 # 41-20, Medellín"
            className="w-full bg-black/40 border border-violet-800/60 rounded-xl px-4 py-2.5 text-sm text-white placeholder-violet-500/50 focus:outline-none focus:ring-2 focus:ring-fuchsia-500/50 focus:border-fuchsia-500/50 transition-all backdrop-blur-sm"
            required
          />
        </div>

        {/* Submit */}
        <button
          type="submit"
          disabled={loading}
          className="w-full bg-gradient-to-r from-fuchsia-600 to-violet-600 hover:from-fuchsia-500 hover:to-violet-500 disabled:from-violet-900 disabled:to-violet-900 disabled:cursor-not-allowed text-white font-bold py-3 rounded-xl transition-all duration-300 flex items-center justify-center gap-2 shadow-lg shadow-fuchsia-900/30 hover:shadow-fuchsia-500/20"
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
        <div className="mt-4 bg-rose-950/40 border border-rose-700/50 rounded-xl p-4 text-rose-300 text-sm">
          {error}
        </div>
      )}

      {/* Results */}
      {routeData && !error && (
        <div className="mt-6 space-y-4">
          <hr className="border-violet-900/30" />
          <h3 className="text-sm font-bold text-violet-300 uppercase tracking-wider">Resultados</h3>

          {/* Speed gauge */}
          <div className="bg-black/40 backdrop-blur-sm rounded-xl p-4 border border-violet-800/50">
            <div className="flex items-center gap-2 mb-1">
              <Gauge className="w-5 h-5 text-amber-400" />
              <span className="text-xs font-semibold uppercase text-violet-400/70">Velocidad promedio</span>
            </div>
            <p className="text-3xl font-extrabold text-white">
              {velocidad?.toFixed(0) || '--'} <span className="text-sm font-normal text-violet-400/60">km/h</span>
            </p>
            {/* Speed bar */}
            <div className="mt-2 h-2 bg-violet-900/50 rounded-full overflow-hidden">
              <div
                className="h-full rounded-full transition-all"
                style={{
                  width: `${Math.min((velocidad || 0) / 60 * 100, 100)}%`,
                  backgroundColor: congestionColor,
                }}
              />
            </div>
            <span className="inline-block mt-1.5 text-xs font-bold px-2 py-0.5 rounded capitalize bg-black/60 text-white border border-violet-800/50">
              Tráfico {congestionLevel}
            </span>
          </div>

          {/* Stats grid */}
          <div className="grid grid-cols-2 gap-3">
            <div className="bg-black/40 backdrop-blur-sm rounded-xl p-3 border border-violet-800/50">
              <div className="flex items-center gap-1.5 mb-1">
                <Clock className="w-4 h-4 text-cyan-400" />
                <span className="text-[10px] font-semibold uppercase text-violet-400/70">Duración</span>
              </div>
              <p className="text-xl font-extrabold text-white">{minutos} <span className="text-xs font-normal text-violet-400/60">min</span></p>
            </div>
            <div className="bg-black/40 backdrop-blur-sm rounded-xl p-3 border border-violet-800/50">
              <div className="flex items-center gap-1.5 mb-1">
                <MapPin className="w-4 h-4 text-fuchsia-400" />
                <span className="text-[10px] font-semibold uppercase text-violet-400/70">Distancia</span>
              </div>
              <p className="text-xl font-extrabold text-white">{distanciaKm} <span className="text-xs font-normal text-violet-400/60">km</span></p>
            </div>
          </div>

          {/* Traffic delay */}
          {retrasoMin > 0 && (
            <div className="bg-rose-950/40 border border-rose-700/50 rounded-xl p-3 flex items-center gap-2">
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
              <h4 className="text-sm font-bold text-violet-200 mb-2">Rutas alternativas</h4>
              <div className="space-y-2">
                {alternatives.map((alt, idx) => (
                  <button
                    key={idx}
                    onClick={() => onSelectAlternative(idx)}
                    className={`w-full text-left p-3 rounded-lg border transition flex items-center justify-between ${
                      selectedAlternative === idx
                        ? 'bg-blue-950/40 border-blue-600/50'
                        : 'bg-black/40 border-violet-800/50 hover:border-violet-600/50'
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      <div className={`w-4 h-4 rounded-full border-2 flex items-center justify-center ${
                        selectedAlternative === idx ? 'border-cyan-400' : 'border-violet-600'
                      }`}>
                        {selectedAlternative === idx && <div className="w-2 h-2 rounded-full bg-cyan-400" />}
                      </div>
                      <div>
                        <p className="text-sm font-medium text-white">Ruta {idx + 1}</p>
                        <p className="text-xs text-violet-400/60">{alt.average_speed_kmh?.toFixed(0)} km/h</p>
                      </div>
                    </div>
                    <span className="text-xs text-violet-400/60">
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