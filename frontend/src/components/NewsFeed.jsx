import React from 'react';
import { Newspaper, Car } from 'lucide-react';

export const NewsFeed = ({ noticias }) => {
    return (
        <section id="noticias" className="space-y-6 w-full">
            <h2 className="text-2xl font-bold text-slate-100 flex items-center gap-2 mb-4">
                <Newspaper className="text-amber-500 w-6 h-6" /> Reportes Recientes & Periódico Digital
            </h2>
            
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 w-full">
                {noticias.map((item) => {
                    // Mapeo manual para asegurar imágenes 100% reales de accidentes y emergencias de tránsito
                    let imagenReal = item.imagen;
                    if (item.id === 1) {
                        imagenReal = "https://images.unsplash.com/photo-1583332061676-e17f401f8d83?auto=format&fit=crop&w=600&q=80"; // Ambulancia en escena de accidente
                    } else if (item.id === 2) {
                        imagenReal = "https://images.unsplash.com/photo-1617464134886-444a7b5368a2?auto=format&fit=crop&w=600&q=80"; // Vehículo estrellado / colisión
                    } else if (item.id === 3) {
                        imagenReal = "https://images.unsplash.com/photo-1601584115197-04ecc0da31d7?auto=format&fit=crop&w=600&q=80"; // Paramédicos y luces de emergencia en carretera
                    }

                    // URL de respaldo por si el objeto del backend o del estado no trae una url válida
                    const urlDestino = item.url || "https://www.medellin.gov.co/es/secretaria-de-movilidad/";

                    return (
                        <article key={item.id} className="bg-white rounded-2xl overflow-hidden shadow-sm border border-slate-200 flex flex-col group hover:shadow-md transition w-full">
                            <div className="h-48 bg-slate-300 relative overflow-hidden">
                                <img 
                                    src={imagenReal} 
                                    alt={item.titulo} 
                                    className="w-full h-full object-cover group-hover:scale-105 transition duration-300" 
                                    onError={(e) => {
                                        e.target.src = "https://images.unsplash.com/photo-1583332061676-e17f401f8d83?auto=format&fit=crop&w=600&q=80";
                                    }}
                                />
                                <span className="absolute top-3 left-3 bg-red-600 text-white text-xs px-2 py-1 rounded font-bold uppercase shadow-sm">
                                    {item.tipo_alerta_display || 'Crítico'}
                                </span>
                            </div>
                            
                            <div className="p-5 flex-grow flex flex-col justify-between space-y-4">
                                <div>
                                    <span className="text-xs text-slate-400 block mb-1">REGISTRO HISTÓRICO</span>
                                    <a 
                                        href={urlDestino}
                                        target="_blank" 
                                        rel="noopener noreferrer"
                                        className="font-bold text-base text-slate-950 leading-snug hover:text-amber-600 transition-colors block cursor-pointer"
                                    >
                                        {item.titulo}
                                    </a>
                                    <p className="text-xs text-slate-600 mt-2">{item.descripcion}</p>
                                </div>
                                
                                <div className="pt-3 border-t border-slate-100 flex justify-between items-center text-xs text-slate-500">
                                    <span className="flex items-center gap-1">
                                        <Car className="w-4 h-4 text-red-500" /> Histórico sector
                                    </span>
                                    <a 
                                        href={urlDestino}
                                        target="_blank" 
                                        rel="noopener noreferrer" 
                                        className="font-semibold text-amber-600 hover:text-amber-700 transition-colors flex items-center gap-1 cursor-pointer"
                                    >
                                        Ver detalles →
                                    </a>
                                </div>
                            </div>
                        </article>
                    );
                })}
            </div>
        </section>
    );
};

export default NewsFeed;