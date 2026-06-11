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
  <div style={{display:'flex',flexDirection:'column',height:'100%',background:'transparent'}}>

    {/* Chat area */}
    <div
      style={{flex:1,overflowY:'auto',padding:'10px',display:'flex',flexDirection:'column',gap:'8px'}}
      className="omv-scroll"
    >
      {chatHistory.map((msg, idx) => (
        <div key={idx} style={{display:'flex',justifyContent:msg.role==='user'?'flex-end':'flex-start',gap:'6px',alignItems:'flex-end'}}>
          
          {msg.role !== 'user' && (
            <div style={{width:'22px',height:'22px',borderRadius:'50%',flexShrink:0,background:'rgba(99,102,241,0.25)',border:'1px solid rgba(99,102,241,0.4)',display:'flex',alignItems:'center',justifyContent:'center',fontSize:'10px'}}>🤖</div>
          )}

          <div style={{
            maxWidth:'83%', padding:'7px 10px', fontSize:'11px',
            lineHeight:1.6, whiteSpace:'pre-wrap', wordBreak:'break-word',
            ...(msg.role==='user'
              ? {background:'rgba(79,70,229,0.45)',color:'#e0e7ff',borderRadius:'12px 12px 2px 12px',border:'0.5px solid rgba(99,102,241,0.35)'}
              : msg.role==='system'
              ? {background:'rgba(245,158,11,0.08)',color:'#fcd34d',borderLeft:'2px solid #f59e0b',borderRadius:'0 8px 8px 0',padding:'6px 10px'}
              : {background:'rgba(255,255,255,0.07)',color:'#cbd5e1',borderRadius:'12px 12px 12px 2px',border:'0.5px solid rgba(255,255,255,0.08)'}
            ),
          }}>
            {msg.content}
          </div>

          {msg.role==='user' && (
            <div style={{width:'22px',height:'22px',borderRadius:'50%',flexShrink:0,background:'rgba(79,70,229,0.5)',border:'1px solid rgba(99,102,241,0.4)',display:'flex',alignItems:'center',justifyContent:'center',fontSize:'10px',color:'#fff'}}>👤</div>
          )}
        </div>
      ))}

      {isTyping && (
        <div style={{display:'flex',gap:'6px',alignItems:'flex-end'}}>
          <div style={{width:'22px',height:'22px',borderRadius:'50%',background:'rgba(99,102,241,0.25)',border:'1px solid rgba(99,102,241,0.4)',display:'flex',alignItems:'center',justifyContent:'center',fontSize:'10px'}}>🤖</div>
          <div style={{background:'rgba(255,255,255,0.07)',border:'0.5px solid rgba(255,255,255,0.08)',borderRadius:'12px 12px 12px 2px',padding:'8px 12px',display:'flex',gap:'4px',alignItems:'center'}}>
            {[0,1,2].map(i => (
              <span key={i} style={{width:'5px',height:'5px',borderRadius:'50%',background:'#475569',display:'inline-block',animation:'omvBounce 1.2s infinite',animationDelay:`${i*0.15}s`}} />
            ))}
          </div>
        </div>
      )}
      <div ref={chatEndRef} />
    </div>

    {/* Input */}
    <div style={{padding:'8px 10px',flexShrink:0,borderTop:'0.5px solid rgba(255,255,255,0.07)',background:'rgba(0,0,0,0.25)'}}>
      <div style={{display:'flex',gap:'6px',alignItems:'center',background:'rgba(255,255,255,0.06)',border:'0.5px solid rgba(255,255,255,0.1)',borderRadius:'20px',padding:'4px 4px 4px 12px'}}>
        <input
          type="text" value={input}
          onChange={e => setInput(e.target.value)}
          onKeyPress={e => e.key==='Enter' && handleSend()}
          placeholder="¿Dónde hay más accidentes...?"
          style={{flex:1,background:'transparent',border:'none',outline:'none',color:'#e2e8f0',fontSize:'11px',fontFamily:'inherit'}}
        />
        <button onClick={handleSend} disabled={!input.trim()}
          style={{width:'26px',height:'26px',borderRadius:'50%',border:'none',cursor:'pointer',flexShrink:0,display:'flex',alignItems:'center',justifyContent:'center',transition:'background 0.15s',background:input.trim()?'#4f46e5':'rgba(255,255,255,0.05)'}}>
          <Send size={11} color={input.trim()?'#fff':'#475569'} />
        </button>
      </div>

      <div style={{display:'flex',justifyContent:'space-between',marginTop:'6px',padding:'0 2px'}}>
        {[{Icon:TrendingUp,label:'Predicción'},{Icon:AlertCircle,label:'Alertas'},{Icon:Route,label:'Rutas'},{Icon:HelpCircle,label:'Ayuda'}].map(({Icon,label}) => (
          <button key={label}
            style={{background:'transparent',border:'none',cursor:'pointer',display:'flex',alignItems:'center',gap:'3px',color:'#334155',fontSize:'10px',fontFamily:'inherit',padding:'2px 4px',borderRadius:'4px'}}
            onMouseEnter={e => { e.currentTarget.style.color='#64748b'; }}
            onMouseLeave={e => { e.currentTarget.style.color='#334155'; }}
          >
            <Icon size={10} />{label}
          </button>
        ))}
      </div>
    </div>

    <style>{`
      .omv-scroll::-webkit-scrollbar{width:3px}
      .omv-scroll::-webkit-scrollbar-track{background:transparent}
      .omv-scroll::-webkit-scrollbar-thumb{background:rgba(255,255,255,0.08);border-radius:3px}
      @keyframes omvBounce{0%,60%,100%{transform:translateY(0)}30%{transform:translateY(-5px)}}
    `}</style>
  </div>
);
}

export default AIAssistant;