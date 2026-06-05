import axios from 'axios';

const API_BASE = import.meta.env.VITE_API_URL
  ? `${import.meta.env.VITE_API_URL}/v1`
  : '/api/v1';

export async function getTrafficRoute(origen, destino) {
  const { data } = await axios.post(`${API_BASE}/trafico/ruta`, { origen, destino });
  return data;
}

export async function getTrafficIncidents(south, west, north, east) {
  const { data } = await axios.get(`${API_BASE}/trafico/incidentes`, {
    params: { south, west, north, east }
  });
  return data;
}

export async function getTrafficFlow(limit = 50) {
  const { data } = await axios.get(`${API_BASE}/trafico/flujo`, {
    params: { limit }
  });
  return data;
}
