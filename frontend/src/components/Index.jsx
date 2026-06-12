import { useState, useEffect, useRef } from 'react';
import { ShieldAlert, Clock, Zap, TrendingDown, AlertTriangle, CheckCircle2, RefreshCw } from 'lucide-react';
import { getFotomultasRealtime, subscribeFotomultas } from '../services/fotomultasApi';

import imgVarianteCaldas from '../assets/variante_caldas.png';
import imgSanJuan from '../assets/accidente_san_juan.png';
import imgTunelOriente from '../assets/tunel_oriente.png';

const RESPALDO_NOTICIAS = [
  { id: 'fb-1', titulo: 'En la variante a Caldas van nueve muertos: es la vía más letal del Valle de Aburrá', descripcion: 'De acuerdo con los reportes judiciales, todas las víctimas registradas en este importante corredor vial se han presentado en la calzada en descenso hacia Medellín...', imagen: imgVarianteCaldas, tipo_alerta_display: 'Crítico', url: 'https://www.elcolombiano.com/antioquia/accidentes-variante-a-caldas-medellin-MF35659335' },
  { id: 'fb-2', titulo: 'Un motociclista y un peatón muertos en trágicos accidentes de tránsito en Medellín', descripcion: 'La ciudad sumó nuevas fatalidades viales tras reportarse dos fuertes impactos durante la madrugada...', imagen: imgSanJuan, tipo_alerta_display: 'Crítico', url: 'https://qhubomedellin.com/actualidad/movilidad/un-motociclista-y-un-peaton-muertos-en-accidentes-de-transito-en-medellin-HH34002140' },
  { id: 'fb-3', titulo: 'Una persona murió tras choque de camioneta contra una caseta en el Túnel de Oriente', descripcion: 'Un trágico accidente de tránsito se registró en la mañana de este jueves en el Túnel de Oriente...', imagen: imgTunelOriente, tipo_alerta_display: 'Crítico', url: 'https://www.elcolombiano.com/antioquia/una-persona-murio-tras-choque-de-camioneta-contra-una-caseta-en-el-tunel-de-oriente-GI36584222' },
];

// ── Hook para animación de scroll ─────────────────────────────────────────────
function useScrollReveal(threshold = 0.15) {
  const ref = useRef(null);
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setIsVisible(true);
          observer.unobserve(entry.target);
        }
      },
      { threshold, rootMargin: '0px 0px -50px 0px' }
    );

    if (ref.current) {
      observer.observe(ref.current);
    }

    return () => {
      if (ref.current) {
        observer.unobserve(ref.current);
      }
    };
  }, [threshold]);

  return [ref, isVisible];
}

// ── Hero ──────────────────────────────────────────────────────────────────────
function Hero({ setVista }) {
  return (
    <section className="relative min-h-screen flex items-center overflow-hidden"
      style={{ background: 'linear-gradient(160deg,#09070f 0%,#120a24 55%,#09070f 100%)' }}>

      <div className="absolute inset-0 opacity-10"
        style={{ backgroundImage: 'linear-gradient(rgba(139,92,246,0.5) 1px,transparent 1px),linear-gradient(90deg,rgba(139,92,246,0.5) 1px,transparent 1px)', backgroundSize: '60px 60px' }} />
      <div className="absolute top-1/3 right-1/4 w-80 h-80 rounded-full opacity-20 blur-3xl" style={{ background: '#7c3aed' }} />
      <div className="absolute bottom-1/3 left-1/5 w-56 h-56 rounded-full opacity-15 blur-3xl" style={{ background: '#4c1d95' }} />

      <div className="relative z-10 max-w-7xl mx-auto px-6 md:px-10 grid grid-cols-1 lg:grid-cols-2 gap-14 items-center pt-28 pb-20">
        <div>
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full text-purple-300 text-xs font-medium mb-6 border"
            style={{ borderColor: 'rgba(139,92,246,0.3)', background: 'rgba(124,58,237,0.1)' }}>
            <span className="w-2 h-2 rounded-full bg-purple-400 animate-pulse" />
            Observatorio de Mitigación Vial — Medellín
          </div>

          <h1 className="text-4xl md:text-6xl font-black text-white leading-tight mb-6"
            style={{ fontFamily: "'Orbitron',monospace", textShadow: '0 0 40px rgba(139,92,246,0.25)' }}>
            Inteligencia Vial
            <span className="block" style={{ background: 'linear-gradient(135deg,#a78bfa,#7c3aed,#c4b5fd)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
              en Tiempo Real
            </span>
          </h1>

          <p className="text-gray-400 text-lg leading-relaxed mb-10 max-w-lg">
            Analiza zonas críticas, predice riesgos y navega de forma segura en Medellín con datos oficiales y modelos de IA actualizados.
          </p>

          <div className="flex flex-wrap gap-3">
            {[
              { label: '🗺️ Mapa Predictivo', vista: 'mapa',    primary: true  },
              { label: '🛣️ Rutas Seguras',   vista: 'rutas',   primary: false },
              { label: '🚦 Tráfico IRL',     vista: 'trafico', primary: false },
            ].map(({ label, vista, primary }) => (
              <button key={vista} onClick={() => setVista(vista)}
                className="px-6 py-3 rounded-full font-semibold text-sm transition-all duration-200 hover:scale-105"
                style={primary
                  ? { background: 'linear-gradient(135deg,#7c3aed,#5b21b6)', color: '#fff', boxShadow: '0 0 28px rgba(124,58,237,0.45)' }
                  : { background: 'transparent', color: '#c4b5fd', border: '1px solid rgba(139,92,246,0.35)' }
                }>
                {label}
              </button>
            ))}
          </div>
        </div>

        {/* Orb */}
        <div className="hidden lg:flex items-center justify-center">
          <div className="relative w-72 h-72">
            {[0,1,2].map(i => (
              <div key={i} className="absolute rounded-full border border-purple-500/20"
                style={{ inset:`${-i*22}px`, animation:`omvSpin ${6+i*2}s linear infinite ${i%2===0?'':'reverse'}` }}>
                <div className="absolute w-2.5 h-2.5 rounded-full bg-purple-400"
                  style={{ top:'-5px', left:'50%', transform:'translateX(-50%)', boxShadow:'0 0 8px rgba(167,139,250,0.9)' }} />
              </div>
            ))}
            <div className="absolute inset-10 rounded-full flex flex-col items-center justify-center"
              style={{ background:'radial-gradient(circle,#7c3aed 0%,#4c1d95 50%,#1e0a3c 100%)', boxShadow:'0 0 60px rgba(124,58,237,0.55),0 0 120px rgba(124,58,237,0.18)' }}>
              <span className="text-4xl">🛡️</span>
              <span className="text-white text-xs font-bold mt-1 tracking-widest" style={{ fontFamily:"'Orbitron',monospace" }}>OMV</span>
            </div>
          </div>
        </div>
      </div>

      {/* Marquee */}
      <div className="absolute bottom-0 left-0 right-0 py-3 overflow-hidden"
        style={{ background:'rgba(124,58,237,0.12)', borderTop:'1px solid rgba(139,92,246,0.18)' }}>
        <div className="flex gap-14 whitespace-nowrap" style={{ animation:'omvMarquee 22s linear infinite' }}>
          {['⚡ Análisis Predictivo','🔴 Zonas de Riesgo','🛣️ Rutas Optimizadas','🚦 Tráfico en Vivo','📊 Datos Oficiales','🤖 IA Vial',
            '⚡ Análisis Predictivo','🔴 Zonas de Riesgo','🛣️ Rutas Optimizadas','🚦 Tráfico en Vivo'].map((t,i) => (
            <span key={i} className="text-purple-300 text-sm font-medium tracking-wider">{t}</span>
          ))}
        </div>
      </div>

      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Orbitron:wght@700;900&display=swap');
        @keyframes omvSpin { from{transform:rotate(0deg)} to{transform:rotate(360deg)} }
        @keyframes omvMarquee { from{transform:translateX(0)} to{transform:translateX(-50%)} }
      `}</style>
    </section>
  );
}

// ── Noticias ──────────────────────────────────────────────────────────────────
function NoticiasSection() {
  const [noticias, setNoticias] = useState(RESPALDO_NOTICIAS);
  const [loading, setLoading]   = useState(true);
  const [current, setCurrent]   = useState(0);
  const [paused, setPaused]     = useState(false);
  const [sectionRef, isVisible] = useScrollReveal(0.1);

  useEffect(() => {
    (async () => {
      try {
        const res  = await fetch('https://newsapi.org/v2/top-headlines?country=co&category=general&apiKey=1312aa0f82e54b3ca5d885760c38036d');
        const data = await res.json();
        if (data.articles?.length > 0) {
          setNoticias(data.articles.slice(0,5).map((a,i) => ({
            id:`api-${i}`, titulo:a.title||'Reporte de Tránsito Local',
            descripcion:a.description||'Revise las condiciones de movilidad.',
            imagen:a.urlToImage||RESPALDO_NOTICIAS[i%3].imagen,
            tipo_alerta_display:i%2===0?'Crítico':'Reporte', url:a.url,
          })));
        }
      } catch(_) {}
      finally { setLoading(false); }
    })();
  }, []);

  useEffect(() => {
    if (paused || !noticias.length) return;
    const t = setInterval(() => setCurrent(p => (p+1)%noticias.length), 3500);
    return () => clearInterval(t);
  }, [noticias, paused]);

  return (
    <section 
      ref={sectionRef}
      className="py-24 transition-all duration-1000 ease-out" 
      style={{ 
        background:'#09070f',
        opacity: isVisible ? 1 : 0,
        transform: isVisible ? 'translateY(0)' : 'translateY(60px)'
      }}
    >
      <div className="max-w-6xl mx-auto px-6 md:px-10">
        <div className="text-center mb-14">
          <p className="text-purple-400 text-xs tracking-[0.4em] uppercase mb-3">Última Hora</p>
          <div className="flex items-center justify-center gap-4 mb-4">
            <div className="h-px w-16" style={{ background:'linear-gradient(90deg,transparent,#7c3aed)' }} />
            <div className="w-2 h-2 rotate-45 bg-purple-500" />
            <div className="h-px w-16" style={{ background:'linear-gradient(90deg,#7c3aed,transparent)' }} />
          </div>
          <h2 className="text-3xl md:text-4xl font-black text-white" style={{ fontFamily:"'Orbitron',monospace" }}>
            Siniestros e Información Vial
          </h2>
          {loading && <p className="text-purple-400 text-xs mt-3 animate-pulse">Sincronizando noticias...</p>}
        </div>

        <div className="rounded-2xl border overflow-hidden"
          style={{ borderColor:'rgba(139,92,246,0.2)', background:'rgba(124,58,237,0.04)' }}
          onMouseEnter={() => setPaused(true)} onMouseLeave={() => setPaused(false)}>
          <div className="flex flex-col md:flex-row">
            <div className="relative w-full md:w-2/5 h-56 md:h-72 overflow-hidden flex-shrink-0">
              <img src={noticias[current].imagen} alt="noticia" className="w-full h-full object-cover transition-transform duration-700 hover:scale-105" />
              <div className="absolute inset-0" style={{ background:'linear-gradient(90deg,transparent 60%,rgba(9,7,15,0.7))' }} />
              <span className={`absolute top-4 left-4 text-xs px-3 py-1.5 rounded-full font-bold shadow ${noticias[current].tipo_alerta_display==='Crítico'?'bg-rose-600 text-white':'bg-amber-500 text-slate-950'}`}>
                {noticias[current].tipo_alerta_display}
              </span>
              <button onClick={e=>{e.stopPropagation();setCurrent(p=>p===0?noticias.length-1:p-1);}}
                className="absolute left-3 bottom-4 w-9 h-9 rounded-full flex items-center justify-center text-white text-sm font-bold hover:scale-110 transition-all"
                style={{ background:'rgba(124,58,237,0.5)', border:'1px solid rgba(139,92,246,0.4)' }}>◀</button>
              <button onClick={e=>{e.stopPropagation();setCurrent(p=>(p+1)%noticias.length);}}
                className="absolute right-3 bottom-4 w-9 h-9 rounded-full flex items-center justify-center text-white text-sm font-bold hover:scale-110 transition-all"
                style={{ background:'rgba(124,58,237,0.5)', border:'1px solid rgba(139,92,246,0.4)' }}>▶</button>
            </div>
            <div className="p-7 flex flex-col justify-between flex-1">
              <div>
                <h3 className="font-bold text-xl text-amber-400 mb-3 leading-snug">{noticias[current].titulo}</h3>
                <p className="text-sm text-gray-400 leading-relaxed">{noticias[current].descripcion}</p>
              </div>
              <div className="pt-5 border-t mt-5 flex justify-between items-center" style={{ borderColor:'rgba(139,92,246,0.15)' }}>
                <a href={noticias[current].url} target="_blank" rel="noopener noreferrer"
                  className="text-sm font-bold text-amber-500 hover:text-amber-400 transition">
                  Ver noticia completa 🔗
                </a>
                <span className="text-xs text-gray-600 font-mono">{current+1} / {noticias.length}</span>
              </div>
            </div>
          </div>
        </div>

        <div className="flex justify-center gap-2 mt-5">
          {noticias.map((_,i) => (
            <button key={i} onClick={() => setCurrent(i)}
              className="w-2 h-2 rounded-full transition-all duration-300"
              style={{ background:i===current?'#7c3aed':'rgba(139,92,246,0.25)', transform:i===current?'scale(1.4)':'scale(1)' }} />
          ))}
        </div>
      </div>
    </section>
  );
}

// ── Fotomultas en Tiempo Real ──────────────────────────────────────────────────
function FotomultasSection() {
  const [fotomultas, setFotomultas] = useState([]);
  const [loading, setLoading] = useState(true);
  const [lastUpdate, setLastUpdate] = useState(new Date());
  const [horaPico, setHoraPico] = useState(false);
  const [sectionRef, isVisible] = useScrollReveal(0.1);

  useEffect(() => {
    // Carga inicial
    getFotomultasRealtime().then(data => {
      setFotomultas(data);
      setHoraPico(data[0]?.esHoraPico || false);
      setLoading(false);
      setLastUpdate(new Date());
    });

    // Suscripción en tiempo real (cada 30 segundos)
    const unsubscribe = subscribeFotomultas((data) => {
      setFotomultas(data);
      setHoraPico(data[0]?.esHoraPico || false);
      setLastUpdate(new Date());
    }, 30000);

    return () => unsubscribe();
  }, []);

  const formatearPeso = (valor) => {
    return new Intl.NumberFormat('es-CO', {
      style: 'currency',
      currency: 'COP',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0
    }).format(valor);
  };

  const getCategoriaColor = (categoria) => {
    switch(categoria) {
      case 'velocidad': return { bg: 'rgba(244,63,94,0.15)', border: 'rgba(244,63,94,0.3)', text: '#fda4af', icon: '⚡' };
      case 'semaforo': return { bg: 'rgba(245,158,11,0.15)', border: 'rgba(245,158,11,0.3)', text: '#fcd34d', icon: '🚦' };
      case 'pico_placa': return { bg: 'rgba(168,85,247,0.15)', border: 'rgba(168,85,247,0.3)', text: '#c4b5fd', icon: '🚫' };
      case 'soat': return { bg: 'rgba(34,211,238,0.15)', border: 'rgba(34,211,238,0.3)', text: '#a5f3fc', icon: '📄' };
      case 'carril': return { bg: 'rgba(139,92,246,0.15)', border: 'rgba(139,92,246,0.3)', text: '#ddd6fe', icon: '🚌' };
      default: return { bg: 'rgba(107,114,128,0.15)', border: 'rgba(107,114,128,0.3)', text: '#9ca3af', icon: '⚠️' };
    }
  };

  return (
    <section 
      ref={sectionRef}
      className="py-24 transition-all duration-1000 ease-out" 
      style={{ 
        background:'#09070f',
        opacity: isVisible ? 1 : 0,
        transform: isVisible ? 'translateY(0)' : 'translateY(60px)'
      }}
    >
      <div className="max-w-6xl mx-auto px-6 md:px-10">
        <div className="text-center mb-14">
          <p className="text-purple-400 text-xs tracking-[0.4em] uppercase mb-3">Tabulador Oficial</p>
          <div className="flex items-center justify-center gap-4 mb-4">
            <div className="h-px w-16" style={{ background:'linear-gradient(90deg,transparent,#7c3aed)' }} />
            <div className="w-2 h-2 rotate-45 bg-purple-500" />
            <div className="h-px w-16" style={{ background:'linear-gradient(90deg,#7c3aed,transparent)' }} />
          </div>
          <h2 className="text-3xl md:text-4xl font-black text-white mb-4" style={{ fontFamily:"'Orbitron',monospace" }}>
            Fotomultas y Costos
          </h2>
          <p className="text-gray-400 text-sm max-w-lg mx-auto">
            Valores liquidados con base en la normativa legal e indicadores vigentes. 
            Actualización en tiempo real.
          </p>
        </div>

        {/* Banner de descuento */}
        <div className="mb-8 rounded-xl p-4 flex items-center justify-between border"
          style={{ 
            background: 'linear-gradient(135deg, rgba(245,158,11,0.1) 0%, rgba(251,191,36,0.05) 100%)',
            borderColor: 'rgba(245,158,11,0.25)'
          }}>
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg flex items-center justify-center"
              style={{ background: 'rgba(245,158,11,0.2)', border: '1px solid rgba(245,158,11,0.3)' }}>
              <TrendingDown size={20} className="text-amber-400" />
            </div>
            <div>
              <p className="text-amber-300 text-sm font-semibold">Descuento por pronto pago</p>
              <p className="text-gray-400 text-xs">Pague dentro de los primeros 5 días y obtenga 50% de descuento</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
            <span className="text-emerald-400 text-xs font-mono">
              {horaPico ? 'Tarifa estándar activa' : 'Tarifa reducida activa'}
            </span>
          </div>
        </div>

        {/* Tabla de fotomultas */}
        <div className="rounded-2xl border overflow-hidden" 
          style={{ borderColor:'rgba(139,92,246,0.2)', background:'rgba(124,58,237,0.04)' }}>
          
          {/* Header de tabla */}
          <div className="px-6 py-4 border-b flex items-center justify-between" 
            style={{ borderColor:'rgba(139,92,246,0.15)', background:'linear-gradient(135deg, rgba(15,15,42,0.8) 0%, rgba(88,28,135,0.4) 100%)' }}>
            <div className="flex items-center gap-2">
              <ShieldAlert size={18} className="text-purple-400" />
              <h3 className="text-white font-bold text-sm">Tabulador de Infracciones, Advertencias y Costos</h3>
            </div>
            <div className="flex items-center gap-2">
              <RefreshCw size={14} className={`text-purple-400 ${loading ? 'animate-spin' : ''}`} />
              <span className="text-purple-400 text-xs font-mono">
                {lastUpdate.toLocaleTimeString('es-CO')}
              </span>
            </div>
          </div>

          {loading ? (
            <div className="p-12 text-center">
              <div className="w-8 h-8 rounded-full border-2 border-purple-500 border-t-transparent animate-spin mx-auto mb-4" />
              <p className="text-purple-400 text-sm">Cargando datos en tiempo real...</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left">
                <thead>
                  <tr className="text-xs uppercase tracking-wider text-purple-300 border-b" 
                    style={{ borderColor:'rgba(139,92,246,0.15)', background:'rgba(15,15,42,0.6)' }}>
                    {['Tipo de Infracción', 'Código SIMIT', 'Advertencia / Criterio', 'Costo a Pagar (COP)'].map(h => (
                      <th key={h} className="px-6 py-4 font-semibold">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {fotomultas.map((f, idx) => {
                    const catStyle = getCategoriaColor(f.categoria);
                    return (
                      <tr key={f.id} 
                        className="border-b transition-all duration-300 hover:bg-white/[0.02]" 
                        style={{ borderColor:'rgba(139,92,246,0.08)' }}>
                        
                        {/* Tipo */}
                        <td className="px-6 py-5">
                          <div className="flex items-center gap-3">
                            <div className="w-8 h-8 rounded-lg flex items-center justify-center text-sm"
                              style={{ background: catStyle.bg, border: `1px solid ${catStyle.border}` }}>
                              {catStyle.icon}
                            </div>
                            <div>
                              <p className="text-white font-medium text-sm">{f.tipo}</p>
                              <span className="text-xs px-2 py-0.5 rounded-full mt-1 inline-block"
                                style={{ background: catStyle.bg, color: catStyle.text, border: `1px solid ${catStyle.border}` }}>
                                {f.categoria.replace('_', ' ')}
                              </span>
                            </div>
                          </div>
                        </td>

                        {/* Código */}
                        <td className="px-6 py-5">
                          <span className="text-purple-300 font-mono text-sm font-bold px-3 py-1.5 rounded-lg"
                            style={{ background:'rgba(139,92,246,0.1)', border:'1px solid rgba(139,92,246,0.2)' }}>
                            {f.codigo}
                          </span>
                        </td>

                        {/* Criterio */}
                        <td className="px-6 py-5">
                          <p className="text-gray-400 text-sm leading-relaxed max-w-xs">{f.criterio}</p>
                        </td>

                        {/* Costo */}
                        <td className="px-6 py-5">
                          <div className="text-right">
                            <p className="text-white font-bold text-lg font-mono">
                              {formatearPeso(f.costoActual)}
                            </p>
                            <p className="text-emerald-400 text-xs mt-1 flex items-center justify-end gap-1">
                              <CheckCircle2 size={12} />
                              Con descuento: {formatearPeso(f.costoConDescuento)}
                            </p>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}

          {/* Footer de tabla */}
          <div className="px-6 py-4 border-t flex items-center justify-between"
            style={{ borderColor:'rgba(139,92,246,0.15)', background:'rgba(15,15,42,0.4)' }}>
            <p className="text-gray-500 text-xs">
              Fuente: Secretaría de Movilidad de Medellín · Resolución 2024-045
            </p>
            <div className="flex items-center gap-2">
              <Clock size={12} className="text-purple-400" />
              <span className="text-purple-400 text-xs">
                Actualización automática cada 30 segundos
              </span>
            </div>
          </div>
        </div>

        {/* Stats rápidas */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-8">
          {[
            { label: 'Infracciones vigentes', value: fotomultas.length, color: '#a78bfa', icon: '⚠️' },
            { label: 'Costo promedio', value: fotomultas.length > 0 ? formatearPeso(fotomultas.reduce((s,f) => s+f.costoActual, 0)/fotomultas.length) : '$0', color: '#fbbf24', icon: '💰' },
            { label: 'Mayor sanción', value: fotomultas.length > 0 ? formatearPeso(Math.max(...fotomultas.map(f => f.costoActual))) : '$0', color: '#f43f5e', icon: '🔴' },
            { label: 'Ahorro potencial', value: fotomultas.length > 0 ? formatearPeso(fotomultas.reduce((s,f) => s+(f.costoActual-f.costoConDescuento), 0)) : '$0', color: '#22d3ee', icon: '✅' },
          ].map(({ label, value, color, icon }) => (
            <div key={label} className="rounded-xl p-4 border"
              style={{ 
                background: 'linear-gradient(135deg, rgba(15,15,42,0.6) 0%, rgba(88,28,135,0.2) 100%)',
                borderColor: 'rgba(139,92,246,0.15)'
              }}>
              <div className="text-2xl mb-1">{icon}</div>
              <p className="text-white font-bold text-lg font-mono" style={{ color }}>{value}</p>
              <p className="text-gray-500 text-xs mt-1">{label}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────
export default function Index({ setVista }) {
  return (
    <div className="min-h-screen" style={{ fontFamily:'system-ui,sans-serif' }}>
      <Hero setVista={setVista} />
      <NoticiasSection />
      <FotomultasSection />
      <footer className="py-8 border-t text-center" style={{ background:'#09070f', borderColor:'rgba(139,92,246,0.12)' }}>
        <p className="text-gray-600 text-sm">© 2026 OMV - Observatorio de Mitigación Vial.</p>
      </footer>
    </div>
  );
}