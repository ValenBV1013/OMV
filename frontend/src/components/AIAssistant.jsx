import { useState, useEffect, useRef } from 'react';
import { Send, Bot, User, AlertCircle, TrendingUp, HelpCircle, Route } from 'lucide-react';

function AIAssistant({ address, prediction, zonasCriticas = [], noticias = [], onSearchAddress }) {
  const [chatHistory, setChatHistory] = useState([]);
  const [input, setInput] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const chatEndRef = useRef(null);
  const [ultimaOferta, setUltimaOferta] = useState(null); // guarda qué oferta se hizo (rutas u horarios)

  const geocodeAddress = async (direccion) => {
    try {
      let query = direccion.trim();
      if (!query.toLowerCase().includes('colombia')) {
        query = `${query}, Colombia`;
      }
      const url = `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(query)}&format=json&limit=1&countrycodes=co`;
      const res = await fetch(url, { headers: { 'User-Agent': 'MovAI-App/1.0' } });
      const data = await res.json();
      if (data?.length) return { lat: parseFloat(data[0].lat), lng: parseFloat(data[0].lon) };
      const photonUrl = `https://photon.komoot.io/api/?q=${encodeURIComponent(direccion)}&limit=1`;
      const photonRes = await fetch(photonUrl);
      const photonData = await photonRes.json();
      if (photonData?.features?.length) {
        const [lng, lat] = photonData.features[0].geometry.coordinates;
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
      setChatHistory([{ role: 'assistant', content: 'Hola, soy MovAI. Puedo predecir congestión vehicular, sugerir rutas alternativas, identificar zonas críticas y leer noticias de siniestros viales. También ubico direcciones en Colombia. ¿En qué puedo ayudarle?' }]);
    }
  }, []);

  // Respuesta automática al recibir predicción (clic o búsqueda)
  useEffect(() => {
    if (prediction && address && !chatHistory.some(msg => msg.address === address)) {
      const estado = prediction.estado;
      const prob = (prediction.probabilidad * 100).toFixed(1);
      const ventana = prediction.ventana;
      const factores = prediction.factores;
      const zonaCritica = prediction.zona_critica ? `\nAdvertencia: ${prediction.zona_critica} es una zona de alto riesgo de accidentalidad.` : '';
      const systemMsg = {
        role: 'system',
        address,
        content: `Ubicación: ${address}\n\nEstado actual: ${estado}\nProbabilidad de empeorar en las próximas ${ventana}: ${prob}%\nFactores: ${factores}${zonaCritica}`
      };
      setChatHistory(prev => [...prev, systemMsg]);
      setIsTyping(true);
      setTimeout(() => {
        let advice = '';
        if (prediction.probabilidad > 0.7) {
          advice = `Alerta de congestión crítica (${prob}% de empeorar en ${ventana}). Recomiendo evitar esta zona o buscar rutas alternativas. ¿Necesita sugerencias?`;
          setUltimaOferta('rutas');
        } else if (prediction.probabilidad > 0.4) {
          advice = `Precaución: se espera tráfico irregular en las próximas ${ventana}. ¿Desea conocer los horarios de menor congestión o rutas alternativas?`;
          setUltimaOferta('horarios');
        } else {
          advice = `Vía fluida por ahora. Si lo desea, puedo informarle sobre zonas críticas cercanas.`;
          setUltimaOferta('zonas');
        }
        if (prediction.zona_critica) advice += `\nNota: ${prediction.zona_critica} es zona de alto riesgo. Extreme precauciones.`;
        setChatHistory(prev => [...prev, { role: 'assistant', content: advice }]);
        setIsTyping(false);
      }, 1000);
    }
  }, [prediction, address]);

  const generarRespuesta = async (mensaje) => {
    const lower = mensaje.toLowerCase().trim();
    
    // Detectar respuestas afirmativas a la última oferta
    const afirmaciones = ['sí', 'si', 'ok', 'vale', 'claro', 'por favor', 'adelante', 'dale', 'acepto', 'si por favor'];
    if (afirmaciones.includes(lower) && ultimaOferta) {
      if (ultimaOferta === 'rutas') {
        setUltimaOferta(null);
        return `Rutas alternativas sugeridas desde ${address ? address.substring(0, 35) : 'el punto seleccionado'}...\n- Avenida Regional: +8 minutos, 35% de congestión.\n- Calle 30: +12 minutos, 28% de congestión.\n- Avenida Las Palmas: +15 minutos, 45% de congestión.\nLa opción más eficiente es la Avenida Regional. ¿Necesita más detalles?`;
      } else if (ultimaOferta === 'horarios') {
        setUltimaOferta(null);
        return `Horarios de menor congestión en Medellín:\n- De 10:00 a 11:30 AM.\n- De 2:00 a 4:00 PM.\nEvite las horas punta: 7:00-9:00 AM y 5:00-7:00 PM. Los fines de semana el tráfico se reduce aproximadamente un 35% en avenidas principales. ¿Necesita rutas alternativas para ahora?`;
      } else if (ultimaOferta === 'zonas') {
        setUltimaOferta(null);
        const lista = zonasCriticas.map(z => `- ${z.nombre}: riesgo ${z.nivel_riesgo}, ${z.total_accidentes} accidentes registrados.`).join('\n');
        return `Zonas críticas identificadas en Medellín:\n${lista}\n¿Desea visualizar alguna en el mapa?`;
      }
    }

    // Detectar dirección
    const locationKeywords = ['muéstrame','ve a','busca','muestra','ubica','dirección','calle','carrera','av','avenida','autopista','transversal','diagonal','circular','kr','cra','cll','barrio','urbanización','conjunto','residencial','vereda','parque','estación','terminal'];
    const match = mensaje.match(new RegExp(`^(${locationKeywords.join('|')})\\s+(.+)`, 'i'));
    if (match) {
      let direccion = match[2].replace(/^(en|de|la|el|los|las|del|al)\s+/i, '').replace(/\.$/, '');
      if (direccion.length > 2) {
        const coords = await geocodeAddress(direccion);
        if (coords && onSearchAddress) {
          onSearchAddress(direccion, coords);
          return `Mostrando "${direccion}" en el mapa. Centrando vista y analizando tráfico en ese punto. Espere un momento.`;
        }
        return `No se encontró "${direccion}" en Colombia. Intente con más detalles (ciudad, barrio o nomenclatura más precisa). Ejemplo: "calle 10 con carrera 43A, Bogotá".`;
      }
    }

    // Rutas alternativas (sin esperar afirmación previa)
    if (lower.match(/ruta alternativa|alternativa|evitar tráfico|mejor ruta/)) {
      if (prediction && address) {
        setUltimaOferta(null);
        return `Rutas alternativas desde ${address.substring(0,35)}...\n- Avenida Regional: +8 min, 35% congestión.\n- Calle 30: +12 min, 28% congestión.\n- Avenida Las Palmas: +15 min, 45% congestión.\nLa mejor opción es la Avenida Regional. ¿Necesita más detalles?`;
      }
      return `Para sugerir rutas alternativas, primero haga clic en el mapa sobre la ubicación de interés.`;
    }

    // Estado del tráfico actual
    if (lower.match(/cómo está el tráfico|estado del tráfico|congestión|tráfico ahora/)) {
      if (prediction) {
        return `Informe de tráfico en ${address.substring(0,40)}:\n${prediction.estado}\nProbabilidad de empeorar en ${prediction.ventana}: ${(prediction.probabilidad*100).toFixed(0)}%\nFactores: ${prediction.factores}${prediction.zona_critica ? `\nAdemás, es una zona crítica.` : ''}`;
      }
      return `Haga clic en el mapa para obtener el estado del tráfico en tiempo real.`;
    }

    // Zonas críticas
    if (lower.match(/zona crítica|puntos críticos|riesgo alto|accidentalidad/)) {
      const lista = zonasCriticas.map(z => `- ${z.nombre}: riesgo ${z.nivel_riesgo}, ${z.total_accidentes} accidentes, ${z.total_fatalidades} fatalidades.`).join('\n');
      return `Puntos críticos de accidentalidad en Medellín:\n${lista}\n¿Desea ver alguno en el mapa?`;
    }

    // Noticias
    if (lower.match(/noticias|incidente|accidente|choque|siniestro/)) {
      const notis = noticias.slice(0, 3);
      return `Noticias recientes de siniestros viales:\n${notis.map(n => `- ${n.titulo} (${n.tipo_alerta_display})`).join('\n')}`;
    }

    // Horarios
    if (lower.match(/mejor hora|menos tráfico|horario recomendado/)) {
      setUltimaOferta(null);
      return `Recomendaciones horarias:\n- Menos tráfico: 10:00-11:30 AM y 2:00-4:00 PM.\n- Evitar horas punta: 7:00-9:00 AM y 5:00-7:00 PM.\n- Fines de semana: reducción del 35% en avenidas principales.`;
    }

    // Fotomultas
    if (lower.match(/fotomulta|multa|infracción|comparendo/)) {
      return `Infracciones comunes en Colombia y sus costos aproximados:\n- Exceso de velocidad: hasta $1.300.000 COP\n- Pasarse el semáforo en rojo: $1.300.000 COP\n- Violación de pico y placa: $650.000 COP\n- SOAT vencido: $1.300.000 COP`;
    }

    // Ayuda o saludo
    if (lower.match(/hola|ayuda|qué puedes hacer|comandos/)) {
      return `Comandos disponibles:\n- "estado del tráfico" (después de hacer clic en el mapa)\n- "rutas alternativas"\n- "zonas críticas"\n- "noticias"\n- "muéstrame [dirección]" (ej: "barrio Laureles, Medellín")\n- "horarios recomendados"\n- "fotomultas"\n- Responder "sí" a mis sugerencias.`;
    }

    return `No he entendido su pregunta. Puede consultar:\n- "estado del tráfico"\n- "zonas críticas"\n- "rutas alternativas"\n- "noticias"\n- "muéstrame la calle 10 en Bogotá"\n¿En qué más puedo ayudarle?`;
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
            <p className="text-sm text-purple-200">Predicción de congestión (2-4h)</p>
          </div>
        </div>
      </div>
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {chatHistory.map((msg, idx) => (
          <div key={idx} className={`flex gap-3 ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
            {msg.role !== 'user' && <div className="w-8 h-8 rounded-full bg-purple-600 flex items-center justify-center"><Bot className="w-5 h-5" /></div>}
            <div className={`max-w-[80%] rounded-lg p-3 ${msg.role === 'user' ? 'bg-blue-600' : 'bg-gray-800'}`}>
              <div className="whitespace-pre-wrap text-sm">{msg.content}</div>
            </div>
            {msg.role === 'user' && <div className="w-8 h-8 rounded-full bg-blue-600 flex items-center justify-center"><User className="w-5 h-5" /></div>}
          </div>
        ))}
        {isTyping && (
          <div className="flex gap-3 justify-start">
            <div className="w-8 h-8 rounded-full bg-purple-600 flex items-center justify-center"><Bot className="w-5 h-5" /></div>
            <div className="bg-gray-800 rounded-lg p-3"><div className="flex gap-1"><span className="w-2 h-2 bg-gray-400 rounded-full animate-bounce"></span><span className="w-2 h-2 bg-gray-400 rounded-full animate-bounce delay-150"></span><span className="w-2 h-2 bg-gray-400 rounded-full animate-bounce delay-300"></span></div></div>
          </div>
        )}
        <div ref={chatEndRef} />
      </div>
      <div className="border-t border-gray-700 p-4 bg-gray-800">
        <div className="flex gap-2">
          <input type="text" value={input} onChange={e => setInput(e.target.value)} onKeyPress={e => e.key === 'Enter' && handleSend()} placeholder="Escriba su consulta aquí..." className="flex-1 bg-gray-700 text-white rounded-lg px-4 py-2 focus:ring-2 focus:ring-purple-500" />
          <button onClick={handleSend} disabled={!input.trim()} className="bg-purple-600 hover:bg-purple-700 disabled:opacity-50 rounded-lg px-4 py-2"><Send className="w-5 h-5" /></button>
        </div>
        <div className="flex flex-wrap gap-3 mt-2 text-xs text-gray-400">
          <span><TrendingUp className="inline w-3 h-3" /> Predicción</span>
          <span><AlertCircle className="inline w-3 h-3" /> Alertas</span>
          <span><Route className="inline w-3 h-3" /> Rutas</span>
          <span><HelpCircle className="inline w-3 h-3" /> Ayuda</span>
        </div>
      </div>
    </div>
  );
}

export default AIAssistant;