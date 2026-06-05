import { useState } from 'react';
import TrafficIRLMap from './TrafficIRLMap';
import TrafficIRLPanel from './TrafficIRLPanel';
import { getTrafficRoute } from '../services/trafficApi';

export default function TrafficIRL() {
  const [routeData, setRouteData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [selectedAlternative, setSelectedAlternative] = useState(null);

  const handleCalculate = async (origen, destino) => {
    setLoading(true);
    setError(null);
    setRouteData(null);
    setSelectedAlternative(null);
    try {
      const data = await getTrafficRoute(origen, destino);
      if (data.error) {
        setError(data.error);
      } else {
        setRouteData(data);
      }
    } catch (err) {
      const msg = err.response?.data?.error || err.message || 'Error al calcular la ruta';
      setError(msg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex flex-col lg:flex-row gap-4 lg:gap-6 h-[calc(100vh-12rem)]">
      {/* Panel: scroll si el contenido es muy largo */}
      <div className="lg:w-80 xl:w-96 lg:shrink-0 overflow-y-auto">
        <TrafficIRLPanel
          onCalculate={handleCalculate}
          loading={loading}
          error={error}
          routeData={routeData}
          selectedAlternative={selectedAlternative}
          onSelectAlternative={setSelectedAlternative}
        />
      </div>
      {/* Mapa: ocupa el resto */}
      <div className="flex-1 min-h-[40vh] lg:min-h-0 bg-slate-800 rounded-xl overflow-hidden border border-slate-700 shadow-xl">
        <TrafficIRLMap
          routeData={routeData}
          selectedAlternative={selectedAlternative}
        />
      </div>
    </div>
  );
}
