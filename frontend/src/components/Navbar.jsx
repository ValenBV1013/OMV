import React from 'react';
import { Link2 } from 'lucide-react';
// Importamos el logo desde la carpeta de assets
import logoOMV from '../assets/logo_OMV.jpeg'; 

const Navbar = () => {
  return (
    <header className="bg-slate-900 text-white p-4 sticky top-0 z-[9999] shadow-md">
      <div className="container mx-auto flex flex-col md:flex-row justify-between items-center gap-4">
        
        {/* Contenedor del Logo y Título */}
        <div className="flex items-center gap-3">
          <img 
            src={logoOMV} 
            alt="Logo OMV" 
            className="w-10 h-10 object-cover rounded-lg border border-slate-700 shadow-sm"
          />
          <h1 className="text-xl font-bold tracking-tight">
            OMV - Observatorio de Mitigación Vial
          </h1>
        </div>

        {/* Navegación interna */}
        <nav className="flex gap-6 text-sm font-medium">
          <a href="#mapa" className="hover:text-amber-400 transition">Mapa Crítico</a>
          <a href="#congestion" className="hover:text-amber-400 transition">Mapa de Congestión</a>
          <a href="#noticias" className="hover:text-amber-400 transition">Histórico & Noticias</a>
          <a href="#fotomultas" className="hover:text-amber-400 transition">Fotomultas & Costos</a>
          <a href="#rutas-seguras" className="hover:text-amber-400 transition">Rutas Seguras</a>
        </nav>

        {/* Botón de Fuente Oficial */}
        <a 
          href="https://www.medellin.gov.co/es/secretaria-de-movilidad/observatorio-de-movilidad/incidentes-y-victimas-por-hechos-de-transito/" 
          target="_blank" 
          rel="noreferrer"
          className="bg-amber-500 hover:bg-amber-600 text-slate-900 px-4 py-2 rounded-lg text-sm font-bold flex items-center gap-2 transition shadow"
        >
          <Link2 className="w-4 h-4" /> Fuente Oficial
        </a>
      </div>
    </header>
  );
};

export default Navbar;