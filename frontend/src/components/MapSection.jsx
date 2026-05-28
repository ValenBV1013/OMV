import React from 'react';
import { GoogleMap, useJsApiLoader, MarkerF } from '@react-google-maps/api';
import { MapPin, TrendingUp } from 'lucide-react';

const containerStyle = { width: '100%', height: '100%' };
const center = { lat: 6.2442, lng: -75.5812 };

const MapSection = ({ zonasCriticas, estadisticas }) => {
    // Cargamos la API de Google Maps de forma limpia
    const { isLoaded } = useJsApiLoader({
        id: 'google-map-script',
        googleMapsApiKey: "TU_GOOGLE_MAPS_API_KEY_AQUÍ"
    });

    return (
        <section id="mapa" className="grid grid-cols-1 lg:grid-cols-3 gap-8 my-10">
            {/* Contenedor del Mapa */}
            <div className="lg:col-span-2 bg-white p-4 rounded-2xl shadow-sm border border-slate-200 flex flex-col h-[500px]">
                <div className="flex justify-between items-center mb-4">
                    <h2 className="text-lg font-bold flex items-center gap-2 text-slate-900">
                        <MapPin className="text-indigo-600 w-5 h-5" /> Mapificación de Accidentes Históricos
                    </h2>
                    <span className="bg-red-100 text-red-700 text-xs px-2.5 py-1 rounded-full font-semibold">
                        Predicción de Riesgo Activa
                    </span>
                </div>

                <div className="w-full flex-grow bg-slate-100 rounded-xl overflow-hidden relative shadow-inner">
                    {isLoaded ? (
                        <GoogleMap containerStyle={containerStyle} center={center} zoom={12}>
                            {/* Pintamos un marcador por cada zona crítica de accidentes de forma segura */}
                            {zonasCriticas && zonasCriticas.map((zona) => (
                                <MarkerF
                                    key={zona.id}
                                    position={{ lat: zona.latitud, lng: zona.longitud }}
                                    title={`${zona.sector_geografico} (${zona.total_accidentes} accidentes)`}
                                />
                            ))}
                        </GoogleMap>
                    ) : (
                        <div className="flex items-center justify-center h-full text-slate-400">
                            Cargando Google Maps...
                        </div>
                    )}
                </div>
            </div>

            {/* Panel Lateral: Cifras de Víctimas */}
            <div className="space-y-6 flex flex-col justify-between">
                <div className="bg-gradient-to-br from-slate-900 to-indigo-950 text-white p-6 rounded-2xl shadow-xl space-y-4 flex-grow flex flex-col justify-center">
                    <h3 className="text-sm font-semibold uppercase tracking-wider text-indigo-300">Análisis Acumulado de Víctimas</h3>
                    <div>
                        <p className="text-5xl font-extrabold text-white tracking-tight">{estadisticas.total || 0}</p>
                        <p className="text-xs text-slate-400 mt-1">Incidentes consolidados en el sector seleccionado</p>
                    </div>
                    <div className="border-t border-indigo-800/60 pt-4 grid grid-cols-2 gap-4 text-center">
                        <div className="bg-indigo-900/40 p-3 rounded-xl">
                            <span className="text-xs text-indigo-200 block">Lesionados</span>
                            <span className="text-xl font-bold text-amber-400">{estadisticas.lesionados || 0}</span>
                        </div>
                        <div className="bg-indigo-900/40 p-3 rounded-xl">
                            <span className="text-xs text-indigo-200 block">Fatalidades</span>
                            <span className="text-xl font-bold text-rose-500">{estadisticas.fatalidades || 0}</span>
                        </div>
                    </div>
                </div>

                {/* Modelo Predictivo */}
                <div className="bg-white p-5 rounded-2xl shadow-sm border border-slate-200">
                    <h4 className="text-sm font-bold text-slate-900 mb-3 flex items-center gap-2">
                        <TrendingUp className="text-emerald-500 w-5 h-5" /> Modelo Predictivo de Riesgo
                    </h4>
                    <p className="text-xs text-slate-600 mb-4">Zonas con mayor probabilidad de incidentes viales según patrones de datos históricos:</p>
                    <div className="space-y-3">
                        {zonasCriticas.slice(0, 2).map((zona, index) => (
                            <div key={index}>
                                <div className="flex justify-between text-xs font-medium mb-1">
                                    <span className="text-slate-700 truncate max-w-[200px]">{zona.sector_geografico}</span>
                                    <span className="text-red-600 font-bold">{zona.nivel_riesgo_predictivo}%</span>
                                </div>
                                <div className="w-full bg-slate-100 h-2 rounded-full">
                                    <div className="bg-red-500 h-2 rounded-full" style={{ width: `${zona.nivel_riesgo_predictivo}%` }}></div>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            </div>
        </section>
    );
};

export default MapSection;