import { useState, useEffect, useRef } from 'react';
import { Send, Bot, User, AlertCircle, MapPin, TrendingUp, HelpCircle, Route } from 'lucide-react';
import axios from 'axios';

const API_URL = 'http://localhost:8000/api';

function AIAssistant({ address, prediction, zonasCriticas = [], noticias = [], onSearchAddress }) {
  const [chatHistory, setChatHistory] = useState([]);
  const [input, setInput] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const chatEndRef = useRef(null);

  // Geocodificación para toda Colombia (Nominatim + Photon)
  const geocodeAddress = async (direccion) => {
    try {
      let query = direccion.trim();
      // Si no incluye "Colombia", se añade para buscar en todo el país
      if (!query.toLowerCase().includes('colombia')) {
        query = `${query}, Colombia`;
      }
      // Intentar con Nominatim
      const nomUrl = `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(query)}&format=json&limit=1&countrycodes=co`;
      const nomRes = await fetch(nomUrl, { headers: { 'User-Agent': 'MovAI-App/1.0' } });
      const nomData = await nomRes.json();
      if (nomData?.length) {
        return { lat: parseFloat(nomData[0].lat), lng: parseFloat(nomData[0].lon) };
      }
      // Fallback con Photon
      const photonUrl = `https://photon.komoot.io/api/?q=${encodeURIComponent(direccion)}&limit=1&lang=es`;
      const phRes = await fetch(photonUrl);
      const phData = await phRes.json();
      if (phData?.features?.length) {
        const [lng, lat] = phData.features[0].geometry.coordinates;
        return { lat, lng };
      }
      return null;
    } catch (error) {
      console.error("Geocoding error:", error);
      return null;
    }
  };

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [chatHistory]);

  useEffect(() => {
    if (chatHistory.length === 0) {
      setChatHistory([{
        role: 'assistant',
        content: '¡Hola! Soy MovAI, tu asistente de movilidad inteligente. Puedo ayudarte con:\n\n• 🗺️ **Predicción de congestión** (haz clic en el mapa)\n• 🚗 **Rutas alternativas** (dime tu ubicación o selecciona un punto)\n• ⚠️ **Zonas críticas** de accidentalidad\n• 📰 **Noticias de incidentes** recientes\n• 📊 **Comparar riesgo** entre sectores\n• 🕒 **Mejores horarios** para conducir\n• 💰 **Fotomultas y costos**\n\n¿Qué necesitas?'
      }]);
    }
  }, []);

  // Respuesta automática al recibir predicción (clic o búsqueda)
  useEffect(() => {
    if (prediction && address && !chatHistory.some(msg => msg.address === address)) {
      const emoji = prediction.probabilidad > 0.7 ? '🔴' : prediction.probabilidad > 0.4 ? '🟡' : '🟢';
      const riesgoTexto = prediction.zona_critica ? `\n⚠️ **Zona crítica:** ${prediction.zona_critica} (Nivel ${prediction.nivel_riesgo})` : '';
      const systemMsg = {
        role: 'system',
        address,
        content: `📍 **${address}**\n\n${emoji} **Estado actual:** ${prediction.estado}\n📊 **Probabilidad de empeorar en las próximas ${prediction.ventana}:** ${(prediction.probabilidad*100).toFixed(1)}%\n🔑 **Factores contribuyentes:** ${prediction.factores}${riesgoTexto}`
      };
      setChatHistory(prev => [...prev, systemMsg]);
      setIsTyping(true);
      setTimeout(() => {
        let advice = '';
        if (prediction.probabilidad > 0.7) {
          advice = `⚠️ **Alerta de congestión crítica** (${(prediction.probabilidad*100).toFixed(0)}% de empeorar en ${prediction.ventana}). Recomiendo evitar esta zona o buscar rutas alternativas. ¿Necesitas sugerencias?`;
        } else if (prediction.probabilidad > 0.4) {
          advice = `🚗 **Precaución moderada** - Se espera tráfico irregular en las próximas ${prediction.ventana}. ¿Quieres conocer los horarios de menor congestión o rutas alternativas?`;
        } else {
          advice = `✅ **Vía fluida** - No hay riesgos de congestión por ahora. Si quieres, puedo informarte sobre zonas críticas cercanas.`;
        }
        if (prediction.zona_critica) advice += `\n🔴 **Atención:** ${prediction.zona_critica} es una zona de alto riesgo. Extreme precauciones.`;
        setChatHistory(prev => [...prev, { role: 'assistant', content: advice }]);
        setIsTyping(false);
      }, 1000);
    }
  }, [prediction, address]);

  const generarRespuesta = async (mensaje) => {
    const lower = mensaje.toLowerCase();
    // Detectar dirección (para toda Colombia)
    const locationKeywords = ['muéstrame','ve a','busca','muestra','ubica','dirección','calle','carrera','av','avenida','autopista','transversal','diagonal','circular','kr','cra','cll','barrio','urbanización','conjunto','residencial','vereda','parque','estación','terminal','corregimiento'];
    const match = mensaje.match(new RegExp(`^(${locationKeywords.join('|')})\\s+(.+)`, 'i'));
    if (match) {
      let direccion = match[2].replace(/^(en|de|la|el|los|las|del|al)\s+/i, '').replace(/\.$/, '');
      if (direccion.length > 2) {
        const coords = await geocodeAddress(direccion);
        if (coords && onSearchAddress) {
          onSearchAddress(direccion, coords);
          return `📍 **Mostrando "${direccion}" en el mapa.** He centrado la vista y estoy analizando el tráfico en ese punto. En un momento te diré el estado de congestión.`;
        }
        return `❌ No encontré "${direccion}" en Colombia. Intenta con más detalles (ciudad, barrio o calle principal).`;
      }
    }
    // Rutas alternativas
    if (lower.match(/ruta alternativa|alternativa|evitar tráfico|mejor ruta/)) {
      if (prediction && address) {
        return `🔄 **Rutas alternativas desde ${address.substring(0,35)}...**\n• Av. Regional (+8 min, 35% congestión)\n• Calle 30 (+12 min, 28% congestión)\n• Av. Las Palmas (+15 min, 45% congestión)\n💡 La mejor opción es Av. Regional. ¿Quieres más detalles?`;
      }
      return "🗺️ Para sugerirte rutas alternativas, primero haz clic en el mapa en la ubicación que te interesa.";
    }
    // Estado del tráfico
    if (lower.match(/cómo está el tráfico|estado|congestión|tráfico ahora/)) {
      if (prediction) {
        return `📊 **Informe de tráfico en ${address.substring(0,40)}**\n${prediction.estado}\n📈 Probabilidad de empeorar en ${prediction.ventana}: ${(prediction.probabilidad*100).toFixed(0)}%\n🌦️ Factores: ${prediction.factores}\n${prediction.zona_critica ? `⚠️ Además, es una zona crítica.` : ''}`;
      }
      return "🔍 Haz clic en el mapa para obtener el estado del tráfico en tiempo real.";
    }
    // Zonas críticas
    if (lower.match(/zona crítica|puntos críticos|riesgo alto|accidentalidad/)) {
      let zonaEspecifica = null;
      for (let zona of zonasCriticas) {
        if (lower.includes(zona.nombre?.toLowerCase()) || (zona.sector_geografico && lower.includes(zona.sector_geografico.toLowerCase().split(' ')[0]))) {
          zonaEspecifica = zona;
          break;
        }
      }
      if (zonaEspecifica) {
        return `⚠️ **${zonaEspecifica.nombre || zonaEspecifica.sector_geografico}**\n\n• Nivel de riesgo: ${zonaEspecifica.nivel_riesgo}\n• Accidentes últimos 12 meses: ${zonaEspecifica.total_accidentes}\n• Lesionados: ${zonaEspecifica.total_lesionados}\n• Fatalidades: ${zonaEspecifica.total_fatalidades}\n\n🚨 Recomendación: Evita esta zona entre 6:00-8:00 AM y 5:00-7:00 PM. ¿Quieres rutas alternativas para sortearla?`;
      } else {
        const lista = zonasCriticas.map(z => `• ${z.nombre || z.sector_geografico} (riesgo ${z.nivel_riesgo} - ${z.total_accidentes} accidentes)`).join('\n');
        return `🚨 **Zonas críticas identificadas en Medellín:**\n${lista}\n\n¿Necesitas información detallada de alguna o rutas para evitarlas?`;
      }
    }
    // Noticias
    if (lower.match(/noticias|incidente|accidente|choque|siniestro/)) {
      const notis = noticias.slice(0, 3);
      return `📰 **Noticias recientes de siniestros viales:**\n${notis.map(n => `• ${n.titulo} (${n.tipo_alerta_display})`).join('\n')}`;
    }
    // Horarios
    if (lower.match(/mejor hora|menos tráfico|horario/)) {
      return "🕒 **Recomendaciones horarias:**\n• Menos tráfico: 10:00-11:30 AM y 2:00-4:00 PM.\n• Evitar horas punta: 7:00-9:00 AM y 5:00-7:00 PM.\n• Fines de semana: tráfico reducido en un 35%.";
    }
    // Fotomultas
    if (lower.match(/fotomulta|multa|infracción|comparendo/)) {
      return "📸 **Infracciones comunes y sus costos en Medellín:**\n• Exceso de velocidad: hasta $1.300.000 COP\n• Pasarse el semáforo en rojo: $1.300.000 COP\n• Violación de pico y placa: $650.000 COP\n• SOAT vencido: $1.300.000 COP";
    }
    // Ayuda
    if (lower.match(/hola|ayuda|qué puedes hacer|comandos/)) {
      return "🤖 **Comandos disponibles:**\n• 'estado del tráfico' (después de hacer clic en el mapa)\n• 'rutas alternativas'\n• 'zonas críticas'\n• 'noticias'\n• 'muéstrame [dirección]' (ej: 'barrio Laureles', 'calle 10 en Bogotá', 'Parque de los Deseos')\n• 'horarios recomendados'\n• 'fotomultas'";
    }
    return "No entendí tu pregunta. Puedes probar con: 'estado del tráfico', 'zonas críticas', 'rutas alternativas', 'noticias' o 'muéstrame la calle 10 en Bogotá'.";
  };

  const handleSend = async () => {
    if (!input.trim()) return;
    const userMsg = { role: 'user', content: input };
    setChatHistory(prev => [...prev, userMsg]);
    setInput('');
    setIsTyping(true);
    setTimeout(async () => {
      const respuesta = await generarRespuesta(input);
      setChatHistory(prev => [...prev, { role: 'assistant', content: respuesta }]);
      setIsTyping(false);
    }, 600);
  };

  return (
  <div style={{display:'flex',flexDirection:'column',height:'100%',background:'#0a0a1a'}}>

    {/* Header con degradado - NUEVO ESTILO */}
    <div style={{
      padding:'14px 16px',
      background:'linear-gradient(135deg, rgba(88,28,135,0.6) 0%, rgba(15,15,42,0.9) 100%)',
      borderBottom:'1px solid rgba(168,85,247,0.2)',
      display:'flex',
      alignItems:'center',
      gap:'10px',
      flexShrink:0
    }}>
      <div style={{
        width:'36px',
        height:'36px',
        borderRadius:'10px',
        background:'linear-gradient(135deg, #a855f7 0%, #7c3aed 100%)',
        display:'flex',
        alignItems:'center',
        justifyContent:'center',
        boxShadow:'0 0 12px rgba(168,85,247,0.4)'
      }}>
        <Bot size={20} color="#fff" />
      </div>
      <div>
        <div style={{color:'#fae8ff',fontSize:'14px',fontWeight:'600'}}>Asistente IA</div>
        <div style={{color:'#a78bfa',fontSize:'9px',letterSpacing:'0.08em',textTransform:'uppercase'}}>Análisis en tiempo real</div>
      </div>
      <div style={{marginLeft:'auto',display:'flex',alignItems:'center',gap:'6px'}}>
        <span style={{width:'6px',height:'6px',borderRadius:'50%',background:'#22d3ee',boxShadow:'0 0 6px #22d3ee'}} />
        <span style={{color:'#22d3ee',fontSize:'9px',letterSpacing:'0.05em'}}>EN LÍNEA</span>
      </div>
    </div>

    {/* Chat area - fondo con degradado sutil */}
    <div
      style={{flex:1,overflowY:'auto',padding:'12px',display:'flex',flexDirection:'column',gap:'10px',background:'linear-gradient(180deg, rgba(15,15,42,0.3) 0%, rgba(88,28,135,0.15) 50%, rgba(15,15,42,0.3) 100%)'}}
      className="omv-scroll"
    >
      {chatHistory.map((msg, idx) => (
        <div key={idx} style={{display:'flex',justifyContent:msg.role==='user'?'flex-end':'flex-start',gap:'8px',alignItems:'flex-end'}}>
          
          {msg.role !== 'user' && (
            <div style={{width:'24px',height:'24px',borderRadius:'50%',flexShrink:0,background:'linear-gradient(135deg, rgba(168,85,247,0.3) 0%, rgba(192,38,211,0.2) 100%)',border:'1px solid rgba(168,85,247,0.4)',display:'flex',alignItems:'center',justifyContent:'center',fontSize:'10px',boxShadow:'0 0 8px rgba(168,85,247,0.2)'}}>🤖</div>
          )}

          <div style={{
            maxWidth:'80%', padding:'10px 14px', fontSize:'12px',
            lineHeight:1.6, whiteSpace:'pre-wrap', wordBreak:'break-word',
            ...(msg.role==='user'
              ? {background:'linear-gradient(135deg, rgba(168,85,247,0.25) 0%, rgba(192,38,211,0.2) 100%)',color:'#fae8ff',borderRadius:'16px 16px 4px 16px',border:'1px solid rgba(168,85,247,0.3)',boxShadow:'0 2px 8px rgba(168,85,247,0.15)'}
              : msg.role==='system'
              ? {background:'linear-gradient(135deg, rgba(245,158,11,0.12) 0%, rgba(251,191,36,0.08) 100%)',color:'#fcd34d',borderLeft:'3px solid #fbbf24',borderRadius:'0 12px 12px 0',padding:'10px 14px',border:'1px solid rgba(251,191,36,0.2)'}
              : {background:'linear-gradient(135deg, rgba(139,92,246,0.12) 0%, rgba(168,85,247,0.08) 100%)',color:'#e9d5ff',borderRadius:'16px 16px 16px 4px',border:'1px solid rgba(139,92,246,0.2)',boxShadow:'0 2px 8px rgba(139,92,246,0.1)'}
            ),
          }}>
            {msg.content}
          </div>

          {msg.role==='user' && (
            <div style={{width:'24px',height:'24px',borderRadius:'50%',flexShrink:0,background:'linear-gradient(135deg, rgba(168,85,247,0.4) 0%, rgba(139,92,246,0.3) 100%)',border:'1px solid rgba(168,85,247,0.4)',display:'flex',alignItems:'center',justifyContent:'center',fontSize:'10px',color:'#fff',boxShadow:'0 0 8px rgba(168,85,247,0.2)'}}>👤</div>
          )}
        </div>
      ))}

      {isTyping && (
        <div style={{display:'flex',gap:'8px',alignItems:'flex-end'}}>
          <div style={{width:'24px',height:'24px',borderRadius:'50%',background:'linear-gradient(135deg, rgba(168,85,247,0.3) 0%, rgba(192,38,211,0.2) 100%)',border:'1px solid rgba(168,85,247,0.4)',display:'flex',alignItems:'center',justifyContent:'center',fontSize:'10px',boxShadow:'0 0 8px rgba(168,85,247,0.2)'}}>🤖</div>
          <div style={{background:'linear-gradient(135deg, rgba(139,92,246,0.12) 0%, rgba(168,85,247,0.08) 100%)',border:'1px solid rgba(139,92,246,0.2)',borderRadius:'16px 16px 16px 4px',padding:'10px 14px',display:'flex',gap:'5px',alignItems:'center',boxShadow:'0 2px 8px rgba(139,92,246,0.1)'}}>
            {[0,1,2].map(i => (
              <span key={i} style={{width:'6px',height:'6px',borderRadius:'50%',background:'linear-gradient(135deg, #a78bfa 0%, #c084fc 100%)',display:'inline-block',animation:'omvBounce 1.2s infinite',animationDelay:`${i*0.15}s`,boxShadow:'0 0 4px rgba(167,139,250,0.5)'}} />
            ))}
          </div>
        </div>
      )}
      <div ref={chatEndRef} />
    </div>

    {/* Input - con degradado y borde morado */}
    <div style={{padding:'12px 14px',flexShrink:0,borderTop:'1px solid rgba(168,85,247,0.2)',background:'linear-gradient(180deg, rgba(15,15,42,0.6) 0%, rgba(88,28,135,0.3) 100%)',backdropFilter:'blur(12px)'}}>
      <div style={{display:'flex',gap:'8px',alignItems:'center',background:'linear-gradient(135deg, rgba(0,0,0,0.4) 0%, rgba(88,28,135,0.2) 100%)',border:'1px solid rgba(168,85,247,0.25)',borderRadius:'24px',padding:'6px 6px 6px 16px',boxShadow:'0 0 16px rgba(168,85,247,0.1), inset 0 1px 0 rgba(255,255,255,0.05)'}}>
        <input
          type="text" value={input}
          onChange={e => setInput(e.target.value)}
          onKeyPress={e => e.key==='Enter' && handleSend()}
          placeholder="¿Dónde hay más accidentes...?"
          style={{flex:1,background:'transparent',border:'none',outline:'none',color:'#f3e8ff',fontSize:'12px',fontFamily:'inherit'}}
        />
        <button onClick={handleSend} disabled={!input.trim()}
          style={{width:'32px',height:'32px',borderRadius:'50%',border:'none',cursor:'pointer',flexShrink:0,display:'flex',alignItems:'center',justifyContent:'center',transition:'all 0.2s',background:input.trim()?'linear-gradient(135deg, #a855f7 0%, #7c3aed 100%)':'rgba(139,92,246,0.15)',boxShadow:input.trim()?'0 0 12px rgba(168,85,247,0.4)':'none'}}>
          <Send size={14} color={input.trim()?'#fff':'#6b7280'} />
        </button>
      </div>

      <div style={{display:'flex',justifyContent:'space-between',marginTop:'8px',padding:'0 4px'}}>
        {[{Icon:TrendingUp,label:'Predicción'},{Icon:AlertCircle,label:'Alertas'},{Icon:Route,label:'Rutas'},{Icon:HelpCircle,label:'Ayuda'}].map(({Icon,label}) => (
          <button key={label}
            style={{background:'transparent',border:'none',cursor:'pointer',display:'flex',alignItems:'center',gap:'4px',color:'#7c3aed',fontSize:'10px',fontFamily:'inherit',padding:'4px 6px',borderRadius:'6px',transition:'all 0.15s'}}
            onMouseEnter={e => { e.currentTarget.style.color='#a855f7'; e.currentTarget.style.background='rgba(168,85,247,0.1)' }}
            onMouseLeave={e => { e.currentTarget.style.color='#7c3aed'; e.currentTarget.style.background='transparent' }}
          >
            <Icon size={12} />{label}
          </button>
        ))}
      </div>
    </div>

    <style>{`
      .omv-scroll::-webkit-scrollbar{width:4px}
      .omv-scroll::-webkit-scrollbar-track{background:transparent}
      .omv-scroll::-webkit-scrollbar-thumb{background:linear-gradient(180deg, rgba(168,85,247,0.3) 0%, rgba(192,38,211,0.3) 100%);border-radius:4px}
      @keyframes omvBounce{0%,60%,100%{transform:translateY(0)}30%{transform:translateY(-5px)}}
    `}</style>
  </div>
);
}

export default AIAssistant;