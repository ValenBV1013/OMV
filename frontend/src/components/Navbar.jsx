import React from 'react';
import { Link2, Bell, User, Settings } from 'lucide-react';

const Navbar = ({ setVista }) => {
  return (
    <header style={{background:'rgba(6,8,16,0.92)',backdropFilter:'blur(16px)',WebkitBackdropFilter:'blur(16px)',borderBottom:'0.5px solid rgba(255,255,255,0.08)',position:'sticky',top:0,zIndex:9999,padding:'0 20px',height:'52px',display:'flex',alignItems:'center',gap:'16px'}}>

      <div style={{display:'flex',alignItems:'center',gap:'8px',marginRight:'8px',flexShrink:0}}>
        <div style={{width:'28px',height:'28px',borderRadius:'6px',background:'linear-gradient(135deg,#3b82f6,#1d4ed8)',display:'flex',alignItems:'center',justifyContent:'center',fontSize:'13px'}}>🛡️</div>
        <span style={{color:'#e2e8f0',fontSize:'13px',fontWeight:700,letterSpacing:'0.06em'}}>
          CITYSAFE <span style={{color:'#3b82f6'}}>NEXT</span>
        </span>
      </div>

      <div style={{flex:1,maxWidth:'320px',position:'relative'}}>
        <input
          placeholder="Buscar dirección o zona..."
          style={{width:'100%',background:'rgba(255,255,255,0.06)',border:'0.5px solid rgba(255,255,255,0.12)',borderRadius:'20px',padding:'6px 36px 6px 14px',color:'#e2e8f0',fontSize:'12px',outline:'none',fontFamily:'inherit'}}
        />
        <span style={{position:'absolute',right:'12px',top:'50%',transform:'translateY(-50%)',color:'#475569',fontSize:'12px'}}>🔍</span>
      </div>

      <nav style={{display:'flex',gap:'2px',marginLeft:'8px'}}>
        {[
          {label:'Mapa Crítico',vista:'mapa'},
          {label:'Histórico & Noticias',vista:'estadisticas'},
          {label:'Rutas Seguras',vista:'rutas'},
          {label:'Tráfico IRL',vista:'trafico'},
        ].map(({label,vista}) => (
          <button
            key={vista}
            onClick={() => setVista(vista)}
            onMouseEnter={e => { e.currentTarget.style.background='rgba(255,255,255,0.06)'; e.currentTarget.style.color='#e2e8f0'; }}
            onMouseLeave={e => { e.currentTarget.style.background='transparent'; e.currentTarget.style.color='#94a3b8'; }}
            style={{background:'transparent',border:'none',cursor:'pointer',color:'#94a3b8',fontSize:'12px',fontWeight:500,padding:'6px 12px',borderRadius:'8px',transition:'all 0.15s',fontFamily:'inherit'}}
          >
            {label}
          </button>
        ))}
      </nav>

      <div style={{marginLeft:'auto',display:'flex',alignItems:'center',gap:'4px'}}>
        {[
          {Icon:Bell,label:'Alertas'},
          {Icon:User,label:'Perfil'},
          {Icon:Settings,label:'Ajustes'},
        ].map(({Icon,label}) => (
          <button
            key={label}
            onMouseEnter={e => { e.currentTarget.style.background='rgba(255,255,255,0.06)'; e.currentTarget.style.color='#e2e8f0'; }}
            onMouseLeave={e => { e.currentTarget.style.background='transparent'; e.currentTarget.style.color='#64748b'; }}
            style={{background:'transparent',border:'none',cursor:'pointer',display:'flex',alignItems:'center',gap:'5px',color:'#64748b',fontSize:'11px',padding:'5px 8px',borderRadius:'8px',transition:'all 0.15s',fontFamily:'inherit'}}
          >
            <Icon size={14} />
            <span>{label}</span>
          </button>
        ))}

        {/* AQUÍ ESTÁ EL CAMBIO: Volví a poner la etiqueta <a de apertura */}
        <a 
          href="https://www.medellin.gov.co/es/secretaria-de-movilidad/observatorio-de-movilidad/incidentes-y-victimas-por-hechos-de-transito/"
          target="_blank"
          rel="noreferrer"
          onMouseEnter={e => { e.currentTarget.style.background='rgba(245,158,11,0.25)'; }}
          onMouseLeave={e => { e.currentTarget.style.background='rgba(245,158,11,0.15)'; }}
          style={{marginLeft:'6px',background:'rgba(245,158,11,0.15)',border:'0.5px solid rgba(245,158,11,0.35)',color:'#fbbf24',borderRadius:'8px',padding:'5px 12px',fontSize:'11px',fontWeight:600,display:'flex',alignItems:'center',gap:'5px',textDecoration:'none'}}
        >
          <Link2 size={12} />
          Fuente Oficial
        </a>

      </div>
    </header>
  );
};

export default Navbar;