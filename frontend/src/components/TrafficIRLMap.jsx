import { useMemo, useEffect, useRef } from 'react';
import { MapContainer, TileLayer, Polyline, Marker, Popup, Circle, useMap } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';

// Fix Leaflet icons
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon-2x.png',
  iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png',
});

// SVG icon for ORIGIN (cyan neón)
const iconOrigen = L.divIcon({
  html: `<svg xmlns="http://www.w3.org/2000/svg" width="28" height="44" viewBox="0 0 28 44">
    <path d="M14 0C6.27 0 0 6.27 0 14c0 10.5 14 30 14 30s14-19.5 14-30C28 6.27 21.73 0 14 0z" fill="#22d3ee" stroke="white" stroke-width="1.5"/>
    <circle cx="14" cy="14" r="6" fill="white"/>
    <text x="14" y="17" text-anchor="middle" font-size="9" font-weight="bold" fill="#0891b2">S</text>
  </svg>`,
  className: '',
  iconSize: [28, 44],
  iconAnchor: [14, 44],
});

// SVG icon for DESTINATION (fuchsia neón)
const iconDestino = L.divIcon({
  html: `<svg xmlns="http://www.w3.org/2000/svg" width="28" height="44" viewBox="0 0 28 44">
    <path d="M14 0C6.27 0 0 6.27 0 14c0 10.5 14 30 14 30s14-19.5 14-30C28 6.27 21.73 0 14 0z" fill="#e879f9" stroke="white" stroke-width="1.5"/>
    <circle cx="14" cy="14" r="6" fill="white"/>
    <text x="14" y="17" text-anchor="middle" font-size="9" font-weight="bold" fill="#c026d3">D</text>
  </svg>`,
  className: '',
  iconSize: [28, 44],
  iconAnchor: [14, 44],
});

// FitBounds component
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

// Congestion color helper — estilo neón
function congestionColor(level) {
  switch (level) {
    case 'severo': return '#f43f5e';
    case 'alto': return '#f97316';
    case 'moderado': return '#fbbf24';
    default: return '#6b7280';
  }
}

function congestionRadius(level) {
  switch (level) {
    case 'severo': return 400;
    case 'alto': return 350;
    case 'moderado': return 250;
    default: return 150;
  }
}

export default function TrafficIRLMap({
  routeData,
  selectedAlternative,
  origenCoords,
  destinoCoords
}) {
  // Main route coordinates [lat, lng]
  const mainPositions = useMemo(() => {
    if (!routeData?.main_route?.coordinates) return [];
    return routeData.main_route.coordinates.map(([lng, lat]) => [lat, lng]);
  }, [routeData]);

  // Alternative routes coordinates
  const alternatives = useMemo(() => {
    if (!routeData?.alternatives) return [];
    return routeData.alternatives.map((alt, idx) => ({
      index: idx,
      positions: (alt.coordinates || []).map(([lng, lat]) => [lat, lng]),
      speed: alt.average_speed_kmh,
      summary: alt.summary,
    }));
  }, [routeData]);

  const origenPos = origenCoords ? [origenCoords.lat, origenCoords.lng] : null;
  const destinoPos = destinoCoords ? [destinoCoords.lat, destinoCoords.lng] : null;

  // Congestion zones from route data
  const congestionZones = useMemo(() => {
    return routeData?.all_congestion_zones || [];
  }, [routeData]);

  // If main route has coordinates, extract start/end
  const startPos = origenPos || (mainPositions.length > 0 ? mainPositions[0] : null);
  const endPos = destinoPos || (mainPositions.length > 0 ? mainPositions[mainPositions.length - 1] : null);

  const bounds = useMemo(() => {
    const allPoints = [...mainPositions];
    alternatives.forEach(alt => allPoints.push(...alt.positions));
    if (startPos) allPoints.push(startPos);
    if (endPos) allPoints.push(endPos);
    return allPoints.length > 0 ? L.latLngBounds(allPoints) : null;
  }, [mainPositions, alternatives, startPos, endPos, congestionZones]);

  const mainSpeed = routeData?.main_route?.average_speed_kmh;
  const mainSummary = routeData?.main_route?.summary;

  return (
    <MapContainer
      center={[6.2476, -75.5658]}
      zoom={13}
      className="h-full w-full"
      scrollWheelZoom={true}
    >
      <TileLayer
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
      />
      {bounds && <FitBounds bounds={bounds} />}

      {/* Start marker */}
      {startPos && (
        <Marker position={startPos} icon={iconOrigen}>
          <Popup><div className="text-xs"><strong>Punto de partida</strong></div></Popup>
        </Marker>
      )}

      {/* End marker */}
      {endPos && (
        <Marker position={endPos} icon={iconDestino}>
          <Popup><div className="text-xs"><strong>Punto de destino</strong></div></Popup>
        </Marker>
      )}

      {/* Main route */}
      {mainPositions.length > 0 && (
        <Polyline
          positions={mainPositions}
          pathOptions={{ color: '#22d3ee', weight: 6, opacity: 0.9 }}
        >
          <Popup>
            <div className="text-xs space-y-1">
              <p className="font-bold">Ruta principal</p>
              {mainSpeed && <p>Velocidad promedio: {mainSpeed.toFixed(0)} km/h</p>}
              {mainSummary?.lengthInMeters && <p>Distancia: {(mainSummary.lengthInMeters / 1000).toFixed(1)} km</p>}
              {mainSummary?.travelTimeInSeconds && <p>Tiempo: {Math.round(mainSummary.travelTimeInSeconds / 60)} min</p>}
              {mainSummary?.trafficDelayInSeconds > 0 && <p className="text-red-400">Retraso: {Math.round(mainSummary.trafficDelayInSeconds / 60)} min</p>}
            </div>
          </Popup>
        </Polyline>
      )}

      {/* Alternative routes */}
      {alternatives.map((alt) => {
        const isSelected = selectedAlternative === alt.index;
        return (
          <Polyline
            key={alt.index}
            positions={alt.positions}
            pathOptions={{
              color: '#38bdf8',
              weight: isSelected ? 6 : 4,
              opacity: isSelected ? 0.9 : 0.5,
              dashArray: isSelected ? null : '10, 10',
            }}
          >
            <Popup>
              <div className="text-xs space-y-1">
                <p className="font-bold">Ruta alternativa {alt.index + 1}</p>
                {alt.speed && <p>Velocidad: {alt.speed.toFixed(0)} km/h</p>}
                {alt.summary?.lengthInMeters && <p>Distancia: {(alt.summary.lengthInMeters / 1000).toFixed(1)} km</p>}
                {alt.summary?.travelTimeInSeconds && <p>Tiempo: {Math.round(alt.summary.travelTimeInSeconds / 60)} min</p>}
              </div>
            </Popup>
          </Polyline>
        );
      })}

      {/* Congestion circles */}
      {congestionZones.map((zone, idx) => (
        <Circle
          key={`cong-${idx}`}
          center={[zone.lat, zone.lng]}
          radius={congestionRadius(zone.congestionLevel)}
          pathOptions={{
            color: congestionColor(zone.congestionLevel),
            fillColor: congestionColor(zone.congestionLevel),
            fillOpacity: 0.3,
            weight: 2,
          }}
        >
          <Popup>
            <div className="text-xs space-y-1">
              <p className="font-bold">Congestión {zone.congestionLevel}</p>
              <p>Actual: {zone.currentSpeed?.toFixed(0)} km/h</p>
              <p>Flujo libre: {zone.freeFlowSpeed?.toFixed(0)} km/h</p>
            </div>
          </Popup>
        </Circle>
      ))}
    </MapContainer>
  );
}