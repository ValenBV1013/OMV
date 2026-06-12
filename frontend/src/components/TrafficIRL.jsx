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
    <div className="h-screen w-screen fixed inset-0 bg-[#0a0a1a] flex flex-col lg:flex-row overflow-hidden">
      {/* Panel: scroll si el contenido es muy largo */}
      <div className="lg:w-80 xl:w-96 lg:shrink-0 overflow-y-auto border-r border-violet-900/30 bg-[#0f0f2a]/80 backdrop-blur-sm">
        <TrafficIRLPanel
          onCalculate={handleCalculate}
          loading={loading}
          error={error}
          routeData={routeData}
          selectedAlternative={selectedAlternative}
          onSelectAlternative={setSelectedAlternative}
        />
      </div>
      {/* Mapa: recuadro con bordes, más pequeño */}
      <div className="flex-1 min-h-0 p-4 flex items-center justify-center">
        <div className="h-[calc(90%-2rem)] w-[calc(100%-2rem)] bg-[#0f0f2a] rounded-2xl overflow-hidden border border-violet-800/50 shadow-xl">
          <TrafficIRLMap
            routeData={routeData}
            selectedAlternative={selectedAlternative}
          />
        </div>
      </div>
    </div>
  );
}