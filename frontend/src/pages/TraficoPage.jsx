import { useNavigate } from 'react-router-dom';
import Navbar from '../components/Navbar';
import TrafficIRL from '../components/TrafficIRL';

export default function TraficoPage() {
  const navigate = useNavigate();

  const handleSetVista = (vista) => {
    if (vista === 'estadisticas') navigate('/');
    else navigate(`/${vista}`);
  };

  return (
    <div className="bg-slate-900 min-h-screen text-slate-100 flex flex-col">
      <Navbar setVista={handleSetVista} />
      <div className="flex-1">
        <TrafficIRL />
      </div>
    </div>
  );
}