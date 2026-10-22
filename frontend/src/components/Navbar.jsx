import React from 'react';
import { Link2, Bell, User, Settings, LogOut } from 'lucide-react';

const Navbar = ({ setVista, onLogout }) => {
  return (
    <header style={{
      background:'linear-gradient(135deg, rgba(15,15,42,0.95) 0%, rgba(88,28,135,0.6) 100%)',
      backdropFilter:'blur(16px)',
      WebkitBackdropFilter:'blur(16px)',
      borderBottom:'1px solid rgba(168,85,247,0.2)',
      position:'sticky',
      top:0,
      zIndex:9999,
      padding:'0 20px',
      height:'52px',
      display:'flex',
      alignItems:'center',
      gap:'16px',
      boxShadow:'0 2px 20px rgba(0,0,0,0.3), 0 0 30px rgba(168,85,247,0.1)'
    }}>

      <div style={{display:'flex',alignItems:'center',gap:'10px',marginRight:'8px',flexShrink:0}}>
        <div style={{
          width:'32px',
          height:'32px',
          borderRadius:'8px',
          background:'linear-gradient(135deg, #a855f7 0%, #7c3aed 100%)',
          display:'flex',
          alignItems:'center',
          justifyContent:'center',
          overflow:'hidden',
          boxShadow:'0 0 12px rgba(168,85,247,0.4)'
        }}>
          <img 
            src="/omv-logo.png" 
            alt="OMV Logo" 
            style={{width:'100%',height:'100%',objectFit:'cover'}}
          />
        </div>
        <span style={{color:'#fae8ff',fontSize:'14px',fontWeight:700,letterSpacing:'0.08em'}}>
          OMV
        </span>
      </div>

      <div style={{flex:1,maxWidth:'320px',position:'relative'}}>
        <input
          placeholder="Buscar dirección o zona..."
          style={{
            width:'100%',
            background:'linear-gradient(135deg, rgba(0,0,0,0.3) 0%, rgba(88,28,135,0.2) 100%)',
            border:'1px solid rgba(168,85,247,0.25)',
            borderRadius:'20px',
            padding:'6px 36px 6px 14px',
            color:'#f3e8ff',
            fontSize:'12px',
            outline:'none',
            fontFamily:'inherit',
            boxShadow:'0 0 12px rgba(168,85,247,0.1), inset 0 1px 0 rgba(255,255,255,0.05)'
          }}
        />
        <span style={{position:'absolute',right:'12px',top:'50%',transform:'translateY(-50%)',color:'#a78bfa',fontSize:'12px'}}>🔍</span>
      </div>

      <nav style={{display:'flex',gap:'2px',marginLeft:'8px'}}>
        {[
          {label:'Inicio y Noticias',vista:'index'},
          {label:'Mapa Crítico',vista:'mapa'},
          {label:'Rutas Seguras',vista:'rutas'},
          {label:'Tráfico IRL',vista:'trafico'},
        ].map(({label,vista}) => (
          <button
            key={vista}
            onClick={() => setVista(vista)}
            onMouseEnter={e => { e.currentTarget.style.background='rgba(168,85,247,0.15)'; e.currentTarget.style.color='#fae8ff'; }}
            onMouseLeave={e => { e.currentTarget.style.background='transparent'; e.currentTarget.style.color='#a78bfa'; }}
            style={{
              background:'transparent',
              border:'none',
              cursor:'pointer',
              color:'#a78bfa',
              fontSize:'12px',
              fontWeight:500,
              padding:'6px 12px',
              borderRadius:'8px',
              transition:'all 0.15s',
              fontFamily:'inherit'
            }}
          >
            {label}
          </button>
        ))}
      </nav>

      <div style={{marginLeft:'auto',display:'flex',alignItems:'center',gap:'4px'}}>
        <button
          onClick={onLogout}
          onMouseEnter={e => { e.currentTarget.style.background='rgba(244,63,94,0.2)'; e.currentTarget.style.color='#fda4af'; }}
          onMouseLeave={e => { e.currentTarget.style.background='transparent'; e.currentTarget.style.color='#f43f5e'; }}
          style={{
            background:'transparent',
            border:'none',
            cursor:'pointer',
            display:'flex',
            alignItems:'center',
            gap:'5px',
            color:'#f43f5e',
            fontSize:'11px',
            padding:'5px 8px',
            borderRadius:'8px',
            transition:'all 0.15s',
            fontFamily:'inherit'
          }}
        >
          <LogOut size={14} />
          <span>Cerrar sesión</span>
        </button>

        <a 
          href="https://www.medellin.gov.co/es/secretaria-de-movilidad/observatorio-de-movilidad/incidentes-y-victimas-por-hechos-de-transito/"
          target="_blank"
          rel="noreferrer"
          onMouseEnter={e => { e.currentTarget.style.background='rgba(245,158,11,0.25)'; e.currentTarget.style.borderColor='rgba(251,191,36,0.5)'; }}
          onMouseLeave={e => { e.currentTarget.style.background='rgba(245,158,11,0.15)'; e.currentTarget.style.borderColor='rgba(245,158,11,0.35)'; }}
          style={{
            marginLeft:'6px',
            background:'rgba(184, 127, 227, 0.33)',
            border:'1px solid rgba(175, 12, 250, 0.69)',
            color:'#ffffffd3',
            borderRadius:'8px',
            padding:'5px 12px',
            fontSize:'11px',
            fontWeight:600,
            display:'flex',
            alignItems:'center',
            gap:'5px',
            textDecoration:'none',
            transition:'all 0.15s'
          }}
        >
          <Link2 size={12} />
          Fuente Oficial
        </a>
      </div>
    </header>
  );
};

export default Navbar;