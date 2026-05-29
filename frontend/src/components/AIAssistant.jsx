import { useState, useEffect, useRef } from 'react';
import { Send, Bot, User, AlertCircle, MapPin, TrendingUp, HelpCircle, Route } from 'lucide-react';

function AIAssistant({ address, prediction, zonasCriticas = [], noticias = [], onSearchAddress }) {
  const [chatHistory, setChatHistory] = useState([]);
  const [input, setInput] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const chatEndRef = useRef(null);

  // Geocodificación mejorada con Nominatim (OpenStreetMap)
  const geocodeAddress = async (direccion) => {
    try {
      // Lista de ciudades colombianas para detectar si ya incluye ciudad
      const ciudades = [
        "bogotá", "medellín", "cali", "barranquilla", "cartagena", "bucaramanga",
        "pereira", "manizales", "cúcuta", "ibagué", "neiva", "pasto", "valledupar",
        "montería", "sincelejo", "riohacha", "santa marta", "villavicencio", "tunja", "armenia"
      ];
      const tieneCiudad = ciudades.some(ciudad => direccion.toLowerCase().includes(ciudad));
      
      let query = direccion;
      if (!tieneCiudad) {
        // Si no menciona ciudad, buscar primero en Medellín
        query = `${direccion}, Medellín, Colombia`;
      }
      
      const response = await fetch(
        `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(query)}&format=json&limit=1&countrycodes=co`
      );
      const data = await response.json();
      if (data && data.length > 0) {
        return { lat: parseFloat(data[0].lat), lng: parseFloat(data[0].lon) };
      }
      
      // Si no se encontró con Medellín y no tenía ciudad, intentar solo Colombia
      if (!tieneCiudad) {
        const fallbackResponse = await fetch(
          `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(direccion + ", Colombia")}&format=json&limit=1&countrycodes=co`
        );
        const fallbackData = await fallbackResponse.json();
        if (fallbackData && fallbackData.length > 0) {
          return { lat: parseFloat(fallbackData[0].lat), lng: parseFloat(fallbackData[0].lon) };
        }
      }
      return null;
    } catch (error) {
      console.error("Error geocodificando:", error);
      return null;
    }
  };

  // Nombres de vías en Medellín para simular rutas alternativas
  const viasAlternativas = [
    "Av. Regional", "Calle 30", "Av. Las Palmas", "Av. El Poblado",
    "Carrera 43A", "Autopista Sur", "Calle 10", "Av. 80",
    "Calle 44 (San Juan)", "Av. Oriental", "Carrera 50", "Transversal Inferior"
  ];

  const generarRutasAlternativas = (lat, lng, congestionProb) => {
    const numRutas = Math.floor(Math.random() * 2) + 2;
    const shuffled = [...viasAlternativas].sort(() => 0.5 - Math.random());
    const rutas = shuffled.slice(0, numRutas);
    const tiempoExtra = Math.floor(Math.random() * 15) + 5;
    const nuevaProb = Math.max(0.1, congestionProb - 0.3 - Math.random() * 0.2);
    return {
      rutas,
      tiempoExtra,
      nuevaProbabilidad: Math.round(nuevaProb * 100)
    };
  };

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [chatHistory]);

  useEffect(() => {
    if (chatHistory.length === 0) {
      setChatHistory([
        {
          role: 'assistant',
          content: '¡Hola! Soy MovAI, tu asistente de movilidad inteligente. Puedo ayudarte con:\n\n• 🗺️ **Predicción de congestión** (haz clic en el mapa)\n• 🚗 **Rutas alternativas** (dime tu ubicación o selecciona un punto)\n• ⚠️ **Zonas críticas** de accidentalidad\n• 📰 **Noticias de incidentes** recientes\n• 📊 **Comparar riesgo** entre sectores\n• 🕒 **Mejores horarios** para conducir\n• 💰 **Fotomultas y costos**\n\n¿Qué necesitas?'
        }
      ]);
    }
  }, []);

  // Procesar respuesta automática tras clic en mapa
  useEffect(() => {
    if (prediction && address && !chatHistory.some(msg => msg.address === address)) {
      const getStatusEmoji = () => {
        if (prediction.probabilidad > 0.7) return '🔴';
        if (prediction.probabilidad > 0.4) return '🟡';
        return '🟢';
      };

      const systemMsg = {
        role: 'system',
        address: address,
        content: `📍 **Ubicación:** ${address}\n\n${getStatusEmoji()} **Estado:** ${prediction.estado}\n📊 **Probabilidad:** ${(prediction.probabilidad * 100).toFixed(1)}%\n⏱️ **Ventana:** ${prediction.ventana}\n🔑 **Factores:** ${prediction.factores}\n💡 **Recomendación:** ${prediction.recomendacion}${prediction.zona_critica ? `\n\n⚠️ **Zona crítica:** ${prediction.zona_critica} (Nivel ${prediction.nivel_riesgo})` : ''}`
      };
      
      setChatHistory(prev => [...prev, systemMsg]);
      
      setIsTyping(true);
      setTimeout(() => {
        let advice = "";
        if (prediction.probabilidad > 0.7) {
          advice = `⚠️ **Alerta de congestión crítica**\n\nLa probabilidad de empeorar es del ${(prediction.probabilidad * 100).toFixed(0)}% en las próximas ${prediction.ventana}. ¿Quieres que calcule una ruta alternativa para evitar ese sector?`;
        } else if (prediction.probabilidad > 0.4) {
          advice = `🚗 **Precaución moderada**\n\nSe espera tráfico irregular. Recomiendo monitorear cada 15 minutos. ¿Necesitas rutas alternativas o quieres conocer los horarios de menor congestión?`;
        } else {
          advice = `✅ **Vía fluida**\n\nNo hay riesgos de congestión por ahora. ¿Deseas guardar este trayecto como favorito o conocer zonas críticas cercanas?`;
        }
        
        if (prediction.zona_critica) {
          advice += `\n\n🔴 **Nota:** Esta es una zona crítica de accidentalidad. Ten precaución extrema.`;
        }
        setChatHistory(prev => [...prev, { role: 'assistant', content: advice }]);
        setIsTyping(false);
      }, 1000);
    }
  }, [prediction, address]);

  const extraerCoordenadas = (dir) => {
    const match = dir.match(/(-?\d+\.\d+),\s*(-?\d+\.\d+)/);
    if (match) {
      return { lat: parseFloat(match[1]), lng: parseFloat(match[2]) };
    }
    return null;
  };

  const generarRespuesta = async (mensaje) => {
    const lowerMsg = mensaje.toLowerCase();
    
    // ========== NUEVO: BÚSQUEDA DE DIRECCIONES (calles, avenidas, carreras, etc.) ==========
    // Patrón mejorado para capturar direcciones: calles, carreras, avenidas, números, etc.
    const locationPattern = /^(muéstrame|ve a|busca|ir a|muestra|ubica|dirección|calle|carrera|av|avenida|autopista|transversal|diagonal|circular|kr|cra|cll)\s+(.+)/i;
    if (locationPattern.test(lowerMsg)) {
      const match = lowerMsg.match(locationPattern);
      let direccion = match[2];
      // Limpiar la dirección: eliminar palabras sobrantes como "en", "de", "la", "el", "los", "las"
      direccion = direccion.replace(/^(en|de|la|el|los|las)\s+/i, '');
      // Eliminar punto final si existe
      direccion = direccion.replace(/\.$/, '');
      
      if (direccion && direccion.length > 3) {
        const coords = await geocodeAddress(direccion);
        if (coords && onSearchAddress) {
          onSearchAddress(direccion, coords);
          return `📍 **Mostrando "${direccion}" en el mapa.** He centrado la vista en esa ubicación. ¿Quieres que analice el tráfico allí?`;
        } else {
          return `❌ No pude encontrar "${direccion}" en Colombia. ¿Puedes ser más específico? Incluye ciudad si es fuera de Medellín, o intenta con un nombre más preciso.`;
        }
      }
    }

    // ========== RUTAS ALTERNATIVAS ==========
    if (lowerMsg.match(/ruta alternativa|alternativa|evitar tráfico|cómo llegar|mejor ruta|desviar|otra vía/)) {
      if (prediction && address) {
        const coords = extraerCoordenadas(address);
        const { rutas, tiempoExtra, nuevaProbabilidad } = generarRutasAlternativas(
          coords?.lat || 6.2476, 
          coords?.lng || -75.5658,
          prediction.probabilidad
        );
        
        let respuesta = `🔄 **Rutas alternativas para evitar la congestión**\n\n`;
        respuesta += `📍 Desde ${address.substring(0, 35)}...\n\n`;
        respuesta += `🚗 **Opciones sugeridas:**\n`;
        rutas.forEach((r, idx) => {
          respuesta += `${idx+1}. ${r} (desvío +${tiempoExtra - idx*2} min, congestión ${nuevaProbabilidad + idx*5}%)\n`;
        });
        respuesta += `\n⏱️ **Ahorro estimado:** ${tiempoExtra} minutos comparado con la ruta actual.\n`;
        respuesta += `💡 **Consejo:** La mejor opción es la ruta ${rutas[0]}. ¿Quieres más detalles?`;
        return respuesta;
      } else {
        return "🗺️ Para sugerirte rutas alternativas, primero haz clic en cualquier punto del mapa. Así podré analizar el tráfico en esa zona y ofrecerte desvíos personalizados.";
      }
    }
    
    // ========== ESTADO DEL TRÁFICO ==========
    if (lowerMsg.match(/cómo está el tráfico|estado del tráfico|congestión|qué tal el tráfico/)) {
      if (prediction) {
        return `📊 **Estado del tráfico en ${address.substring(0, 40)}...**\n\n${prediction.estado} con ${(prediction.probabilidad*100).toFixed(0)}% de probabilidad de empeorar en ${prediction.ventana}. Factores: ${prediction.factores}.${prediction.zona_critica ? `\n\n⚠️ Es zona crítica: ${prediction.zona_critica}.` : ''}\n\n¿Necesitas rutas alternativas?`;
      } else {
        return "🔍 Aún no has seleccionado ninguna ubicación. Haz clic en el mapa para obtener el estado del tráfico en tiempo real.";
      }
    }
    
    // ========== ZONAS CRÍTICAS ==========
    if (lowerMsg.match(/zona crítica|puntos críticos|accidentalidad|riesgo alto|sectores peligrosos/)) {
      let zonaEspecifica = null;
      for (let zona of zonasCriticas) {
        if (lowerMsg.includes(zona.nombre?.toLowerCase()) || (zona.sector_geografico && lowerMsg.includes(zona.sector_geografico.toLowerCase().split(' ')[0]))) {
          zonaEspecifica = zona;
          break;
        }
      }
      if (zonaEspecifica) {
        return `⚠️ **${zonaEspecifica.nombre || zonaEspecifica.sector_geografico}**\n\n• Nivel de riesgo: ${zonaEspecifica.nivel_riesgo}\n• Accidentes últimos 12 meses: ${zonaEspecifica.total_accidentes}\n• Lesionados: ${zonaEspecifica.total_lesionados}\n• Fatalidades: ${zonaEspecifica.total_fatalidades}\n\n🚨 Recomendación: Evita esta zona entre 6:00-8:00 AM y 5:00-7:00 PM. ¿Quieres rutas alternativas para sortearla?`;
      } else {
        const lista = zonasCriticas.map(z => `• ${z.nombre || z.sector_geografico} (riesgo ${z.nivel_riesgo} - ${z.total_accidentes} accidentes)`).join('\n');
        return `🚨 **Zonas críticas identificadas en Medellín:**\n\n${lista}\n\n¿Necesitas información detallada de alguna o rutas para evitarlas?`;
      }
    }
    
    // ========== NOTICIAS ==========
    if (lowerMsg.match(/noticias|incidentes|accidente|choque|siniestro|últimas noticias/)) {
      let termino = '';
      if (lowerMsg.includes('autopista')) termino = 'autopista';
      if (lowerMsg.includes('poblado')) termino = 'poblado';
      if (lowerMsg.includes('san juan')) termino = 'san juan';
      const notis = noticias.filter(n => 
        n.titulo.toLowerCase().includes(termino) || 
        n.descripcion.toLowerCase().includes(termino)
      ).slice(0, 3);
      if (notis.length > 0) {
        return `📰 **Últimas noticias de siniestros viales:**\n\n${notis.map(n => `• ${n.titulo} (${n.tipo_alerta_display})`).join('\n')}\n\n¿Quieres leer la descripción de alguna o saber cómo afecta el tráfico?`;
      } else {
        return "📭 No hay noticias recientes de incidentes en esa zona específica. Revisa el feed de noticias en el panel de estadísticas. ¿Quieres que te informe sobre zonas críticas cercanas?";
      }
    }
    
    // ========== COMPARACIÓN RIESGO ==========
    if (lowerMsg.match(/comparar|más peligrosa|menos peligrosa|diferencia entre/)) {
      const ordenadas = [...zonasCriticas].sort((a,b) => b.total_accidentes - a.total_accidentes);
      return `📊 **Comparativa de riesgo vial:**\n\n🔴 **Más crítica:** ${ordenadas[0].nombre || ordenadas[0].sector_geografico} (${ordenadas[0].total_accidentes} accidentes, ${ordenadas[0].total_fatalidades} fatalidades)\n🟠 **Segunda:** ${ordenadas[1].nombre || ordenadas[1].sector_geografico} (${ordenadas[1].total_accidentes})\n🟡 **Menor riesgo:** ${ordenadas[ordenadas.length-1].nombre || ordenadas[ordenadas.length-1].sector_geografico} (${ordenadas[ordenadas.length-1].total_accidentes})\n\n¿Deseas rutas alternativas para evitar las más críticas?`;
    }
    
    // ========== HORARIOS RECOMENDADOS ==========
    if (lowerMsg.match(/mejor hora|menos tráfico|cuándo evitar|horario recomendado/)) {
      return "🕒 **Recomendaciones horarias para evitar congestión:**\n\n• **Menos tráfico:** 10:00 AM - 11:30 AM y 2:00 PM - 4:00 PM\n• **Evitar:** 7:00-9:00 AM y 5:00-7:00 PM (hora punta)\n• **Fines de semana:** tráfico reducido en un 35% en avenidas principales.\n\n¿Quieres sugerencias de rutas alternativas para hora punta?";
    }
    
    // ========== FOTOMULTAS ==========
    if (lowerMsg.match(/fotomulta|multa|precio|costo|infracción|comparendo/)) {
      return "📸 **Infracciones comunes en Medellín y sus costos:**\n\n• **Exceso de velocidad:** hasta $1.300.000 COP\n• **Pasarse el semáforo en rojo:** $1.300.000 COP\n• **Pico y placa:** $650.000 COP\n• **SOAT vencido:** $1.300.000 COP\n\nConsulta el detalle en la sección de 'Fotomultas & Costos' debajo del mapa. ¿Te interesa saber las zonas con más cámaras?";
    }
    
    // ========== SALUDOS Y AYUDA ==========
    if (lowerMsg.match(/hola|buenas|qué hubo|saludos|hey|hi|ayuda|qué puedes hacer|comandos|funciones/)) {
      const ayudas = [
        "🤖 **Mis capacidades:**\n\n• Predecir congestión en un punto (haz clic en el mapa)\n• Sugerir rutas alternativas dinámicas\n• Identificar zonas críticas de accidentalidad\n• Mostrar noticias de incidentes recientes\n• Comparar niveles de riesgo entre sectores\n• Recomendar mejores horarios para conducir\n• Informar sobre fotomultas y costos\n\n¿Qué deseas consultar?",
        "¡Hola! Estoy aquí para ayudarte con la movilidad. Puedes preguntarme:\n- 'Rutas alternativas' (si ya seleccionaste un punto)\n- 'Estado del tráfico en [ubicación]'\n- 'Zonas críticas'\n- 'Noticias de accidentes'\n- 'Compara riesgo entre Autopista Norte y San Juan'\n- 'Muéstrame la calle 10'\n- 'Busca carrera 43A'\n\n¿Qué necesitas?"
      ];
      return ayudas[Math.floor(Math.random() * ayudas.length)];
    }
    
    return "No he entendido tu pregunta. Puedes consultarme sobre:\n\n• **Rutas alternativas** (primero haz clic en el mapa para indicar tu ubicación)\n• **Estado del tráfico**\n• **Zonas críticas**\n• **Noticias de incidentes**\n• **Comparativa de riesgo**\n• **Mejores horarios**\n• **Fotomultas**\n• **Mostrar una dirección** (ej: 'muéstrame la calle 10')\n\n¿Pruebas con alguna de esas opciones?";
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
    <div className="flex flex-col h-full bg-gray-900 text-white">
      <div className="bg-gradient-to-r from-purple-600 to-blue-600 p-4 shadow-lg">
        <div className="flex items-center gap-3">
          <Bot className="w-8 h-8" />
          <div>
            <h2 className="text-xl font-bold">MovAI Asistente</h2>
            <p className="text-sm text-purple-200">Predicción de congestión 2-4h</p>
          </div>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {chatHistory.map((msg, idx) => (
          <div
            key={idx}
            className={`flex gap-3 ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
          >
            {msg.role !== 'user' && (
              <div className="w-8 h-8 rounded-full bg-purple-600 flex items-center justify-center flex-shrink-0">
                <Bot className="w-5 h-5" />
              </div>
            )}
            <div
              className={`max-w-[80%] rounded-lg p-3 ${
                msg.role === 'user'
                  ? 'bg-blue-600 text-white'
                  : msg.role === 'system'
                  ? 'bg-gray-800 border-l-4 border-yellow-500 text-gray-200'
                  : 'bg-gray-800 text-gray-200'
              }`}
            >
              <div className="whitespace-pre-wrap text-sm">
                {msg.content.split('\n').map((line, i) => (
                  <p key={i} className={i > 0 ? 'mt-1' : ''}>{line}</p>
                ))}
              </div>
            </div>
            {msg.role === 'user' && (
              <div className="w-8 h-8 rounded-full bg-blue-600 flex items-center justify-center flex-shrink-0">
                <User className="w-5 h-5" />
              </div>
            )}
          </div>
        ))}
        
        {isTyping && (
          <div className="flex gap-3 justify-start">
            <div className="w-8 h-8 rounded-full bg-purple-600 flex items-center justify-center">
              <Bot className="w-5 h-5" />
            </div>
            <div className="bg-gray-800 rounded-lg p-3">
              <div className="flex gap-1">
                <span className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }}></span>
                <span className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }}></span>
                <span className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }}></span>
              </div>
            </div>
          </div>
        )}
        <div ref={chatEndRef} />
      </div>

      <div className="border-t border-gray-700 p-4 bg-gray-800">
        <div className="flex gap-2">
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyPress={(e) => e.key === 'Enter' && handleSend()}
            placeholder="Ej: muéstrame la calle 10, ve a la carrera 43A, ubicar avenida Las Palmas, o busca Parque Lleras"
            className="flex-1 bg-gray-700 text-white rounded-lg px-4 py-2 focus:outline-none focus:ring-2 focus:ring-purple-500"
          />
          <button
            onClick={handleSend}
            disabled={!input.trim()}
            className="bg-purple-600 hover:bg-purple-700 disabled:opacity-50 disabled:cursor-not-allowed rounded-lg px-4 py-2 transition-colors"
          >
            <Send className="w-5 h-5" />
          </button>
        </div>
        <div className="flex flex-wrap gap-3 mt-2 text-xs text-gray-400">
          <span className="flex items-center gap-1"><TrendingUp className="w-3 h-3" /> Predicción 2-4h</span>
          <span className="flex items-center gap-1"><AlertCircle className="w-3 h-3" /> Alertas tempranas</span>
          <span className="flex items-center gap-1"><Route className="w-3 h-3" /> Rutas alternativas</span>
          <span className="flex items-center gap-1"><HelpCircle className="w-3 h-3" /> Pregúntame</span>
        </div>
      </div>
    </div>
  );
}

export default AIAssistant;