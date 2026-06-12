import { useState, useEffect } from 'react';

import imgVarianteCaldas from '../assets/variante_caldas.png';
import imgSanJuan from '../assets/accidente_san_juan.png';
import imgTunelOriente from '../assets/tunel_oriente.png';

const RESPALDO_NOTICIAS = [
  { id: 'fb-1', titulo: 'En la variante a Caldas van nueve muertos: es la vía más letal del Valle de Aburrá', descripcion: 'De acuerdo con los reportes judiciales, todas las víctimas registradas en este importante corredor vial se han presentado en la calzada en descenso hacia Medellín...', imagen: imgVarianteCaldas, tipo_alerta_display: 'Crítico', url: 'https://www.elcolombiano.com/antioquia/accidentes-variante-a-caldas-medellin-MF35659335' },
  { id: 'fb-2', titulo: 'Un motociclista y un peatón muertos en trágicos accidentes de tránsito en Medellín', descripcion: 'La ciudad sumó nuevas fatalidades viales tras reportarse dos fuertes impactos durante la madrugada...', imagen: imgSanJuan, tipo_alerta_display: 'Crítico', url: 'https://qhubomedellin.com/actualidad/movilidad/un-motociclista-y-un-peaton-muertos-en-accidentes-de-transito-en-medellin-HH34002140' },
  { id: 'fb-3', titulo: 'Una persona murió tras choque de camioneta contra una caseta en el Túnel de Oriente', descripcion: 'Un trágico accidente de tránsito se registró en la mañana de este jueves en el Túnel de Oriente...', imagen: imgTunelOriente, tipo_alerta_display: 'Crítico', url: 'https://www.elcolombiano.com/antioquia/una-persona-murio-tras-choque-de-camioneta-contra-una-caseta-en-el-tunel-de-oriente-GI36584222' },
];

const HISTORICO = [
  { id: 1, sector: 'Autopista Sur',           accidentes: 45, lesionados: 32, fatalidades: 5, riesgo: 78, nivel: 'Alto'  },
  { id: 2, sector: 'Calle 30',                accidentes: 38, lesionados: 27, fatalidades: 3, riesgo: 65, nivel: 'Medio' },
  { id: 3, sector: 'Parque de los Deseos',    accidentes: 12, lesionados: 9,  fatalidades: 0, riesgo: 25, nivel: 'Bajo'  },
];

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

          <div className="flex gap-10 mt-12">
            {[['95','Accidentes registrados'],['68','Personas lesionadas'],['8','Víctimas fatales']].map(([num, label]) => (
              <div key={label}>
                <div className="text-3xl font-black" style={{ fontFamily: "'Orbitron',monospace", background: 'linear-gradient(135deg,#c4b5fd,#7c3aed)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
                  {num}
                </div>
                <div className="text-gray-500 text-xs mt-1 max-w-[80px] leading-tight">{label}</div>
              </div>
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

// ── Histórico ─────────────────────────────────────────────────────────────────
function HistoricoSection({ setVista }) {
  const total = HISTORICO.reduce((s,z) => s+z.accidentes, 0);
  const lesionados = HISTORICO.reduce((s,z) => s+z.lesionados, 0);
  const fatalidades = HISTORICO.reduce((s,z) => s+z.fatalidades, 0);

  return (
    <section id="historico" className="py-24" style={{ background:'#0d0918' }}>
      <div className="max-w-6xl mx-auto px-6 md:px-10">
        <div className="text-center mb-14">
          <p className="text-purple-400 text-xs tracking-[0.4em] uppercase mb-3">Datos Oficiales</p>
          <div className="flex items-center justify-center gap-4 mb-4">
            <div className="h-px w-16" style={{ background:'linear-gradient(90deg,transparent,#7c3aed)' }} />
            <div className="w-2 h-2 rotate-45 bg-purple-500" />
            <div className="h-px w-16" style={{ background:'linear-gradient(90deg,#7c3aed,transparent)' }} />
          </div>
          <h2 className="text-3xl md:text-4xl font-black text-white" style={{ fontFamily:"'Orbitron',monospace" }}>
            Histórico de Accidentalidad
          </h2>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-5 mb-10">
          {[
            { label:'Total Incidentes',    value:total,       cls:'from-rose-600 to-rose-700',   sub:'⬆️ +12% vs mes anterior',     dark:false },
            { label:'Personas Lesionadas', value:lesionados,  cls:'from-amber-500 to-amber-600', sub:'🚑 85% requirieron traslados', dark:true  },
            { label:'Víctimas Fatales',    value:fatalidades, cls:'from-slate-700 to-slate-800', sub:'⚠️ -5% vs año pasado',        dark:false },
          ].map(({ label, value, cls, sub, dark }) => (
            <div key={label} className={`bg-gradient-to-br ${cls} rounded-xl p-6 shadow-lg ${dark ? 'text-slate-950' : 'text-white'}`}>
              <div className="text-4xl font-extrabold mb-1">{value}</div>
              <div className="text-sm font-medium uppercase tracking-wider opacity-90">{label}</div>
              <div className={`text-xs mt-3 px-2 py-1 rounded inline-block ${dark ? 'bg-amber-600/30 font-semibold' : 'bg-black/20'}`}>{sub}</div>
            </div>
          ))}
        </div>

        <div className="rounded-2xl border overflow-hidden" style={{ borderColor:'rgba(139,92,246,0.2)', background:'rgba(124,58,237,0.04)' }}>
          <div className="px-6 py-4 border-b flex items-center justify-between" style={{ borderColor:'rgba(139,92,246,0.15)' }}>
            <h3 className="text-white font-bold flex items-center gap-2">🚨 Puntos Críticos Identificados</h3>
            <button onClick={() => setVista('mapa')}
              className="text-purple-400 text-xs hover:text-purple-300 transition-colors border px-3 py-1.5 rounded-lg"
              style={{ borderColor:'rgba(139,92,246,0.3)' }}>
              Ver en mapa →
            </button>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead>
                <tr className="text-xs uppercase tracking-wider text-gray-500 border-b" style={{ borderColor:'rgba(139,92,246,0.1)' }}>
                  {['Sector','Accidentes','Lesionados','Fatalidades','Riesgo','Nivel'].map(h => (
                    <th key={h} className="px-6 py-3">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {HISTORICO.map(zona => (
                  <tr key={zona.id} className="border-b hover:bg-white/[0.02] transition-colors" style={{ borderColor:'rgba(139,92,246,0.08)' }}>
                    <td className="px-6 py-4 text-gray-100 font-medium text-sm">{zona.sector}</td>
                    <td className="px-6 py-4 text-rose-400 font-bold">{zona.accidentes}</td>
                    <td className="px-6 py-4 text-amber-400 font-bold">{zona.lesionados}</td>
                    <td className="px-6 py-4 text-gray-400 font-bold">{zona.fatalidades}</td>
                    <td className="px-6 py-4">
                      <span className="px-3 py-1 rounded-full text-amber-400 font-mono font-bold text-sm border"
                        style={{ borderColor:'rgba(139,92,246,0.2)', background:'rgba(0,0,0,0.3)' }}>
                        {zona.riesgo}%
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <span className={`px-3 py-1 rounded-full text-xs font-bold ${zona.nivel==='Alto' ? 'bg-rose-500/20 text-rose-400 border border-rose-500/30' : zona.nivel==='Medio' ? 'bg-amber-500/20 text-amber-400 border border-amber-500/30' : 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'}`}>
                        {zona.nivel}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </section>
  );
}

// ── Noticias ──────────────────────────────────────────────────────────────────
function NoticiasSection() {
  const [noticias, setNoticias] = useState(RESPALDO_NOTICIAS);
  const [loading, setLoading]   = useState(true);
  const [current, setCurrent]   = useState(0);
  const [paused, setPaused]     = useState(false);

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
    <section className="py-24" style={{ background:'#09070f' }}>
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

// ── Page ──────────────────────────────────────────────────────────────────────
export default function Index({ setVista }) {
  // El Navbar se ha eliminado porque ya existe en App.jsx
  return (
    <div className="min-h-screen" style={{ fontFamily:'system-ui,sans-serif' }}>
      <Hero setVista={setVista} />
      <HistoricoSection setVista={setVista} />
      <NoticiasSection />
      <footer className="py-8 border-t text-center" style={{ background:'#09070f', borderColor:'rgba(139,92,246,0.12)' }}>
        <p className="text-gray-600 text-sm">© 2026 OMV - Observatorio de Mitigación Vial.</p>
      </footer>
    </div>
  );
}