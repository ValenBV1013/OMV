import axios from 'axios';

/**
 * Base de la API:
 * - Si existe VITE_API_URL en .env → lo usa (ej: http://localhost:8000/api)
 * - Si no → usa ruta relativa (Vite proxy redirige a Django)
 */
const API_BASE = import.meta.env.VITE_API_URL
  ? `${import.meta.env.VITE_API_URL}/v1`
  : '/api/v1';

/**
 * Genera o recupera un UUID de cliente desde localStorage.
 * Persiste entre recargas sin necesidad de autenticación.
 */
function getIdCliente() {
  let id = localStorage.getItem('omv_id_cliente');
  if (!id) {
    id = crypto.randomUUID();
    localStorage.setItem('omv_id_cliente', id);
  }
  return id;
}

/**
 * POST /api/v1/rutas/segura
 * Calcula la ruta más segura entre origen y destino.
 *
 * @param {string} origen - Dirección de partida
 * @param {string} destino - Dirección de destino
 * @param {boolean} modoLluvias - Prioriza seguridad sobre tiempo
 * @returns {Promise<object>} Resultado con ruta, riesgo, métricas
 */
export async function getSafeRoute(origen, destino, modoLluvias = true) {
  const { data } = await axios.post(`${API_BASE}/rutas/segura`, {
    origen,
    destino,
    modo_lluvias: modoLluvias,
    id_cliente: getIdCliente(),
  });
  return data;
}

/**
 * GET /api/v1/geo/geocodificar
 * Verifica que una dirección exista y devuelve coordenadas.
 *
 * @param {string} direccion
 * @returns {Promise<{lat: number, lng: number} | null>}
 */
export async function geocodificarDireccion(direccion) {
  const { data } = await axios.post(`${API_BASE}/geo/geocodificar`, {
    direccion,
  });
  return data;
}

/**
 * GET /api/v1/estadisticas/reporte
 * Estadísticas agregadas del módulo Rutas Seguras.
 */
export async function getStatsReporte() {
  const { data } = await axios.get(`${API_BASE}/estadisticas/reporte`);
  return data;
}

/**
 * GET /api/v1/geo/resumen
 * Conteo de zonas de riesgo por tipo.
 */
export async function getGeoResumen() {
  const { data } = await axios.get(`${API_BASE}/geo/resumen`);
  return data;
}

/**
 * GET /api/v1/rutas/historial
 * Historial de navegaciones del cliente actual.
 */
export async function getHistorial(page = 1) {
  const { data } = await axios.get(`${API_BASE}/rutas/historial`, {
    params: { cliente: getIdCliente(), page, limit: 10 },
  });
  return data;
}
