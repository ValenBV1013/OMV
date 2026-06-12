import { useState } from 'react';
import { MapPin, Navigation, CloudRain, Loader2, Shield, Zap, Map, Route, Activity } from 'lucide-react';

/**
 * Formulario de búsqueda de rutas seguras.
 * Acepta dirección de origen y destino en texto libre;
 * el backend las geocodifica via Nominatim (OSM).
 */
export default function SafeRouteForm({ onCalculate, loading }) {
  const [origen, setOrigen] = useState('');
  const [destino, setDestino] = useState('');
  const [modoLluvias, setModoLLuvias] = useState(true);
  const [mostrarForm, setMostrarForm] = useState(true);

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!origen.trim() || !destino.trim()) return;
    setMostrarForm(false);
    onCalculate(origen.trim(), destino.trim(), modoLluvias);
  };

  // Pantalla de carga animada
  if (loading && !mostrarForm) {
    return (
      <div className="fixed inset-0 bg-[#0a0a1a] flex flex-col items-center justify-center z-50 overflow-hidden">
        {/* Efectos de glow decorativos animados */}
        <div className="absolute top-1/4 left-1/4 w-64 h-64 bg-fuchsia-600/20 rounded-full blur-3xl animate-pulse" />
        <div className="absolute bottom-1/4 right-1/4 w-64 h-64 bg-violet-600/20 rounded-full blur-3xl animate-pulse" style={{ animationDelay: '1s' }} />
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-96 h-96 bg-cyan-600/10 rounded-full blur-3xl animate-pulse" style={{ animationDelay: '0.5s' }} />
        
        {/* Icono central animado */}
        <div className="relative mb-8">
          <div className="absolute inset-0 bg-gradient-to-r from-fuchsia-500 to-violet-600 rounded-full blur-xl opacity-60 animate-ping" style={{ animationDuration: '2s' }} />
          <div className="relative p-4 rounded-full bg-gradient-to-br from-fuchsia-500 to-violet-600 shadow-lg shadow-fuchsia-500/30">
            <Route className="w-10 h-10 text-white animate-spin" style={{ animationDuration: '3s' }} />
          </div>
        </div>

        {/* Texto de carga */}
        <h2 className="text-2xl font-bold text-white mb-2 tracking-tight">
          Calculando ruta segura
        </h2>
        <p className="text-violet-300/60 text-sm mb-8">
          Analizando condiciones de seguridad...
        </p>

        {/* Barras de progreso animadas */}
        <div className="w-80 space-y-3">
          <div className="flex items-center gap-3">
            <Map className="w-4 h-4 text-cyan-400 shrink-0" />
            <div className="flex-1 h-2 bg-violet-950/60 rounded-full overflow-hidden">
              <div className="h-full bg-gradient-to-r from-cyan-400 to-blue-500 rounded-full animate-[loading_1.5s_ease-in-out_infinite]" style={{ width: '60%' }} />
            </div>
            <span className="text-xs text-cyan-400 font-mono w-16">Geocodificando</span>
          </div>
          
          <div className="flex items-center gap-3">
            <Activity className="w-4 h-4 text-fuchsia-400 shrink-0" />
            <div className="flex-1 h-2 bg-violet-950/60 rounded-full overflow-hidden">
              <div className="h-full bg-gradient-to-r from-fuchsia-400 to-violet-500 rounded-full animate-[loading_2s_ease-in-out_infinite]" style={{ width: '40%', animationDelay: '0.3s' }} />
            </div>
            <span className="text-xs text-fuchsia-400 font-mono w-16">Analizando</span>
          </div>
          
          <div className="flex items-center gap-3">
            <Zap className="w-4 h-4 text-amber-400 shrink-0" />
            <div className="flex-1 h-2 bg-violet-950/60 rounded-full overflow-hidden">
              <div className="h-full bg-gradient-to-r from-amber-400 to-orange-500 rounded-full animate-[loading_2.5s_ease-in-out_infinite]" style={{ width: '20%', animationDelay: '0.6s' }} />
            </div>
            <span className="text-xs text-amber-400 font-mono w-16">Optimizando</span>
          </div>
        </div>

        {/* Puntos animados */}
        <div className="flex gap-2 mt-8">
          <span className="w-2 h-2 rounded-full bg-cyan-400 animate-bounce" style={{ animationDelay: '0s' }} />
          <span className="w-2 h-2 rounded-full bg-fuchsia-400 animate-bounce" style={{ animationDelay: '0.2s' }} />
          <span className="w-2 h-2 rounded-full bg-violet-400 animate-bounce" style={{ animationDelay: '0.4s' }} />
        </div>
      </div>
    );
  }

  if (!mostrarForm) {
    return null;
  }

  return (
    <div className="relative">
      {/* Efecto de glow decorativo */}
      <div className="absolute -top-20 -right-20 w-64 h-64 bg-fuchsia-600/20 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute -bottom-20 -left-20 w-64 h-64 bg-violet-600/20 rounded-full blur-3xl pointer-events-none" />
      
      <form onSubmit={handleSubmit} className="space-y-5 relative z-10">
        {/* Header con estilo de la imagen */}
        <div className="text-center mb-6">
          <div className="inline-flex items-center justify-center w-12 h-12 rounded-xl bg-gradient-to-br from-violet-500 to-fuchsia-600 mb-3 shadow-lg shadow-fuchsia-500/25">
            <Shield className="w-6 h-6 text-white" />
          </div>
          <h1 className="text-xl font-bold text-white tracking-tight">
            Resultado de ruta segura
          </h1>
          <p className="text-xs text-violet-300/70 mt-1">Ruta optimizada por seguridad</p>
        </div>

        {/* Nota */}
        <div className="text-xs text-center font-medium text-violet-300/60 bg-violet-950/50 border border-violet-800/50 rounded-lg px-3 py-2">
          Ten en cuenta que el programa no toma las direcciones exactas del destino (#54-12)
        </div>

        {/* Punto de partida */}
        <div className="group">
          <label className="block text-sm font-semibold text-violet-200 mb-2 flex items-center gap-2">
            <MapPin className="w-4 h-4 text-fuchsia-400" />
            Punto de partida
          </label>
          <input
            type="text"
            value={origen}
            onChange={(e) => setOrigen(e.target.value)}
            placeholder="Cra 80"
            className="w-full bg-black/40 border border-violet-800/60 rounded-xl px-4 py-3 text-sm text-white placeholder-violet-500/50 focus:outline-none focus:ring-2 focus:ring-fuchsia-500/50 focus:border-fuchsia-500/50 transition-all backdrop-blur-sm"
            required
          />
        </div>

        {/* Punto de destino */}
        <div className="group">
          <label className="block text-sm font-semibold text-violet-200 mb-2 flex items-center gap-2">
            <Navigation className="w-4 h-4 text-rose-400" />
            Punto de destino
          </label>
          <input
            type="text"
            value={destino}
            onChange={(e) => setDestino(e.target.value)}
            placeholder="Cl 10"
            className="w-full bg-black/40 border border-violet-800/60 rounded-xl px-4 py-3 text-sm text-white placeholder-violet-500/50 focus:outline-none focus:ring-2 focus:ring-fuchsia-500/50 focus:border-fuchsia-500/50 transition-all backdrop-blur-sm"
            required
          />
        </div>

        {/* Toggle modo lluvias */}
        <label className="flex items-center gap-3 cursor-pointer select-none bg-black/30 rounded-xl p-3 border border-violet-800/40">
          <button
            type="button"
            onClick={() => setModoLLuvias(!modoLluvias)}
            className={`relative w-11 h-6 rounded-full transition-all duration-300 ${
              modoLluvias 
                ? 'bg-gradient-to-r from-cyan-500 to-blue-500 shadow-lg shadow-cyan-500/30' 
                : 'bg-violet-900/60 border border-violet-700/50'
            }`}
          >
            <span
              className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform duration-300 ${
                modoLluvias ? 'translate-x-5' : 'translate-x-0'
              }`}
            />
          </button>
          <span className="text-sm text-violet-200 flex items-center gap-1.5">
            <CloudRain className="w-4 h-4 text-cyan-400" />
            Modo lluvias activo
            <span className="text-xs text-violet-400/60">(prioriza seguridad)</span>
          </span>
        </label>

        {/* Botón calcular */}
        <button
          type="submit"
          disabled={loading}
          className="w-full bg-gradient-to-r from-fuchsia-600 to-violet-600 hover:from-fuchsia-500 hover:to-violet-500 disabled:from-violet-900 disabled:to-violet-900 disabled:cursor-not-allowed text-white font-bold py-3.5 rounded-xl transition-all duration-300 flex items-center justify-center gap-2 shadow-lg shadow-fuchsia-900/30 hover:shadow-fuchsia-500/20 hover:scale-[1.02] active:scale-[0.98]"
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
    </div>
  );
}