import React from 'react';
import { AlertTriangle, Link2 } from 'lucide-react';

const Navbar = () => {
    return (
        <header className="bg-slate-900 text-white p-4 sticky top-0 z-50 shadow-md">
            <div className="container mx-auto flex flex-col md:flex-row justify-between items-center gap-4">
                <div className="flex items-center gap-3">
                    <AlertTriangle className="text-amber-500 w-6 h-6" />
                    <h1 className="text-xl font-bold tracking-tight">OMV - Observatorio de Movilidad y Víctimas</h1>
                </div>
                <nav className="flex gap-6 text-sm font-medium">
                    <a href="#mapa" className="hover:text-amber-400 transition">Mapa Crítico</a>
                    <a href="#noticias" className="hover:text-amber-400 transition">Histórico & Noticias</a>
                    <a href="#fotomultas" className="hover:text-amber-400 transition">Fotomultas & Costos</a>
                </nav>
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