import { useState } from 'react';
import { MapPin, Navigation, CloudRain, Loader2 } from 'lucide-react';

/**
 * Formulario de búsqueda de rutas seguras.
 * Acepta dirección de origen y destino en texto libre;
 * el backend las geocodifica via Nominatim (OSM).
 */
export default function SafeRouteForm({ onCalculate, loading }) {
  const [origen, setOrigen] = useState('');
  const [destino, setDestino] = useState('');
  const [modoLluvias, setModoLLuvias] = useState(true);

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!origen.trim() || !destino.trim()) return;
    onCalculate(origen.trim(), destino.trim(), modoLluvias);
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      {/* Punto de partida */}
      <div className='text-sm text-center font-semibold text-slate-300'>Ten en cuenta que el programa no toma las direcciones exactas del destino (#54-12)</div>
      <div>
        <label className="block text-sm font-semibold text-slate-300 mb-1.5 flex items-center gap-2">
          <MapPin className="w-4 h-4 text-emerald-400" />
          Punto de partida
        </label>
        <input
          type="text"
          value={origen}
          onChange={(e) => setOrigen(e.target.value)}
          placeholder="Cra 80"
          className="w-full bg-slate-900 border border-slate-600 rounded-lg px-4 py-2.5 text-sm text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-amber-500 focus:border-transparent transition"
          required
        />
      </div>

      {/* Punto de destino */}
      <div>
        <label className="block text-sm font-semibold text-slate-300 mb-1.5 flex items-center gap-2">
          <Navigation className="w-4 h-4 text-rose-400" />
          Punto de destino
        </label>
        <input
          type="text"
          value={destino}
          onChange={(e) => setDestino(e.target.value)}
          placeholder="Cl 10"
          className="w-full bg-slate-900 border border-slate-600 rounded-lg px-4 py-2.5 text-sm text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-amber-500 focus:border-transparent transition"
          required
        />
      </div>

      {/* Toggle modo lluvias */}
      <label className="flex items-center gap-3 cursor-pointer select-none">
        <button
          type="button"
          onClick={() => setModoLLuvias(!modoLluvias)}
          className={`relative w-11 h-6 rounded-full transition-colors ${
            modoLluvias ? 'bg-amber-500' : 'bg-slate-600'
          }`}
        >
          <span
            className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform ${
              modoLluvias ? 'translate-x-5' : 'translate-x-0'
            }`}
          />
        </button>
        <span className="text-sm text-slate-300 flex items-center gap-1.5">
          <CloudRain className="w-4 h-4 text-cyan-400" />
          Modo lluvias activo
          <span className="text-xs text-slate-500">(prioriza seguridad)</span>
        </span>
      </label>

      {/* Botón calcular */}
      <button
        type="submit"
        disabled={loading}
        className="w-full bg-amber-500 hover:bg-amber-600 disabled:bg-slate-600 disabled:cursor-not-allowed text-slate-900 font-bold py-3 rounded-lg transition flex items-center justify-center gap-2 shadow-lg"
      >
        {loading ? (
          <>
            <Loader2 className="w-5 h-5 animate-spin" />
            Calculando ruta...
          </>
        ) : (
          <>
            <Navigation className="w-5 h-5" />
            Calcular ruta segura
          </>
        )}
      </button>
    </form>
  );
}
