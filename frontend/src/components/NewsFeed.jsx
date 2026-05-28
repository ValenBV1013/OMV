import React from 'react';
import { Newspaper, Car } from 'lucide-react';

export const NewsFeed = ({ noticias }) => {
    return (
        <section id="noticias" className="space-y-6 my-12">
            <h2 className="text-2xl font-bold text-slate-900 flex items-center gap-2">
                <Newspaper className="text-amber-500 w-6 h-6" /> Reportes Recientes & Periódico Digital
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {noticias.map((item) => (
                    <article key={item.id} className="bg-white rounded-2xl overflow-hidden shadow-sm border border-slate-200 flex flex-col group hover:shadow-md transition">
                        <div className="h-48 bg-slate-300 relative overflow-hidden">
                            <img src={item.imagen} alt={item.titulo} className="w-full h-full object-cover group-hover:scale-105 transition duration-300" />
                            <span className="absolute top-3 left-3 bg-red-600 text-white text-xs px-2 py-1 rounded font-bold uppercase">
                                {item.tipo_alerta_display || 'Reporte'}
                            </span>
                        </div>
                        <div className="p-5 flex-grow flex flex-col justify-between space-y-4">
                            <div>
                                <span className="text-xs text-slate-400 block mb-1">REGISTRO HISTÓRICO</span>
                                <h3 className="font-bold text-base text-slate-950 leading-snug hover:text-indigo-600 cursor-pointer">
                                    {item.titulo}
                                </h3>
                                <p className="text-xs text-slate-600 line-clamp-3 mt-2">{item.descripcion}</p>
                            </div>
                            <div className="pt-3 border-t border-slate-100 flex justify-between items-center text-xs text-slate-500">
                                <span className="flex items-center gap-1">
                                    <Car className="w-4 h-4 text-red-500" /> Histórico sector
                                </span>
                                <span className="font-semibold text-indigo-600 cursor-pointer">Ver detalles →</span>
                            </div>
                        </div>
                    </article>
                ))}
            </div>
        </section>
    );
};

export default NewsFeed;