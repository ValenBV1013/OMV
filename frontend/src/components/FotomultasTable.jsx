import React from 'react';
import { Receipt, Info, ShieldAlert } from 'lucide-react';

// test

export const FotomultasTable = ({ infracciones }) => {
    return (
        <section id="fotomultas" className="bg-white p-6 md:p-8 rounded-2xl shadow-sm border border-slate-200 space-y-6 my-12">
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                <div>
                    <h2 className="text-xl font-bold text-slate-900 flex items-center gap-2">
                        <Receipt className="text-rose-500 w-6 h-6" /> Tabulador de Infracciones, Advertencias y Costos
                    </h2>
                    <p className="text-xs text-slate-500 mt-1">Valores liquidados con base en la normativa legal e indicadores vigentes.</p>
                </div>
                <div className="bg-amber-50 text-amber-800 text-xs px-4 py-2 rounded-xl border border-amber-200 flex items-center gap-2">
                    <Info className="text-amber-500 w-5 h-5 flex-shrink-0" />
                    <span>El pago oportuno dentro de los términos otorga un <strong>50% de descuento</strong>.</span>
                </div>
            </div>

            <div className="overflow-x-auto rounded-xl border border-slate-100 shadow-inner">
                <table className="w-full text-left border-collapse">
                    <thead>
                        <tr className="bg-slate-900 text-white text-xs font-semibold uppercase tracking-wider">
                            <th className="p-4">Tipo de Infracción (Fotomulta)</th>
                            <th className="p-4">Código SIMIT</th>
                            <th className="p-4">Advertencia / Criterio de Riesgo</th>
                            <th className="p-4 text-right">Costo a Pagar (COP)</th>
                        </tr>
                    </thead>
                    <tbody className="text-xs divide-y divide-slate-100 font-medium">
                        {infracciones.map((inf) => (
                            <tr key={inf.id} className="hover:bg-slate-50/70 transition">
                                <td className="p-4 font-bold text-slate-950 flex items-center gap-2">
                                    <ShieldAlert className="text-red-500 w-4 h-4 flex-shrink-0" />
                                    {inf.nombre_infraccion}
                                </td>
                                <td className="p-4 text-slate-500">{inf.codigo_simit}</td>
                                <td className="p-4 text-slate-600 max-w-sm">{inf.advertencia_riesgo}</td>
                                <td className="p-4 text-right font-bold text-slate-900">
                                    ${Number(inf.costo_cop).toLocaleString('es-CO', { minimumFractionDigits: 0 })}
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        </section>
    );
};

export default FotomultasTable;
