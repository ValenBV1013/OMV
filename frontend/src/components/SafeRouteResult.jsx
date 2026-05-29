import { useEffect, useMemo, useRef } from 'react';
import { MapContainer, TileLayer, Polyline, Marker, Popup, useMap } from 'react-leaflet';
import { Shield, ShieldAlert, Route, Clock, AlertTriangle, MapPin, CloudRain } from 'lucide-react';
import 'leaflet/dist/leaflet.css';

import L from 'leaflet';
delete L.Icon.Default.prototype._getIconUrl;

// Icono verde para ORIGEN
const iconOrigen = L.divIcon({
  html: `<svg xmlns="http://www.w3.org/2000/svg" width="28" height="44" viewBox="0 0 28 44">
    <path d="M14 0C6.27 0 0 6.27 0 14c0 10.5 14 30 14 30s14-19.5 14-30C28 6.27 21.73 0 14 0z" fill="#22c55e" stroke="white" stroke-width="1.5"/>
    <circle cx="14" cy="14" r="6" fill="white"/>
    <text x="14" y="17" text-anchor="middle" font-size="9" font-weight="bold" fill="#22c55e">S</text>
  </svg>`,
  className: '',
  iconSize: [28, 44],
  iconAnchor: [14, 44],
  popupAnchor: [0, -44],
});

// Icono rojo para DESTINO
const iconDestino = L.divIcon({
  html: `<svg xmlns="http://www.w3.org/2000/svg" width="28" height="44" viewBox="0 0 28 44">
    <path d="M14 0C6.27 0 0 6.27 0 14c0 10.5 14 30 14 30s14-19.5 14-30C28 6.27 21.73 0 14 0z" fill="#ef4444" stroke="white" stroke-width="1.5"/>
    <circle cx="14" cy="14" r="6" fill="white"/>
    <text x="14" y="17" text-anchor="middle" font-size="9" font-weight="bold" fill="#ef4444">D</text>
  </svg>`,
  className: '',
  iconSize: [28, 44],
  iconAnchor: [14, 44],
  popupAnchor: [0, -44],
});

/** Colores según nivel de alerta general */
const ALERTA_COLORS = {
  SEGURO: { border: 'border-emerald-500', bg: 'bg-emerald-900/40', text: 'text-emerald-400' },
  ADVERTENCIA: { border: 'border-amber-500', bg: 'bg-amber-900/40', text: 'text-amber-400' },
  CRITICO: { border: 'border-rose-500', bg: 'bg-rose-900/40', text: 'text-rose-400' },
};

/** Color de segmento según score de riesgo */
function colorPorScore(score) {
  if (score >= 0.75) return '#f43f5e'; // rojo
  if (score >= 0.50) return '#f97316'; // naranja
  if (score >= 0.25) return '#f59e0b'; // ámbar
  return '#22c55e'; // verde
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
        <div className="text-xs space-y-1">
          <p className="font-bold">Segmento {index + 1}</p>
          <p>Riesgo: <span style={{ color }}>{(score * 100).toFixed(0)}%</span></p>
          <p>Nivel: {label}</p>
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

  // Coordenadas GEOCODIFICADAS del origen/destino (las reales, no el snap de OSRM)
  // Memoizadas para evitar que FitBounds se re-dispare en cada re-render
  const origenPos = useMemo(
    () => origen_coords ? [origen_coords.lat, origen_coords.lng] : null,
    [origen_coords]
  );
  const destinoPos = useMemo(
    () => destino_coords ? [destino_coords.lat, destino_coords.lng] : null,
    [destino_coords]
  );

  // Bounds para auto-zoom (abarca toda la ruta + los puntos geocodificados)
  const bounds = useMemo(() => {
    const allPoints = [...positions];
    if (origenPos) allPoints.push(origenPos);
    if (destinoPos) allPoints.push(destinoPos);
    return allPoints.length > 0 ? L.latLngBounds(allPoints) : null;
  }, [positions, origenPos, destinoPos]);

  // Segmentos coloreados desde puntos_riesgo del backend
  const segmentos = useMemo(() => {
    if (!puntos_riesgo || puntos_riesgo.length < 2) return [];

    const pts = puntos_riesgo.map(p => [p.lat, p.lng]);
    const scores = puntos_riesgo.map(p => p.score);

    // Agrupar segmentos consecutivos del MISMO color
    const grupos = [];
    let current = { positions: [pts[0]], scores: [scores[0]] };

    for (let i = 1; i < pts.length; i++) {
      const prevColorGroup = Math.floor(scores[i - 1] / 0.25);
      const currColorGroup = Math.floor(scores[i] / 0.25);

      if (currColorGroup === prevColorGroup) {
        current.positions.push(pts[i]);
        current.scores.push(scores[i]);
      } else {
        // Cerrar grupo anterior
        grupos.push({
          positions: [...current.positions],
          score: Math.max(...current.scores),
        });
        current = { positions: [current.positions[current.positions.length - 1], pts[i]], scores: [scores[i]] };
      }
    }
    // Último grupo
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
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-bold text-white flex items-center gap-2">
          <Route className="text-amber-400 w-5 h-5" />
          Resultado de ruta segura
        </h2>
        <button
          onClick={onNewSearch}
          className="text-sm text-slate-400 hover:text-white transition font-medium"
        >
          Nueva búsqueda
        </button>
      </div>

      {/* Mapa Leaflet con segmentos de riesgo */}
      <div className="rounded-xl overflow-hidden border border-slate-700 h-[400px]">
        <MapContainer bounds={bounds} className="h-full w-full" zoom={13} scrollWheelZoom={true}>
          <TileLayer
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          />
          <FitBounds bounds={bounds} />

          {/* Marcador de ORIGEN — verde */}
          {origenPos && (
            <Marker position={origenPos} icon={iconOrigen}>
              <Popup>
                <div className="text-xs space-y-1 max-w-[280px]">
                  <p className="font-bold text-emerald-400">🟢 Punto de partida</p>
                  <p className="text-slate-300 font-medium truncate" title={direccion_origen}>
                    {direccion_origen || 'Sin dirección'}
                  </p>
                  {direccion_normalizada_origen && direccion_normalizada_origen !== direccion_origen && (
                    <p className="text-slate-500 text-[10px] leading-tight border-t border-slate-700 pt-1 mt-1">
                      <span className="text-amber-400">↙</span> Ubicación encontrada: {direccion_normalizada_origen}
                    </p>
                  )}
                  {precision_origen && precision_origen !== 'house' && (
                    <span className="inline-block text-[10px] bg-amber-900/40 text-amber-400 px-1.5 py-0.5 rounded font-medium">
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

          {/* Marcador de DESTINO — rojo */}
          {destinoPos && (
            <Marker position={destinoPos} icon={iconDestino}>
              <Popup>
                <div className="text-xs space-y-1 max-w-[280px]">
                  <p className="font-bold text-rose-400">🔴 Punto de destino</p>
                  <p className="text-slate-300 font-medium truncate" title={direccion_destino}>
                    {direccion_destino || 'Sin dirección'}
                  </p>
                  {direccion_normalizada_destino && direccion_normalizada_destino !== direccion_destino && (
                    <p className="text-slate-500 text-[10px] leading-tight border-t border-slate-700 pt-1 mt-1">
                      <span className="text-amber-400">↙</span> Ubicación encontrada: {direccion_normalizada_destino}
                    </p>
                  )}
                  {precision_destino && precision_destino !== 'house' && (
                    <span className="inline-block text-[10px] bg-amber-900/40 text-amber-400 px-1.5 py-0.5 rounded font-medium">
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

          {/* Leyenda de marcadores */}
          <div className="absolute bottom-4 left-4 z-[1000] bg-slate-900/90 backdrop-blur-sm rounded-lg border border-slate-700 shadow-lg p-3 text-xs space-y-2">
            <p className="font-semibold text-white border-b border-slate-700 pb-1.5 mb-1">Leyenda de ruta</p>
            <div className="flex items-center gap-2">
              <svg xmlns="http://www.w3.org/2000/svg" width="16" height="24" viewBox="0 0 28 44" className="shrink-0">
                <path d="M14 0C6.27 0 0 6.27 0 14c0 10.5 14 30 14 30s14-19.5 14-30C28 6.27 21.73 0 14 0z" fill="#22c55e" stroke="white" stroke-width="2"/>
                <circle cx="14" cy="14" r="6" fill="white"/>
              </svg>
              <span className="text-slate-300">Punto de partida</span>
            </div>
            <div className="flex items-center gap-2">
              <svg xmlns="http://www.w3.org/2000/svg" width="16" height="24" viewBox="0 0 28 44" className="shrink-0">
                <path d="M14 0C6.27 0 0 6.27 0 14c0 10.5 14 30 14 30s14-19.5 14-30C28 6.27 21.73 0 14 0z" fill="#ef4444" stroke="white" stroke-width="2"/>
                <circle cx="14" cy="14" r="6" fill="white"/>
              </svg>
              <span className="text-slate-300">Punto de destino</span>
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

      {/* Leyenda de colores del mapa */}
      <div className="flex items-center justify-center gap-4 text-xs text-slate-400">
        <span className="flex items-center gap-1.5">
          <span className="w-3 h-3 rounded-full bg-emerald-500 inline-block" /> Bajo
        </span>
        <span className="flex items-center gap-1.5">
          <span className="w-3 h-3 rounded-full bg-amber-500 inline-block" /> Moderado
        </span>
        <span className="flex items-center gap-1.5">
          <span className="w-3 h-3 rounded-full bg-orange-500 inline-block" /> Alto
        </span>
        <span className="flex items-center gap-1.5">
          <span className="w-3 h-3 rounded-full bg-rose-500 inline-block" /> Crítico
        </span>
      </div>

      {/* Tarjetas de métricas */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {/* Riesgo */}
        <div className={`bg-slate-800 rounded-xl p-4 border border-slate-700 ${colors.border}`}>
          <div className="flex items-center gap-2 mb-2">
            {nivel_alerta === 'SEGURO' ? (
              <Shield className={`w-5 h-5 ${colors.text}`} />
            ) : (
              <ShieldAlert className={`w-5 h-5 ${colors.text}`} />
            )}
            <span className="text-xs font-semibold uppercase text-slate-400">Riesgo</span>
          </div>
          <p className={`text-2xl font-extrabold ${colors.text}`}>
            {(riesgo_promedio * 100).toFixed(0)}%
          </p>
          <div className="mt-2 h-1.5 bg-slate-700 rounded-full overflow-hidden">
          <div
            className="h-full rounded-full transition-all"
            style={{
              width: `${Math.min(riesgo_promedio * 100, 100)}%`,
              backgroundColor: colorPorScore(riesgo_promedio),
            }}
          />
          </div>
          <span className={`inline-block mt-1.5 text-xs font-bold px-2 py-0.5 rounded ${colors.bg} ${colors.text}`}>
            {nivel_alerta}
          </span>
        </div>

        {/* Distancia */}
        <div className="bg-slate-800 rounded-xl p-4 border border-slate-700">
          <div className="flex items-center gap-2 mb-2">
            <MapPin className="w-5 h-5 text-indigo-400" />
            <span className="text-xs font-semibold uppercase text-slate-400">Distancia</span>
          </div>
          <p className="text-2xl font-extrabold text-white">
            {distancia_km} <span className="text-sm font-normal text-slate-400">km</span>
          </p>
          <p className="text-xs text-slate-500 mt-1">Distancia total del recorrido</p>
        </div>

        {/* Tiempo */}
        <div className="bg-slate-800 rounded-xl p-4 border border-slate-700">
          <div className="flex items-center gap-2 mb-2">
            <Clock className="w-5 h-5 text-cyan-400" />
            <span className="text-xs font-semibold uppercase text-slate-400">Duración</span>
          </div>
          <p className="text-2xl font-extrabold text-white">
            {minutos} <span className="text-sm font-normal text-slate-400">min</span>
          </p>
          <p className="text-xs text-slate-500 mt-1">Tiempo estimado de viaje</p>
        </div>
      </div>

      {/* Restricciones evitadas */}
      {restricciones.length > 0 && (
        <div className="bg-slate-800 rounded-xl p-4 border border-slate-700">
          <h3 className="text-sm font-semibold text-slate-300 mb-3 flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 text-amber-400" />
            Restricciones evitadas
          </h3>
          <div className="flex flex-wrap gap-2">
            {restricciones.map((r, i) => {
              const tipo = r.trim().toLowerCase();
              const badgeColor = tipo.includes('inund')
                ? 'bg-cyan-900/40 text-cyan-300 border-cyan-700'
                : tipo.includes('arroyo') || tipo.includes('sensor')
                  ? 'bg-purple-900/40 text-purple-300 border-purple-700'
                  : tipo.includes('accid')
                    ? 'bg-rose-900/40 text-rose-300 border-rose-700'
                    : 'bg-slate-700 text-slate-300 border-slate-600';
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
        <div className="bg-slate-800 rounded-xl p-4 border border-slate-700">
          <h3 className="text-sm font-semibold text-slate-300 mb-3">Desglose de riesgo por tipo</h3>
          <div className="space-y-2">
            {Object.entries(detalle_riesgos).map(([tipo, score]) => (
              <div key={tipo} className="flex items-center justify-between text-sm">
                <span className="text-slate-400 capitalize">{tipo.replace(/_/g, ' ')}</span>
                <div className="flex items-center gap-2">
                  <div className="w-24 h-1.5 bg-slate-700 rounded-full overflow-hidden">
                    <div
                      className="h-full rounded-full"
                      style={{
                        width: `${Math.min(score * 100, 100)}%`,
                        backgroundColor: score > 0.5 ? '#f43f5e' : score > 0.25 ? '#f59e0b' : '#22c55e',
                      }}
                    />
                  </div>
                  <span className="text-xs font-mono text-slate-400 w-8 text-right">
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
        <div className="bg-slate-800 rounded-xl p-4 border border-slate-700">
          <div className="flex items-center justify-between text-sm">
            <span className="text-slate-400 flex items-center gap-2">
              <CloudRain className="w-4 h-4 text-cyan-400" />
              Factor lluvia aplicado
            </span>
            <span className="text-white font-bold">{factor_lluvia.toFixed(2)}x</span>
          </div>
        </div>
      )}
    </div>
  );
}
