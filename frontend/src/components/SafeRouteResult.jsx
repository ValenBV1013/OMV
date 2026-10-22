import { useEffect, useMemo, useRef } from 'react';
import { MapContainer, TileLayer, Polyline, Marker, Popup, useMap } from 'react-leaflet';
import { Shield, ShieldAlert, Route, Clock, AlertTriangle, MapPin, CloudRain } from 'lucide-react';
import 'leaflet/dist/leaflet.css';

import L from 'leaflet';
delete L.Icon.Default.prototype._getIconUrl;

// Icono verde para ORIGEN (actualizado a estilo neón)
const iconOrigen = L.divIcon({
  html: `<svg xmlns="http://www.w3.org/2000/svg" width="28" height="44" viewBox="0 0 28 44">
    <path d="M14 0C6.27 0 0 6.27 0 14c0 10.5 14 30 14 30s14-19.5 14-30C28 6.27 21.73 0 14 0z" fill="#22d3ee" stroke="white" stroke-width="1.5"/>
    <circle cx="14" cy="14" r="6" fill="white"/>
    <text x="14" y="17" text-anchor="middle" font-size="9" font-weight="bold" fill="#0891b2">S</text>
  </svg>`,
  className: '',
  iconSize: [28, 44],
  iconAnchor: [14, 44],
  popupAnchor: [0, -44],
});

// Icono rojo para DESTINO (actualizado a estilo neón)
const iconDestino = L.divIcon({
  html: `<svg xmlns="http://www.w3.org/2000/svg" width="28" height="44" viewBox="0 0 28 44">
    <path d="M14 0C6.27 0 0 6.27 0 14c0 10.5 14 30 14 30s14-19.5 14-30C28 6.27 21.73 0 14 0z" fill="#e879f9" stroke="white" stroke-width="1.5"/>
    <circle cx="14" cy="14" r="6" fill="white"/>
    <text x="14" y="17" text-anchor="middle" font-size="9" font-weight="bold" fill="#c026d3">D</text>
  </svg>`,
  className: '',
  iconSize: [28, 44],
  iconAnchor: [14, 44],
  popupAnchor: [0, -44],
});

/** Colores según nivel de alerta general - estilo púrpura */
const ALERTA_COLORS = {
  SEGURO: { 
    border: 'border-cyan-500/50', 
    bg: 'bg-cyan-950/40', 
    text: 'text-cyan-400',
    glow: 'shadow-cyan-500/20'
  },
  ADVERTENCIA: { 
    border: 'border-fuchsia-500/50', 
    bg: 'bg-fuchsia-950/40', 
    text: 'text-fuchsia-400',
    glow: 'shadow-fuchsia-500/20'
  },
  CRITICO: { 
    border: 'border-rose-500/50', 
    bg: 'bg-rose-950/40', 
    text: 'text-rose-400',
    glow: 'shadow-rose-500/20'
  },
};

/** Color de segmento según score de riesgo - paleta neón */
function colorPorScore(score) {
  if (score >= 0.75) return '#f43f5e'; // rojo neón
  if (score >= 0.50) return '#f97316'; // naranja neón
  if (score >= 0.25) return '#fbbf24'; // ámbar brillante
  return '#22d3ee'; // cyan neón
}

function labelPorScore(score) {
  if (score >= 0.75) return 'Crítico';
  if (score >= 0.50) return 'Alto';
  if (score >= 0.25) return 'Moderado';
  return 'Bajo';
}

/** Centra el mapa en la ruta solo UNA vez al montar */
function FitBounds({ bounds }) {
  const map = useMap();
  const fitted = useRef(false);

  useEffect(() => {
    if (bounds && !fitted.current) {
      map.fitBounds(bounds, { padding: [40, 40] });
      fitted.current = true;
    }
  }, [bounds, map]);

  return null;
}

/** Tooltip flotante al pasar el mouse sobre un segmento de riesgo */
function RiskSegment({ positions, score, index }) {
  const midIdx = Math.floor(positions.length / 2);
  const midPos = positions[midIdx] || positions[0];
  const color = colorPorScore(score);
  const label = labelPorScore(score);

  return (
    <Polyline
      positions={positions}
      pathOptions={{
        color,
        weight: score >= 0.5 ? 7 : 5,
        opacity: score >= 0.5 ? 1 : 0.8,
      }}
    >
      <Popup>
        <div className="text-xs space-y-1" style={{ fontFamily: 'system-ui' }}>
          <p className="font-bold" style={{ color: '#a78bfa' }}>Segmento {index + 1}</p>
          <p>Riesgo: <span style={{ color, fontWeight: 'bold' }}>{(score * 100).toFixed(0)}%</span></p>
          <p>Nivel: <span style={{ color }}>{label}</span></p>
        </div>
      </Popup>
    </Polyline>
  );
}

/**
 * Muestra el resultado de la ruta segura con segmentos coloreados
 * por nivel de riesgo punto a punto.
 */
export default function SafeRouteResult({ result, onNewSearch }) {
  const {
    ruta, riesgo_promedio, max_riesgo, nivel_alerta,
    distancia_km, tiempo_estimado_segundos,
    restricciones_evitadas, detalle_riesgos,
    factor_lluvia, puntos_riesgo,
    origen_coords, destino_coords,
    direccion_origen, direccion_destino,
    direccion_normalizada_origen, direccion_normalizada_destino,
    precision_origen, precision_destino,
  } = result;

  const colors = ALERTA_COLORS[nivel_alerta] || ALERTA_COLORS.SEGURO;

  // Coordenadas completas de la ruta [lat, lng]
  const positions = useMemo(
    () => ruta?.coordinates?.map(([lng, lat]) => [lat, lng]) ?? [],
    [ruta]
  );

  const origenPos = useMemo(
    () => origen_coords ? [origen_coords.lat, origen_coords.lng] : null,
    [origen_coords]
  );
  const destinoPos = useMemo(
    () => destino_coords ? [destino_coords.lat, destino_coords.lng] : null,
    [destino_coords]
  );

  const bounds = useMemo(() => {
    const allPoints = [...positions];
    if (origenPos) allPoints.push(origenPos);
    if (destinoPos) allPoints.push(destinoPos);
    return allPoints.length > 0 ? L.latLngBounds(allPoints) : null;
  }, [positions, origenPos, destinoPos]);

  const segmentos = useMemo(() => {
    if (!puntos_riesgo || puntos_riesgo.length < 2) return [];

    const pts = puntos_riesgo.map(p => [p.lat, p.lng]);
    const scores = puntos_riesgo.map(p => p.score);

    const grupos = [];
    let current = { positions: [pts[0]], scores: [scores[0]] };

    for (let i = 1; i < pts.length; i++) {
      const prevColorGroup = Math.floor(scores[i - 1] / 0.25);
      const currColorGroup = Math.floor(scores[i] / 0.25);

      if (currColorGroup === prevColorGroup) {
        current.positions.push(pts[i]);
        current.scores.push(scores[i]);
      } else {
        grupos.push({
          positions: [...current.positions],
          score: Math.max(...current.scores),
        });
        current = { positions: [current.positions[current.positions.length - 1], pts[i]], scores: [scores[i]] };
      }
    }
    if (current.positions.length > 1) {
      grupos.push({
        positions: current.positions,
        score: Math.max(...current.scores),
      });
    }

    return grupos;
  }, [puntos_riesgo]);

  const minutos = Math.round((tiempo_estimado_segundos ?? 0) / 60);
  const restricciones = Array.isArray(restricciones_evitadas) ? restricciones_evitadas : [];

  return (
    <div className="h-screen w-screen flex flex-col overflow-hidden bg-[#0a0a1a] fixed inset-0">
      {/* Efectos de glow decorativos tipo imagen */}
      <div className="absolute -top-40 -right-40 w-96 h-96 bg-fuchsia-600/10 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute -bottom-40 -left-40 w-96 h-96 bg-violet-600/10 rounded-full blur-3xl pointer-events-none" />

      {/* Header */}
      <div className="flex items-center justify-between relative z-10 px-4 py-3 shrink-0 border-b border-violet-900/30">
        <h2 className="text-lg font-bold text-white flex items-center gap-2">
          <div className="p-1.5 rounded-lg bg-gradient-to-br from-fuchsia-500 to-violet-600">
            <Route className="text-white w-4 h-4" />
          </div>
          Resultado de ruta segura
        </h2>
        <button
          onClick={onNewSearch}
          className="text-sm text-violet-300/70 hover:text-white transition font-medium px-3 py-1.5 rounded-lg hover:bg-white/5"
        >
          Nueva búsqueda
        </button>
      </div>

      {/* Layout de 2 columnas: Mapa a la izquierda, datos a la derecha - PANTALLA COMPLETA */}
      <div className="grid grid-cols-1 lg:grid-cols-2 flex-1 min-h-0">
        
        {/* COLUMNA IZQUIERDA: Mapa - OCUPA TODA LA ALTURA */}
        <div className="flex flex-col h-full min-h-0 relative">
          {/* Mapa Leaflet - SIN BORDES REDONDEADOS, PEGADO A LOS BORDES */}
          <div className="flex-1 min-h-0 relative">
            <MapContainer bounds={bounds} className="h-full w-full" zoom={13} scrollWheelZoom={true}>
              <TileLayer
                attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
                url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
              />
              <FitBounds bounds={bounds} />

              {/* Marcador de ORIGEN — cyan neón */}
              {origenPos && (
                <Marker position={origenPos} icon={iconOrigen}>
                  <Popup>
                    <div className="text-xs space-y-1 max-w-[280px]" style={{ fontFamily: 'system-ui' }}>
                      <p className="font-bold text-cyan-400">🟢 Punto de partida</p>
                      <p className="text-slate-300 font-medium truncate" title={direccion_origen}>
                        {direccion_origen || 'Sin dirección'}
                      </p>
                      {direccion_normalizada_origen && direccion_normalizada_origen !== direccion_origen && (
                        <p className="text-slate-500 text-[10px] leading-tight border-t border-slate-700 pt-1 mt-1">
                          <span className="text-fuchsia-400">↙</span> Ubicación encontrada: {direccion_normalizada_origen}
                        </p>
                      )}
                      {precision_origen && precision_origen !== 'house' && (
                        <span className="inline-block text-[10px] bg-fuchsia-900/40 text-fuchsia-400 px-1.5 py-0.5 rounded font-medium">
                          ⚠ Precisión: {precision_origen === 'street' ? 'calle (aprox.)' : 'zona (aprox.)'}
                        </span>
                      )}
                      <p className="text-slate-500 text-[10px]">
                        {origen_coords.lat.toFixed(4)}, {origen_coords.lng.toFixed(4)}
                      </p>
                    </div>
                  </Popup>
                </Marker>
              )}

              {/* Marcador de DESTINO — fuchsia neón */}
              {destinoPos && (
                <Marker position={destinoPos} icon={iconDestino}>
                  <Popup>
                    <div className="text-xs space-y-1 max-w-[280px]" style={{ fontFamily: 'system-ui' }}>
                      <p className="font-bold text-fuchsia-400">🔴 Punto de destino</p>
                      <p className="text-slate-300 font-medium truncate" title={direccion_destino}>
                        {direccion_destino || 'Sin dirección'}
                      </p>
                      {direccion_normalizada_destino && direccion_normalizada_destino !== direccion_destino && (
                        <p className="text-slate-500 text-[10px] leading-tight border-t border-slate-700 pt-1 mt-1">
                          <span className="text-fuchsia-400">↙</span> Ubicación encontrada: {direccion_normalizada_destino}
                        </p>
                      )}
                      {precision_destino && precision_destino !== 'house' && (
                        <span className="inline-block text-[10px] bg-fuchsia-900/40 text-fuchsia-400 px-1.5 py-0.5 rounded font-medium">
                          ⚠ Precisión: {precision_destino === 'street' ? 'calle (aprox.)' : 'zona (aprox.)'}
                        </span>
                      )}
                      <p className="text-slate-500 text-[10px]">
                        {destino_coords.lat.toFixed(4)}, {destino_coords.lng.toFixed(4)}
                      </p>
                    </div>
                  </Popup>
                </Marker>
              )}

              {/* Leyenda de marcadores - estilo imagen */}
              <div className="absolute bottom-4 left-4 z-[1000] bg-black/80 backdrop-blur-md rounded-xl border border-violet-800/50 shadow-xl p-3 text-xs space-y-2">
                <p className="font-semibold text-white border-b border-violet-800/50 pb-1.5 mb-1">Leyenda de ruta</p>
                <div className="flex items-center gap-2">
                  <svg xmlns="http://www.w3.org/2000/svg" width="16" height="24" viewBox="0 0 28 44" className="shrink-0">
                    <path d="M14 0C6.27 0 0 6.27 0 14c0 10.5 14 30 14 30s14-19.5 14-30C28 6.27 21.73 0 14 0z" fill="#22d3ee" stroke="white" stroke-width="2"/>
                    <circle cx="14" cy="14" r="6" fill="white"/>
                  </svg>
                  <span className="text-violet-200">Punto de partida</span>
                </div>
                <div className="flex items-center gap-2">
                  <svg xmlns="http://www.w3.org/2000/svg" width="16" height="24" viewBox="0 0 28 44" className="shrink-0">
                    <path d="M14 0C6.27 0 0 6.27 0 14c0 10.5 14 30 14 30s14-19.5 14-30C28 6.27 21.73 0 14 0z" fill="#e879f9" stroke="white" stroke-width="2"/>
                    <circle cx="14" cy="14" r="6" fill="white"/>
                  </svg>
                  <span className="text-violet-200">Punto de destino</span>
                </div>
              </div>

              {/* Segmentos coloreados por riesgo */}
              {segmentos.map((seg, i) => (
                <RiskSegment
                  key={i}
                  positions={seg.positions}
                  score={seg.score}
                  index={i}
                />
              ))}
            </MapContainer>
          </div>

          {/* Leyenda de colores del mapa - estilo neón - PEGADA ABAJO */}
          <div className="flex items-center justify-center gap-4 text-xs text-violet-300/70 py-2 bg-black/40 backdrop-blur-sm border-t border-violet-900/30 shrink-0">
            <span className="flex items-center gap-1.5">
              <span className="w-3 h-3 rounded-full bg-cyan-400 inline-block shadow-lg shadow-cyan-400/50" /> Bajo
            </span>
            <span className="flex items-center gap-1.5">
              <span className="w-3 h-3 rounded-full bg-amber-400 inline-block shadow-lg shadow-amber-400/50" /> Moderado
            </span>
            <span className="flex items-center gap-1.5">
              <span className="w-3 h-3 rounded-full bg-orange-500 inline-block shadow-lg shadow-orange-500/50" /> Alto
            </span>
            <span className="flex items-center gap-1.5">
              <span className="w-3 h-3 rounded-full bg-rose-500 inline-block shadow-lg shadow-rose-500/50" /> Crítico
            </span>
          </div>
        </div>

        {/* COLUMNA DERECHA: Datos - SCROLLABLE, FONDO OSCURO, PADDING REDUCIDO */}
        <div className="space-y-4 overflow-y-auto p-4 bg-[#0f0f2a]/80 border-l border-violet-900/30">
          {/* Tarjetas de métricas - estilo glassmorphism púrpura - HORIZONTALES */}
          <div className="grid grid-cols-3 gap-3 relative z-10">
            {/* Riesgo */}
            <div className={`bg-black/60 backdrop-blur-sm rounded-xl p-4 border ${colors.border} ${colors.glow} shadow-lg text-center`}>
              <div className="flex items-center justify-center gap-2 mb-2">
                {nivel_alerta === 'SEGURO' ? (
                  <Shield className={`w-5 h-5 ${colors.text}`} />
                ) : (
                  <ShieldAlert className={`w-5 h-5 ${colors.text}`} />
                )}
                <span className="text-xs font-semibold uppercase text-violet-400/70">Riesgo</span>
              </div>
              <p className={`text-3xl font-extrabold ${colors.text}`}>
                {(riesgo_promedio * 100).toFixed(0)}%
              </p>
              <div className="mt-2 h-1.5 bg-violet-900/50 rounded-full overflow-hidden">
                <div
                  className="h-full rounded-full transition-all duration-500 shadow-lg"
                  style={{
                    width: `${Math.min(riesgo_promedio * 100, 100)}%`,
                    backgroundColor: colorPorScore(riesgo_promedio),
                    boxShadow: `0 0 10px ${colorPorScore(riesgo_promedio)}`,
                  }}
                />
              </div>
              <span className={`inline-block mt-2 text-xs font-bold px-2 py-0.5 rounded ${colors.bg} ${colors.text} border ${colors.border}`}>
                {nivel_alerta}
              </span>
            </div>

            {/* Distancia */}
            <div className="bg-black/60 backdrop-blur-sm rounded-xl p-4 border border-violet-800/50 shadow-lg text-center">
              <div className="flex items-center justify-center gap-2 mb-2">
                <MapPin className="w-5 h-5 text-fuchsia-400" />
                <span className="text-xs font-semibold uppercase text-violet-400/70">Distancia</span>
              </div>
              <p className="text-3xl font-extrabold text-white">
                {distancia_km}
              </p>
              <p className="text-sm text-violet-400/60">km</p>
              <p className="text-xs text-violet-400/40 mt-1">Distancia total del recorrido</p>
            </div>

            {/* Tiempo */}
            <div className="bg-black/60 backdrop-blur-sm rounded-xl p-4 border border-violet-800/50 shadow-lg text-center">
              <div className="flex items-center justify-center gap-2 mb-2">
                <Clock className="w-5 h-5 text-cyan-400" />
                <span className="text-xs font-semibold uppercase text-violet-400/70">Duración</span>
              </div>
              <p className="text-3xl font-extrabold text-white">
                {minutos}
              </p>
              <p className="text-sm text-violet-400/60">min</p>
              <p className="text-xs text-violet-400/40 mt-1">Tiempo estimado de viaje</p>
            </div>
          </div>

          {/* Restricciones evitadas */}
          {restricciones.length > 0 && (
            <div className="bg-black/60 backdrop-blur-sm rounded-xl p-4 border border-violet-800/50 shadow-lg relative z-10">
              <h3 className="text-sm font-semibold text-violet-200 mb-3 flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 text-amber-400" />
                Restricciones evitadas
              </h3>
              <div className="flex flex-wrap gap-2">
                {restricciones.map((r, i) => {
                  const tipo = r.trim().toLowerCase();
                  const badgeColor = tipo.includes('inund')
                    ? 'bg-cyan-950/60 text-cyan-300 border-cyan-700/50'
                    : tipo.includes('arroyo') || tipo.includes('sensor')
                      ? 'bg-fuchsia-950/60 text-fuchsia-300 border-fuchsia-700/50'
                      : tipo.includes('accid')
                        ? 'bg-rose-950/60 text-rose-300 border-rose-700/50'
                        : 'bg-violet-950/60 text-violet-300 border-violet-700/50';
                  return (
                    <span
                      key={i}
                      className={`text-xs px-3 py-1 rounded-full border font-medium ${badgeColor}`}
                    >
                      {r.trim()}
                    </span>
                  );
                })}
              </div>
            </div>
          )}

          {/* Desglose de riesgo por tipo */}
          {detalle_riesgos && Object.keys(detalle_riesgos).length > 0 && (
            <div className="bg-black/60 backdrop-blur-sm rounded-xl p-4 border border-violet-800/50 shadow-lg relative z-10">
              <h3 className="text-sm font-semibold text-violet-200 mb-3">Desglose de riesgo por tipo</h3>
              <div className="space-y-2">
                {Object.entries(detalle_riesgos).map(([tipo, score]) => (
                  <div key={tipo} className="flex items-center justify-between text-sm">
                    <span className="text-violet-300/70 capitalize">{tipo.replace(/_/g, ' ')}</span>
                    <div className="flex items-center gap-2">
                      <div className="w-24 h-1.5 bg-violet-900/50 rounded-full overflow-hidden">
                        <div
                          className="h-full rounded-full transition-all duration-500"
                          style={{
                            width: `${Math.min(score * 100, 100)}%`,
                            backgroundColor: score > 0.5 ? '#f43f5e' : score > 0.25 ? '#fbbf24' : '#22d3ee',
                            boxShadow: `0 0 8px ${score > 0.5 ? '#f43f5e' : score > 0.25 ? '#fbbf24' : '#22d3ee'}`,
                          }}
                        />
                      </div>
                      <span className="text-xs font-mono text-violet-400/70 w-8 text-right">
                        {(score * 100).toFixed(0)}%
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Factor lluvia */}
          {factor_lluvia != null && (
            <div className="bg-black/60 backdrop-blur-sm rounded-xl p-4 border border-violet-800/50 shadow-lg relative z-10">
              <div className="flex items-center justify-between text-sm">
                <span className="text-violet-300/70 flex items-center gap-2">
                  <CloudRain className="w-4 h-4 text-cyan-400" />
                  Factor lluvia aplicado
                </span>
                <span className="text-white font-bold font-mono">{factor_lluvia.toFixed(2)}x</span>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}