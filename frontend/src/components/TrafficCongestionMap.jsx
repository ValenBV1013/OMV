import React, { useState, useEffect, useCallback, useRef } from 'react';
import { MapContainer, TileLayer, Polyline, CircleMarker, Marker, Tooltip, useMap } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import axios from 'axios';

// Fix iconos Leaflet para los marcadores de ruta
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon-2x.png',
  iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png',
});
import {
  Activity, RefreshCw, WifiOff, AlertTriangle,
  Route, Gauge, ChevronDown, ChevronUp,
  Layers, ToggleRight, ToggleLeft,
  Navigation, Car, MapPin
} from 'lucide-react';

const API_URL = 'http://localhost:8000/api/v1';
const TOMTOM_KEY = import.meta.env.VITE_TOMTOM_API_KEY || '';
const MEDELLIN_CENTER = [6.2476, -75.5658];

// Puntos clave de Medellín para consultar TomTom Traffic Flow
const TOMTOM_CHECKPOINTS = [
  { lat: 6.2476, lng: -75.5658, name: 'Av. Regional/Coltejer' },
  { lat: 6.2088, lng: -75.5677, name: 'Av. El Poblado/Lleras' },
  { lat: 6.2485, lng: -75.5790, name: 'Av. San Juan/Carrera 65' },
  { lat: 6.2750, lng: -75.5650, name: 'Autopista Norte' },
  { lat: 6.2350, lng: -75.5850, name: 'Calle 30' },
  { lat: 6.2200, lng: -75.5760, name: 'Av. 80' },
  { lat: 6.2435, lng: -75.5480, name: 'Av. Oriental' },
  { lat: 6.2550, lng: -75.5900, name: 'El Poblado' },
];

// ─── Mock de vías principales de Medellín con trazados fieles a la realidad ───
// Coordenadas [lng, lat] en GeoJSON, el frontend las convierte a [lat, lng] para Leaflet
const MOCK_SEGMENTS = [
  // Av. Regional / Autopista Sur: corre paralela al río por el costado oeste, de sur a norte
  { id: 1, nombre: 'AV Regional', label: 'Av. Regional', tipo_via: 'AV', jerarquia_via: 1, velocidad_maxima: 80,
    geometria_wgs84: { coordinates: [
      [-75.5770,6.1400],[-75.5765,6.1480],[-75.5758,6.1560],[-75.5750,6.1640],
      [-75.5742,6.1720],[-75.5733,6.1800],[-75.5725,6.1880],[-75.5715,6.1960],
      [-75.5705,6.2040],[-75.5695,6.2120],[-75.5685,6.2200],[-75.5675,6.2280],
      [-75.5665,6.2360],[-75.5658,6.2440],[-75.5653,6.2476],[-75.5648,6.2520],
      [-75.5640,6.2600],[-75.5632,6.2680],[-75.5625,6.2760],[-75.5618,6.2840],
      [-75.5610,6.2920],[-75.5602,6.3000],[-75.5595,6.3080],[-75.5588,6.3160],
      [-75.5580,6.3240],[-75.5572,6.3320],[-75.5565,6.3400],
    ]} },

  // Av. El Poblado: de la zona sur (Lleras) sube en diagonal noroeste hacia el centro
  { id: 2, nombre: 'AV El Poblado', label: 'Av. El Poblado', tipo_via: 'AV', jerarquia_via: 1, velocidad_maxima: 60,
    geometria_wgs84: { coordinates: [
      [-75.5670,6.2050],[-75.5680,6.2080],[-75.5692,6.2120],[-75.5705,6.2160],
      [-75.5720,6.2200],[-75.5735,6.2240],[-75.5750,6.2280],[-75.5765,6.2320],
      [-75.5780,6.2360],[-75.5795,6.2400],[-75.5810,6.2440],[-75.5825,6.2480],
      [-75.5838,6.2520],[-75.5850,6.2555],
    ]} },

  // Av. San Juan (Calle 44): atraviesa la ciudad de oeste a este
  { id: 3, nombre: 'AV San Juan', label: 'Av. San Juan', tipo_via: 'AV', jerarquia_via: 1, velocidad_maxima: 60,
    geometria_wgs84: { coordinates: [
      [-75.5820,6.2488],[-75.5800,6.2486],[-75.5780,6.2485],[-75.5760,6.2483],
      [-75.5740,6.2482],[-75.5720,6.2480],[-75.5700,6.2478],[-75.5680,6.2476],
      [-75.5660,6.2474],[-75.5650,6.2472],[-75.5630,6.2470],[-75.5610,6.2468],
      [-75.5590,6.2465],[-75.5570,6.2462],[-75.5550,6.2460],[-75.5530,6.2457],
      [-75.5510,6.2455],[-75.5490,6.2452],[-75.5470,6.2450],
    ]} },

  // Autopista Norte: continuación natural de la Regional hacia Bello
  { id: 4, nombre: 'Autopista Norte', label: 'Autopista Norte', tipo_via: 'AV', jerarquia_via: 1, velocidad_maxima: 80,
    geometria_wgs84: { coordinates: [
      [-75.5650,6.2500],[-75.5645,6.2550],[-75.5640,6.2600],[-75.5635,6.2650],
      [-75.5630,6.2700],[-75.5625,6.2750],[-75.5620,6.2800],[-75.5615,6.2850],
      [-75.5610,6.2900],[-75.5605,6.2950],[-75.5600,6.3000],[-75.5595,6.3050],
      [-75.5590,6.3100],[-75.5585,6.3150],[-75.5580,6.3200],[-75.5575,6.3250],
      [-75.5570,6.3300],[-75.5565,6.3350],[-75.5560,6.3400],
    ]} },

  // Av. Las Palmas: desde El Poblado hacia el oriente (aeropuerto), sube a la montaña
  { id: 5, nombre: 'AV Las Palmas', label: 'Av. Las Palmas', tipo_via: 'AV', jerarquia_via: 2, velocidad_maxima: 70,
    geometria_wgs84: { coordinates: [
      [-75.5677,6.2085],[-75.5660,6.2090],[-75.5640,6.2098],[-75.5620,6.2105],
      [-75.5600,6.2112],[-75.5580,6.2120],[-75.5560,6.2128],[-75.5540,6.2135],
      [-75.5520,6.2142],[-75.5500,6.2150],[-75.5480,6.2158],[-75.5460,6.2165],
      [-75.5445,6.2170],
    ]} },

  // Calle 30: vía importante este-oeste en el sur del centro
  { id: 6, nombre: 'CL 30', label: 'Calle 30', tipo_via: 'CL', jerarquia_via: 2, velocidad_maxima: 50,
    geometria_wgs84: { coordinates: [
      [-75.5850,6.2350],[-75.5830,6.2348],[-75.5810,6.2346],[-75.5790,6.2344],
      [-75.5770,6.2342],[-75.5750,6.2340],[-75.5730,6.2338],[-75.5710,6.2335],
      [-75.5690,6.2332],[-75.5670,6.2330],[-75.5650,6.2328],[-75.5630,6.2325],
      [-75.5610,6.2323],[-75.5590,6.2320],[-75.5570,6.2318],
    ]} },

  // Av. Oriental: bordea el centro por el costado este
  { id: 7, nombre: 'AV Oriental', label: 'Av. Oriental', tipo_via: 'AV', jerarquia_via: 2, velocidad_maxima: 50,
    geometria_wgs84: { coordinates: [
      [-75.5655,6.2460],[-75.5645,6.2468],[-75.5635,6.2470],
      [-75.5625,6.2470],[-75.5615,6.2468],[-75.5605,6.2466],[-75.5595,6.2463],
      [-75.5585,6.2460],[-75.5575,6.2457],[-75.5565,6.2453],[-75.5555,6.2448],
      [-75.5545,6.2443],[-75.5530,6.2438],[-75.5515,6.2432],[-75.5500,6.2427],
      [-75.5485,6.2420],
    ]} },

  // Carrera 65: vía norte-sur por el costado occidental
  { id: 8, nombre: 'CR 65', label: 'Carrera 65', tipo_via: 'CR', jerarquia_via: 2, velocidad_maxima: 50,
    geometria_wgs84: { coordinates: [
      [-75.5790,6.2210],[-75.5792,6.2240],[-75.5795,6.2270],[-75.5798,6.2300],
      [-75.5800,6.2330],[-75.5803,6.2360],[-75.5805,6.2390],[-75.5808,6.2420],
      [-75.5810,6.2450],[-75.5812,6.2470],[-75.5815,6.2485],
    ]} },

  // Avenida 80: vía norte-sur en el extremo occidental de Medellín
  { id: 9, nombre: 'AV 80', label: 'Avenida 80', tipo_via: 'AV', jerarquia_via: 2, velocidad_maxima: 60,
    geometria_wgs84: { coordinates: [
      [-75.5900,6.2555],[-75.5895,6.2530],[-75.5890,6.2505],[-75.5885,6.2480],
      [-75.5880,6.2455],[-75.5875,6.2430],[-75.5870,6.2405],[-75.5863,6.2380],
      [-75.5855,6.2355],[-75.5848,6.2330],[-75.5840,6.2305],[-75.5832,6.2280],
      [-75.5825,6.2255],[-75.5817,6.2230],[-75.5810,6.2205],
    ]} },

  // Carrera 43A (La 43A): vía comercial que baja de El Poblado hacia el centro
  { id: 10, nombre: 'CR 43A', label: 'Carrera 43A', tipo_via: 'CR', jerarquia_via: 3, velocidad_maxima: 40,
    geometria_wgs84: { coordinates: [
      [-75.5730,6.2400],[-75.5738,6.2380],[-75.5745,6.2360],[-75.5752,6.2340],
      [-75.5760,6.2320],[-75.5768,6.2300],[-75.5775,6.2280],[-75.5782,6.2260],
      [-75.5790,6.2240],[-75.5798,6.2220],[-75.5805,6.2200],[-75.5812,6.2180],
      [-75.5820,6.2160],[-75.5827,6.2140],[-75.5835,6.2120],
    ]} },

  // Transversal Inferior: diagonal que conecta el sur con el centro
  { id: 11, nombre: 'TV Inferior', label: 'Transversal Inferior', tipo_via: 'TV', jerarquia_via: 3, velocidad_maxima: 40,
    geometria_wgs84: { coordinates: [
      [-75.5660,6.2340],[-75.5675,6.2355],[-75.5690,6.2370],[-75.5705,6.2385],
      [-75.5720,6.2400],[-75.5735,6.2415],[-75.5750,6.2430],[-75.5765,6.2445],
      [-75.5780,6.2460],[-75.5790,6.2470],
    ]} },

  // Av. Las Vegas: conecta el sur de El Poblado con el centro
  { id: 12, nombre: 'AV Las Vegas', label: 'Av. Las Vegas', tipo_via: 'AV', jerarquia_via: 3, velocidad_maxima: 50,
    geometria_wgs84: { coordinates: [
      [-75.5690,6.2050],[-75.5698,6.2080],[-75.5705,6.2110],[-75.5712,6.2140],
      [-75.5720,6.2170],[-75.5728,6.2200],[-75.5735,6.2230],[-75.5742,6.2260],
      [-75.5750,6.2290],[-75.5758,6.2320],[-75.5765,6.2350],
    ]} },
];

const NIVELES = ['BAJO', 'MODERADO', 'ALTO', 'SEVERO'];
const CONGESTION_STYLES = {
  SEVERO:   { color: '#DC2626', weight: 5, opacity: 0.85, label: 'Severo', markerColor: '#DC2626' },
  ALTO:     { color: '#EA580C', weight: 4, opacity: 0.8, label: 'Alto', markerColor: '#EA580C' },
  MODERADO: { color: '#EAB308', weight: 3, opacity: 0.7, label: 'Moderado', markerColor: '#EAB308' },
  BAJO:     { color: '#22C55E', weight: 2.5, opacity: 0.5, label: 'Bajo', markerColor: '#22C55E' },
  SIN_DATO: { color: '#6B7280', weight: 2, opacity: 0.3, label: 'Sin dato', markerColor: '#6B7280' },
};

// ─── Vías principales de Medellín para rutas alternativas ───
// Cada vía tiene nombre + puntos [lat, lng] + palabras clave para búsqueda
const VIAS_PRINCIPALES = [
  {
    nombre: 'Av. Regional',
    keywords: ['regional', 'autopista sur'],
    coords: [
      [6.1400,-75.5770],[6.1480,-75.5765],[6.1560,-75.5758],[6.1640,-75.5750],
      [6.1720,-75.5742],[6.1800,-75.5733],[6.1880,-75.5725],[6.1960,-75.5715],
      [6.2040,-75.5705],[6.2120,-75.5695],[6.2200,-75.5685],[6.2280,-75.5675],
      [6.2360,-75.5665],[6.2440,-75.5658],[6.2476,-75.5653],[6.2520,-75.5648],
      [6.2600,-75.5640],[6.2680,-75.5632],[6.2760,-75.5625],[6.2840,-75.5618],
      [6.2920,-75.5610],[6.3000,-75.5602],[6.3080,-75.5595],[6.3160,-75.5588],
      [6.3240,-75.5580],[6.3320,-75.5572],[6.3400,-75.5565],
    ]
  },
  {
    nombre: 'Av. El Poblado',
    keywords: ['poblado', 'lleras', 'zona rosa'],
    coords: [
      [6.2050,-75.5670],[6.2080,-75.5680],[6.2120,-75.5692],[6.2160,-75.5705],
      [6.2200,-75.5720],[6.2240,-75.5735],[6.2280,-75.5750],[6.2320,-75.5765],
      [6.2360,-75.5780],[6.2400,-75.5795],[6.2440,-75.5810],[6.2480,-75.5825],
      [6.2520,-75.5838],[6.2555,-75.5850],
    ]
  },
  {
    nombre: 'Av. San Juan',
    keywords: ['san juan', 'calle 44'],
    coords: [
      [6.2488,-75.5820],[6.2486,-75.5800],[6.2485,-75.5780],[6.2483,-75.5760],
      [6.2482,-75.5740],[6.2480,-75.5720],[6.2478,-75.5700],[6.2476,-75.5680],
      [6.2474,-75.5660],[6.2472,-75.5650],[6.2470,-75.5630],[6.2468,-75.5610],
      [6.2465,-75.5590],[6.2462,-75.5570],[6.2460,-75.5550],[6.2457,-75.5530],
      [6.2455,-75.5510],[6.2452,-75.5490],[6.2450,-75.5470],
    ]
  },
  {
    nombre: 'Autopista Norte',
    keywords: ['autopista norte', 'norte'],
    coords: [
      [6.2500,-75.5650],[6.2550,-75.5645],[6.2600,-75.5640],[6.2650,-75.5635],
      [6.2700,-75.5630],[6.2750,-75.5625],[6.2800,-75.5620],[6.2850,-75.5615],
      [6.2900,-75.5610],[6.2950,-75.5605],[6.3000,-75.5600],[6.3050,-75.5595],
      [6.3100,-75.5590],[6.3150,-75.5585],[6.3200,-75.5580],[6.3250,-75.5575],
      [6.3300,-75.5570],[6.3350,-75.5565],[6.3400,-75.5560],
    ]
  },
  {
    nombre: 'Calle 30',
    keywords: ['calle 30', 'cl 30'],
    coords: [
      [6.2350,-75.5850],[6.2348,-75.5830],[6.2346,-75.5810],[6.2344,-75.5790],
      [6.2342,-75.5770],[6.2340,-75.5750],[6.2338,-75.5730],[6.2335,-75.5710],
      [6.2332,-75.5690],[6.2330,-75.5670],[6.2328,-75.5650],[6.2325,-75.5630],
      [6.2323,-75.5610],[6.2320,-75.5590],[6.2318,-75.5570],
    ]
  },
  {
    nombre: 'Av. Oriental',
    keywords: ['oriental'],
    coords: [
      [6.2460,-75.5655],[6.2468,-75.5645],[6.2470,-75.5635],[6.2470,-75.5625],
      [6.2468,-75.5615],[6.2466,-75.5605],[6.2463,-75.5595],[6.2460,-75.5585],
      [6.2457,-75.5575],[6.2453,-75.5565],[6.2448,-75.5555],[6.2443,-75.5545],
      [6.2438,-75.5530],[6.2432,-75.5515],[6.2427,-75.5500],[6.2420,-75.5485],
    ]
  },
  {
    nombre: 'Carrera 65',
    keywords: ['carrera 65', 'cr 65', 'cra 65'],
    coords: [
      [6.2210,-75.5790],[6.2240,-75.5792],[6.2270,-75.5795],[6.2300,-75.5798],
      [6.2330,-75.5800],[6.2360,-75.5803],[6.2390,-75.5805],[6.2420,-75.5808],
      [6.2450,-75.5810],[6.2470,-75.5812],[6.2485,-75.5815],
    ]
  },
  {
    nombre: 'Av. 80',
    keywords: ['avenida 80', 'av 80'],
    coords: [
      [6.2205,-75.5810],[6.2230,-75.5817],[6.2255,-75.5825],[6.2280,-75.5832],
      [6.2305,-75.5840],[6.2330,-75.5848],[6.2355,-75.5855],[6.2380,-75.5863],
      [6.2405,-75.5870],[6.2430,-75.5875],[6.2455,-75.5880],[6.2480,-75.5885],
      [6.2505,-75.5890],[6.2530,-75.5895],[6.2555,-75.5900],
    ]
  },
  {
    nombre: 'Av. Las Palmas',
    keywords: ['las palmas', 'palmas'],
    coords: [
      [6.2085,-75.5677],[6.2090,-75.5660],[6.2098,-75.5640],[6.2105,-75.5620],
      [6.2112,-75.5600],[6.2120,-75.5580],[6.2128,-75.5560],[6.2135,-75.5540],
      [6.2142,-75.5520],[6.2150,-75.5500],[6.2158,-75.5480],[6.2165,-75.5460],
      [6.2170,-75.5445],
    ]
  },
  {
    nombre: 'Carrera 43A',
    keywords: ['carrera 43a', 'cr 43a', 'cra 43a', 'la 43a'],
    coords: [
      [6.2120,-75.5835],[6.2140,-75.5827],[6.2160,-75.5820],[6.2180,-75.5812],
      [6.2200,-75.5805],[6.2220,-75.5798],[6.2240,-75.5790],[6.2260,-75.5782],
      [6.2280,-75.5775],[6.2300,-75.5768],[6.2320,-75.5760],[6.2340,-75.5752],
      [6.2360,-75.5745],[6.2380,-75.5738],[6.2400,-75.5730],
    ]
  },
  {
    nombre: 'Transversal Inferior',
    keywords: ['inferior', 'transversal inferior', 'tv inferior'],
    coords: [
      [6.2340,-75.5660],[6.2355,-75.5675],[6.2370,-75.5690],[6.2385,-75.5705],
      [6.2400,-75.5720],[6.2415,-75.5735],[6.2430,-75.5750],[6.2445,-75.5765],
      [6.2460,-75.5780],[6.2470,-75.5790],
    ]
  },
  {
    nombre: 'Av. Las Vegas',
    keywords: ['las vegas', 'vegas', 'av las vegas'],
    coords: [
      [6.2050,-75.5690],[6.2080,-75.5698],[6.2110,-75.5705],[6.2140,-75.5712],
      [6.2170,-75.5720],[6.2200,-75.5728],[6.2230,-75.5735],[6.2260,-75.5742],
      [6.2290,-75.5750],[6.2320,-75.5758],[6.2350,-75.5765],
    ]
  },
];

// ─── Rutas alternativas automáticas ───
// Cuando una vía tiene congestión ALTA/SEVERA, se calcula automáticamente la alternativa
const AUTO_ROUTES = [
  { whenCongested: 'AV Regional', originKeyword: 'Carrera 65', destKeyword: 'Av. 80', label: 'Regional → Cra 65 + Av 80' },
  { whenCongested: 'AV El Poblado', originKeyword: 'Av. Las Vegas', destKeyword: 'TV Inferior', label: 'Poblado → Las Vegas + Inferior' },
  { whenCongested: 'AV San Juan', originKeyword: 'CL 30', destKeyword: 'AV Oriental', label: 'San Juan → Calle 30 + Oriental' },
  { whenCongested: 'Autopista Norte', originKeyword: 'AV 80', destKeyword: 'CR 65', label: 'Autopista → Av 80 + Cra 65' },
  { whenCongested: 'AV Las Palmas', originKeyword: 'AV El Poblado', destKeyword: 'AV Oriental', label: 'Palmas → Poblado + Oriental' },
  { whenCongested: 'CL 30', originKeyword: 'AV San Juan', destKeyword: 'AV Regional', label: 'Calle 30 → San Juan + Regional' },
  { whenCongested: 'AV Oriental', originKeyword: 'AV San Juan', destKeyword: 'AV Regional', label: 'Oriental → San Juan + Regional' },
  { whenCongested: 'CR 65', originKeyword: 'AV Regional', destKeyword: 'AV 80', label: 'Cra 65 → Regional + Av 80' },
  { whenCongested: 'AV 80', originKeyword: 'CR 65', destKeyword: 'AV Regional', label: 'Av 80 → Cra 65 + Regional' },
  { whenCongested: 'CR 43A', originKeyword: 'AV El Poblado', destKeyword: 'AV Regional', label: '43A → Poblado + Regional' },
  { whenCongested: 'TV Inferior', originKeyword: 'AV El Poblado', destKeyword: 'AV Regional', label: 'Inferior → Poblado + Regional' },
  { whenCongested: 'AV Las Vegas', originKeyword: 'AV El Poblado', destKeyword: 'CR 43A', label: 'Las Vegas → Poblado + 43A' },
];

// ─── Generar estado de congestión mock ───
function generarMockFlujo() {
  return MOCK_SEGMENTS.map(seg => {
    const rand = Math.random();
    let nivel, vel, libre;
    if (rand < 0.35) {
      nivel = 'BAJO'; vel = 45 + Math.random() * 25; libre = 60;
    } else if (rand < 0.65) {
      nivel = 'MODERADO'; vel = 25 + Math.random() * 15; libre = 55;
    } else if (rand < 0.85) {
      nivel = 'ALTO'; vel = 15 + Math.random() * 10; libre = 55;
    } else {
      nivel = 'SEVERO'; vel = 5 + Math.random() * 10; libre = 55;
    }
    return {
      ...seg,
      ultimo_flujo: {
        velocidad_promedio: Math.round(vel),
        velocidad_libre: libre,
        nivel_congestion: nivel,
        congestionado: nivel === 'ALTO' || nivel === 'SEVERO',
        fuente: 'tomtom',
        timestamp: new Date().toISOString(),
      }
    };
  });
}

// ─── Generar eventos mock ───
function generarMockEventos(segments) {
  return segments
    .filter(s => s.ultimo_flujo?.nivel_congestion === 'SEVERO')
    .slice(0, 3)
    .map(s => ({
      id: Math.floor(Math.random() * 1000),
      segmento_id: s.id,
      segmento_nombre: s.nombre,
      nivel: 'SEVERO',
      velocidad_promedio: s.ultimo_flujo.velocidad_promedio,
      velocidad_libre: s.ultimo_flujo.velocidad_libre,
      activo: true,
      timestamp: new Date().toISOString(),
    }));
}

// ─── Componente que centra el mapa ───
function MapCenterer({ segments }) {
  const map = useMap();
  const done = useRef(false);
  useEffect(() => {
    if (!done.current && segments?.length) {
      const coords = segments.flatMap(getSegmentCoords).filter(Boolean);
      if (coords.length) {
        const group = L.featureGroup(coords.map(c => L.marker(c)));
        map.fitBounds(group.getBounds().pad(0.15));
        done.current = true;
      }
    }
  }, [segments, map]);
  return null;
}

function getSegmentCoords(segment) {
  // SOLO usar geometria_wgs84 (WGS84 lat/lng).
  // NUNCA usar geometria (EPSG:9377) porque son coordenadas proyectadas en metros, no lat/lng.
  if (!segment?.geometria_wgs84?.coordinates) return [];

  const coords = segment.geometria_wgs84.coordinates;
  if (Array.isArray(coords) && coords.length > 0 && Array.isArray(coords[0])) {
    return coords.map(c => [c[1], c[0]]); // [lng, lat] -> [lat, lng]
  }
  return [];
}

function getSegmentMidpoint(coords) {
  if (!coords?.length) return null;
  return coords[Math.floor(coords.length / 2)];
}

// ─── Recortar coordenadas de una vía al rango relevante entre origen y destino ───
// Evita distancias desproporcionadas cuando la vía se extiende mucho más allá del trayecto.
function clipViaToRange(coords, originPt, destPt, padding = 0.2) {
  if (!coords?.length || !originPt || !destPt) return coords;

  const first = coords[0];
  const last = coords[coords.length - 1];
  const latSpan = Math.abs(last[0] - first[0]);
  const lngSpan = Math.abs(last[1] - first[1]);

  // Determinar eje dominante: lat si N-S, lng si E-W
  const useLat = latSpan >= lngSpan;

  const axisIdx = useLat ? 0 : 1;
  const minVal = Math.min(originPt[axisIdx], destPt[axisIdx]);
  const maxVal = Math.max(originPt[axisIdx], destPt[axisIdx]);
  const range = maxVal - minVal;
  const paddedMin = minVal - range * padding;
  const paddedMax = maxVal + range * padding;

  let startIdx = 0;
  let endIdx = coords.length - 1;

  for (let i = 0; i < coords.length; i++) {
    if (coords[i][axisIdx] >= paddedMin) { startIdx = i; break; }
  }
  for (let i = coords.length - 1; i >= 0; i--) {
    if (coords[i][axisIdx] <= paddedMax) { endIdx = i; break; }
  }

  if (startIdx > endIdx) return coords; // fallback si el clipping es inválido
  const result = coords.slice(startIdx, endIdx + 1);
  return result.length >= 2 ? result : coords; // fallback si quedan muy pocos puntos
}

export default function TrafficCongestionMap() {
  const [segments, setSegments] = useState([]);
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [lastUpdate, setLastUpdate] = useState(null);
  const [error, setError] = useState(null);
  const [currentAlert, setCurrentAlert] = useState(null);
  const [routeResult, setRouteResult] = useState(null);
  const [routeOriginCoords, setRouteOriginCoords] = useState(null);
  const [routeDestCoords, setRouteDestCoords] = useState(null);
  const [routeError, setRouteError] = useState(null);
  const [autoRouteInfo, setAutoRouteInfo] = useState(null);
  const [congestedRouteCoords, setCongestedRouteCoords] = useState([]);
  const [congestedRouteTime, setCongestedRouteTime] = useState(null);
  const [congestedRouteDist, setCongestedRouteDist] = useState(null);
  const [routeVias, setRouteVias] = useState([]);
  const congestedRouteTimeRef = useRef(null);
  const prevSevereRef = useRef(0);
  const executeRouteRef = useRef(null);
  const isMountedRef = useRef(true);

  useEffect(() => {
    isMountedRef.current = true;
    return () => { isMountedRef.current = false; };
  }, []);

  // ─── Panel de control ───
  const [controls, setControls] = useState({
    soloCongestion: true,
    showSpeed: true,
    showRoutes: true,
    autoAlerts: true,
    showLegend: true,
    panelOpen: true,
    realTime: false,
  });

  const toggle = (key) => setControls(p => ({ ...p, [key]: !p[key] }));

  // ─── Consultar TomTom Traffic Flow API directo (PARALELO) ───
  const fetchTomTom = useCallback(async () => {
    const results = await Promise.allSettled(
      TOMTOM_CHECKPOINTS.map(async (pt, idx) => {
        const res = await axios.get(
          `https://api.tomtom.com/traffic/services/4/flowSegmentData/absolute/10/json`,
          { params: { key: TOMTOM_KEY, point: `${pt.lat},${pt.lng}`, unit: 'KMPH' }, timeout: 3000 }
        );
        const fs = res.data?.flowSegmentData;
        if (!fs) return null;
        const coords = fs.coordinates?.coordinate || [];
        const geom = coords.map(c => [c.longitude, c.latitude]);
        let nivel = 'BAJO';
        if (fs.currentSpeed < fs.freeFlowSpeed * 0.3) nivel = 'SEVERO';
        else if (fs.currentSpeed < fs.freeFlowSpeed * 0.5) nivel = 'ALTO';
        else if (fs.currentSpeed < fs.freeFlowSpeed * 0.7) nivel = 'MODERADO';
        return {
          id: 100 + idx, nombre: pt.name, label: pt.name,
          tipo_via: 'AV', jerarquia_via: 1,
          velocidad_maxima: Math.round(fs.freeFlowSpeed || 60),
          geometria_wgs84: { coordinates: geom },
          ultimo_flujo: {
            velocidad_promedio: Math.round(fs.currentSpeed),
            velocidad_libre: Math.round(fs.freeFlowSpeed),
            nivel_congestion: nivel,
            congestionado: nivel === 'ALTO' || nivel === 'SEVERO',
            fuente: 'tomtom-api',
            timestamp: new Date().toISOString(),
            confidence: fs.confidence,
          }
        };
      })
    );
    return results.filter(r => r.status === 'fulfilled' && r.value != null).map(r => r.value);
  }, []);

  // ─── Cargar datos (mock INMEDIATO, luego backend/TomTom en background) ───
  const fetchData = useCallback(async () => {
    setLoading(true);
    setError(null);

    // 1. Mostrar mock INMEDIATAMENTE para que el mapa no se vea vacío
    const mock = generarMockFlujo();
    setSegments(mock);
    setEvents(generarMockEventos(mock));
    setLastUpdate(new Date().toLocaleTimeString() + ' (demo)');
    setError('demo');
    setLoading(false);

    // 2. Intentar backend REST en background
    try {
      const res = await axios.get(`${API_URL}/segments/?limit=100`, { timeout: 3000 });
      if (!isMountedRef.current) return;
      let data = res.data.results || res.data || [];
      if (Array.isArray(data) && data.length > 0) {
        setSegments(data);
        try {
          const evRes = await axios.get(`${API_URL}/congestion-events/?active=true`, { timeout: 2000 });
          if (!isMountedRef.current) return;
          setEvents(evRes.data.results || evRes.data || []);
        } catch { /* events opcionales */ }
        setLastUpdate(new Date().toLocaleTimeString());
        setError(null);
        return;
      }
    } catch { /* backend no disponible */ }

    // 3. TomTom directo en background (paralelo con timeout reducido)
    if (TOMTOM_KEY) {
      try {
        const tomtomData = await fetchTomTom();
        if (!isMountedRef.current) return;
        if (tomtomData.length >= 3) {
          const mockSegs = generarMockFlujo();
          const merged = [...tomtomData, ...mockSegs.filter(s => !tomtomData.find(t => t.nombre === s.nombre))];
          setSegments(merged);
          setEvents(generarMockEventos(merged));
          setLastUpdate(new Date().toLocaleTimeString() + ' (tomtom)');
          setError(null);
        }
      } catch { /* fallback queda el mock */ }
    }
  }, []);

  // ─── Polling ───
  useEffect(() => {
    fetchData();
    const interval = setInterval(fetchData, controls.realTime ? 15000 : 45000);
    return () => clearInterval(interval);
  }, [fetchData, controls.realTime]);

  // ─── Auto-detectar alertas + ruta alternativa automática ───
  useEffect(() => {
    if (!controls.autoAlerts) return;
    const severe = segments.filter(s => s.ultimo_flujo?.nivel_congestion === 'SEVERO');
    const severeCount = severe.length;
    const altos = segments.filter(s => s.ultimo_flujo?.nivel_congestion === 'ALTO');
    const totalCongestion = severeCount + altos.length;

    // Mostrar alerta si hay NUEVA congestión severa
    if (severeCount > prevSevereRef.current) {
      const nuevas = severe.slice(prevSevereRef.current);
      const msg = nuevas.map(s => `${s.nombre}`).join(', ');
      setCurrentAlert({
        message: `🚨 Congestión severa detectada en: ${msg}`,
        nivel: 'SEVERO',
        count: severeCount,
      });
      setTimeout(() => setCurrentAlert(null), 6000);

      // ⚡ Ruta alternativa AUTOMÁTICA: para la primera vía severa nueva
      const primeraSevera = nuevas[0];
      const autoRoute = AUTO_ROUTES.find(r =>
        primeraSevera.nombre?.toLowerCase().includes(r.whenCongested.toLowerCase())
      );
      if (autoRoute) {
        // ⚡ PRIMERO calcular ruta congestionada (setea congestedRouteTime)
        calculateCongestedRouteRef.current(autoRoute.originKeyword, autoRoute.destKeyword, primeraSevera.nombre);
        // ⚡ DESPUÉS calcular alternativa (usa congestedRouteTime como tiempo original)
        executeRouteRef.current(autoRoute.originKeyword, autoRoute.destKeyword, autoRoute.label);
        setAutoRouteInfo({ via: primeraSevera.nombre, label: autoRoute.label });
      }
    }
    prevSevereRef.current = severeCount;
  }, [segments, controls.autoAlerts]);

  // ─── Auto-clear ruta cuando no hay congestión ───
  useEffect(() => {
    if (!controls.autoAlerts) return;
    const hayCongestion = segments.some(s =>
      s.ultimo_flujo?.nivel_congestion === 'ALTO' || s.ultimo_flujo?.nivel_congestion === 'SEVERO'
    );
    if (!hayCongestion && routeResult) {
      setRouteResult(null);
      setRouteOriginCoords(null);
      setRouteDestCoords(null);
      setAutoRouteInfo(null);
      setCongestedRouteCoords([]);
      setCongestedRouteTime(null);
      setCongestedRouteDist(null);
      setRouteVias([]);
      congestedRouteTimeRef.current = null;
    }
  }, [segments, controls.autoAlerts, routeResult]);

  // ─── Segmentos filtrados ───
  const visibleSegments = controls.soloCongestion
    ? segments.filter(s => s.ultimo_flujo?.nivel_congestion === 'ALTO' || s.ultimo_flujo?.nivel_congestion === 'SEVERO')
    : segments;

  // Cuando hay una ruta activa, filtrar para mostrar SOLO los segmentos
  // que forman parte del corredor de la ruta congestionada (origen → congestión → destino)
  const routeCorridorSegments = routeVias.length > 0 && autoRouteInfo
    ? visibleSegments.filter(s => {
        if (!s.nombre) return false;
        const clean = (n) => n.toLowerCase().replace(/^(av|cr|cl|tv)\s+/i, '').trim();
        const sClean = clean(s.nombre);
        return routeVias.some(v => {
          const vClean = clean(v);
          return sClean.includes(vClean) || vClean.includes(sClean);
        });
      })
    : visibleSegments;

  // ─── Buscar vía por texto (input del usuario) ───
  const findVia = (text) => {
    if (!text?.trim()) return null;
    const lower = text.toLowerCase().trim();
    
    // 1. Búsqueda exacta por nombre
    let match = VIAS_PRINCIPALES.find(v => v.nombre.toLowerCase() === lower);
    if (match) return match;

    // 2. Búsqueda por keywords
    match = VIAS_PRINCIPALES.find(v => v.keywords.some(k => lower.includes(k)));
    if (match) return match;

    // 3. Búsqueda parcial en el nombre
    match = VIAS_PRINCIPALES.find(v => v.nombre.toLowerCase().includes(lower) || lower.includes(v.nombre.toLowerCase().split(' ')[0]));
    if (match) return match;

    // 4. Búsqueda por palabra más larga común
    const words = lower.split(/\s+/);
    for (const word of words) {
      if (word.length < 3) continue;
      match = VIAS_PRINCIPALES.find(v => 
        v.nombre.toLowerCase().includes(word) || v.keywords.some(k => k.includes(word))
      );
      if (match) return match;
    }

    return null;
  };

  // ─── Calcular distancia entre dos puntos (Haversine) ───
  const haversineKm = (lat1, lng1, lat2, lng2) => {
    const R = 6371;
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLng = (lng2 - lng1) * Math.PI / 180;
    const a = Math.sin(dLat/2)**2 + Math.cos(lat1*Math.PI/180) * Math.cos(lat2*Math.PI/180) * Math.sin(dLng/2)**2;
    return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
  };

  // ─── Detectar si una vía tiene congestión ───
  const viaCongestionada = (nombreVia) => {
    const seg = segments.find(s => {
      if (!s.nombre) return false;
      const viaClean = nombreVia.toLowerCase().replace('av ','').replace('cr ','').trim();
      const segClean = s.nombre.toLowerCase().replace('av ','').replace('cr ','').trim();
      return viaClean.includes(segClean) || segClean.includes(viaClean);
    });
    if (!seg?.ultimo_flujo) return false;
    return seg.ultimo_flujo.nivel_congestion === 'ALTO' || seg.ultimo_flujo.nivel_congestion === 'SEVERO';
  };

  // ─── Consultar TomTom Routing API ───
  // Soporta:
  //   - withTraffic: true/false (incluir/ignorar tráfico)
  //   - routeType: 'fastest' | 'shortest'
  //   - waypointPt: punto intermedio opcional para forzar el paso por una zona
  const fetchTomTomRoute = useCallback(async (originPt, destPt, withTraffic = true, routeType = 'fastest', waypointPt = null) => {
    if (!TOMTOM_KEY) return null;
    try {
      const originStr = `${originPt[0]},${originPt[1]}`; // lat,lng
      const destStr = `${destPt[0]},${destPt[1]}`;
      const waypointStr = waypointPt ? `:${waypointPt[0]},${waypointPt[1]}` : '';
      const res = await axios.get(
        `https://api.tomtom.com/routing/1/calculateRoute/${originStr}${waypointStr}:${destStr}/json`,
        {
          params: {
            key: TOMTOM_KEY,
            traffic: withTraffic,
            routeType: routeType,
            travelMode: 'car',
            computeTravelTimeFor: 'all',
          },
            timeout: 4000,
          }
        );
      const route = res.data?.routes?.[0];
      if (!route?.summary) return null;

      // Extraer coordenadas del recorrido real
      const points = route.legs?.flatMap(leg => leg.points || []) || [];
      const coordinates = points.map(p => [p.longitude, p.latitude]); // [lng, lat] para GeoJSON

      // Summary: sin tráfico (tiempo base) vs con tráfico (tiempo real)
      const baseTime = route.summary.travelTimeInSeconds;       // sin tráfico
      const trafficDelay = route.summary.trafficDelayInSeconds || 0;
      const realTime = baseTime + trafficDelay;                  // con tráfico actual

      return {
        coordinates,
        distance_m: route.summary.lengthInMeters,
        duration_base_sec: baseTime,
        duration_traffic_sec: realTime,
        trafficDelay_sec: trafficDelay,
      };
    } catch {
      return null;
    }
  }, []);

  // ─── Calcular ruta alternativa (origenKeyword, destinoKeyword, label opcional) ───
  // Intenta TomTom Routing API; si falla, usa fallback mock con vías concatenadas
  const executeRoute = useCallback(async (originKeyword, destKeyword, label) => {
    setRouteError(null);
    setRouteResult(null);
    setRouteOriginCoords(null);
    setRouteDestCoords(null);

    const fromVia = findVia(originKeyword);
    const toVia = findVia(destKeyword);

    if (!fromVia || !toVia) {
      setRouteError('No se pudo calcular ruta automática para esta congestión');
      return;
    }

    // Tomar punto inicial de la vía origen y punto final de la vía destino
    const originPt = fromVia.coords[0];
    const destPt = toVia.coords[toVia.coords.length - 1];

    // ─── 1. Intentar TomTom Routing API ───
    const tomtomRoute = await fetchTomTomRoute(originPt, destPt);
    if (!isMountedRef.current) return;

    if (tomtomRoute) {
      const distanciaKm = Math.round(tomtomRoute.distance_m / 10) / 100;

      // ⚡ CORREGIDO: tiempo ORIGINAL = ruta congestionada (más lenta por el tráfico)
      // tiempo ALTERNATIVO = ruta que TomTom sugiere evitando la congestión (más rápida)
      const tiempoOrigSeg = congestedRouteTimeRef.current || tomtomRoute.duration_traffic_sec;
      const tiempoAltSeg = tomtomRoute.duration_traffic_sec;
      const ahorroSeg = Math.max(tiempoOrigSeg - tiempoAltSeg, 0);
      const ahorroPct = tiempoOrigSeg > 0 ? (ahorroSeg / tiempoOrigSeg) * 100 : 0;

      setRouteResult({
        coordenadas_trayecto: JSON.stringify({
          type: 'LineString',
          coordinates: tomtomRoute.coordinates, // ya en [lng, lat]
        }),
        tiempo_estimado_original: tiempoOrigSeg,
        tiempo_estimado_alterno: tiempoAltSeg,
        ahorro_porcentaje: Math.round(ahorroPct * 10) / 10,
        ahorro_segundos: ahorroSeg,
        distancia_km: distanciaKm,
        cumple_regla: ahorroPct >= 15 || ahorroSeg >= 300,
        ruta_label: label || `${fromVia.nombre} → ${toVia.nombre}`,
        vias_evitadas: 0,
        source: 'tomtom-routing',
      });
      setRouteOriginCoords(originPt);
      setRouteDestCoords(destPt);
      return;
    }

    // ─── 2. Fallback: ruta mock (concatenar vías evitando congestión) ───
    // La ruta alternativa busca vías LIBRES (sin congestión) para ser más rápida
    const viasLibres = VIAS_PRINCIPALES.filter(v => 
      v.nombre !== fromVia.nombre && v.nombre !== toVia.nombre && !viaCongestionada(v.nombre)
    );

    let rutaAltPoints = [...fromVia.coords];
    let viasUsadas = [fromVia.nombre];

    const pickIntermediate = (targetPt) => {
      let best = null;
      let bestDist = Infinity;
      const lastPt = rutaAltPoints[rutaAltPoints.length - 1];
      for (const v of viasLibres) {
        if (viasUsadas.includes(v.nombre)) continue;
        const dist = haversineKm(lastPt[0], lastPt[1], v.coords[0][0], v.coords[0][1]);
        const distToTarget = haversineKm(v.coords[v.coords.length-1][0], v.coords[v.coords.length-1][1], targetPt[0], targetPt[1]);
        if (dist + distToTarget < bestDist) {
          bestDist = dist + distToTarget;
          best = v;
        }
      }
      return best;
    };

    const inter1 = pickIntermediate(destPt);
    if (inter1) {
      rutaAltPoints = [...rutaAltPoints, ...inter1.coords];
      viasUsadas.push(inter1.nombre);
    }

    const inter2 = pickIntermediate(destPt);
    if (inter2 && !viasUsadas.includes(inter2.nombre)) {
      rutaAltPoints = [...rutaAltPoints, ...inter2.coords];
      viasUsadas.push(inter2.nombre);
    }

    rutaAltPoints = [...rutaAltPoints, ...toVia.coords];

    // Distancia de la ruta alternativa (MÁS larga porque evita congestión)
    let distAlternativa = 0;
    for (let i = 1; i < rutaAltPoints.length; i++) {
      distAlternativa += haversineKm(rutaAltPoints[i-1][0], rutaAltPoints[i-1][1], rutaAltPoints[i][0], rutaAltPoints[i][1]);
    }

    // ⚡ CORREGIDO: usar congestedRouteTimeRef como tiempo original (congestionado)
    // y calcular tiempo alternativo (vías libres = más rápido)
    const tiempoOrigSeg = congestedRouteTimeRef.current || Math.round((distAlternativa / 25) * 3600);
    const velAlternativa = 40 + Math.random() * 15; // vías libres = más rápido
    const tiempoAltSeg = Math.round((distAlternativa / velAlternativa) * 3600);
    const ahorroSeg = Math.max(tiempoOrigSeg - tiempoAltSeg, 0);
    const ahorroPct = tiempoOrigSeg > 0 ? (ahorroSeg / tiempoOrigSeg) * 100 : 0;

    setRouteResult({
      coordenadas_trayecto: JSON.stringify({
        type: 'LineString',
        coordinates: rutaAltPoints.map(c => [c[1], c[0]]),
      }),
      tiempo_estimado_original: tiempoOrigSeg,
      tiempo_estimado_alterno: tiempoAltSeg,
      ahorro_porcentaje: Math.round(ahorroPct * 10) / 10,
      ahorro_segundos: ahorroSeg,
      distancia_km: Math.round(distAlternativa * 10) / 10,
      cumple_regla: ahorroPct >= 15 || ahorroSeg >= 300,
      ruta_label: label || `${fromVia.nombre} → ${toVia.nombre}`,
      vias_evitadas: viasUsadas.filter(v => viaCongestionada(v)).length,
      source: 'mock',
    });
    setRouteOriginCoords(originPt);
    setRouteDestCoords(destPt);
  }, [segments, fetchTomTomRoute]);

  // Sincronizar executeRoute al ref para romper ciclo de dependencias en effects
  executeRouteRef.current = executeRoute;

  // ─── Factor de congestión: qué tan lento va respecto a velocidad libre ───
  const getCongestionFactor = useCallback((congestedRoadName) => {
    const cleanName = (n) => n.toLowerCase().replace(/^(av|cr|cl|tv)\s+/i, '').trim();
    const seg = segments.find(s => {
      if (!s.nombre || !congestedRoadName) return false;
      const a = cleanName(s.nombre);
      const b = cleanName(congestedRoadName);
      return a.includes(b) || b.includes(a);
    });
    if (seg?.ultimo_flujo?.velocidad_libre && seg?.ultimo_flujo?.velocidad_promedio) {
      const ratio = seg.ultimo_flujo.velocidad_libre / seg.ultimo_flujo.velocidad_promedio;
      return Math.max(ratio, 1.0); // mínimo 1x (sin congestión no se escala)
    }
    return 1.5; // default 1.5x si no hay datos de la vía
  }, [segments]);

  // ─── Calcular ruta congestionada ───
  // ESTRATEGIA:
  //   1. PRIMERO intenta TomTom Routing con routeType='shortest' (ruta normal/más corta)
  //      y un waypoint forzado por la vía congestionada, SIN tráfico.
  //      Así la ruta sigue la vial REAL del mapa y es DISTINTA a la alternativa
  //      (que usa routeType='fastest' CON tráfico).
  //   2. SI TomTom FALLA, cae en fallback manual con geometría de segmentos (geometria_wgs84).
  const calculateCongestedRoute = useCallback(async (originKeyword, destKeyword, congestedRoadName) => {
    const fromVia = findVia(originKeyword);
    const toVia = findVia(destKeyword);
    const congestedVia = findVia(congestedRoadName);
    if (!fromVia || !toVia) return;

    const originPt = fromVia.coords[0];
    const destPt = toVia.coords[toVia.coords.length - 1];

    // Guardar las vías que componen este corredor para filtrar segmentos visibles
    const viasCorredor = [fromVia.nombre];
    if (congestedVia) viasCorredor.push(congestedVia.nombre);
    if (toVia.nombre !== fromVia.nombre) viasCorredor.push(toVia.nombre);
    setRouteVias(viasCorredor);

    // ─── 1. Intentar TomTom: shortest × sin_tráfico × waypoint por vía congestionada ───
    // La ruta más corta (routeType='shortest') es intrínsecamente DISTINTA a la más rápida
    // (routeType='fastest') que usa la alternativa. Además, el waypoint fuerza el paso
    // por la zona congestionada, y traffic=false ignora el tráfico (TomTom no desvía la ruta).
    if (TOMTOM_KEY) {
      const congestedMidpoint = congestedVia
        ? congestedVia.coords[Math.floor(congestedVia.coords.length / 2)]
        : null;

      const tomtomRoute = await fetchTomTomRoute(
        originPt, destPt,
        false,           // traffic = false (ignorar condiciones de tráfico)
        'shortest',      // routeType = shortest (ruta normal, no la más rápida)
        congestedMidpoint // waypoint forzado por la zona congestionada
      );

      if (tomtomRoute && tomtomRoute.distance_m > 0) {
        // Convertir coordenadas TomTom ([lng, lat]) a [lat, lng] para Leaflet
        const routeLatLng = tomtomRoute.coordinates.map(c => [c[1], c[0]]);
        setCongestedRouteCoords(routeLatLng);

        // Distancia real de TomTom (precisa, sobre la ruta vial)
        setCongestedRouteDist(tomtomRoute.distance_m);

        // Tiempo congestionado = tiempo base sin tráfico × factor de congestión
        // Esto estima cuánto tardaría realmente esta ruta bajo condiciones de congestión
        const factor = getCongestionFactor(congestedRoadName);
        const estimatedTime = Math.round(tomtomRoute.duration_base_sec * factor);
        congestedRouteTimeRef.current = estimatedTime;
        setCongestedRouteTime(estimatedTime);

        return; // ✅ TomTom success — salir
      }
    }

    // ─── 2. Fallback manual: geometría de segmentos del mapa ───
    // (conserva la lógica anterior por si TomTom no está disponible)
    const getSegCoords = (viaNombre) => {
      if (!viaNombre) return null;
      const clean = (n) => n.toLowerCase().replace(/^(av|cr|cl|tv)\s+/i, '').trim();
      const targetClean = clean(viaNombre);
      const seg = segments.find(s => {
        if (!s.nombre) return false;
        const sClean = clean(s.nombre);
        return targetClean.includes(sClean) || sClean.includes(targetClean);
      });
      if (seg?.geometria_wgs84?.coordinates?.length >= 2) {
        return seg.geometria_wgs84.coordinates.map(c => [c[1], c[0]]);
      }
      return null;
    };

    const fromCoords = getSegCoords(fromVia.nombre) || fromVia.coords;
    const congestedCoords = congestedVia
      ? (getSegCoords(congestedVia.nombre) || congestedVia.coords)
      : null;
    const toCoords = getSegCoords(toVia.nombre) || toVia.coords;

    let rutaPoints = [originPt, ...clipViaToRange(fromCoords, originPt, destPt, 0)];

    if (congestedCoords && congestedVia &&
        congestedVia.nombre !== fromVia.nombre &&
        congestedVia.nombre !== toVia.nombre) {
      rutaPoints = [...rutaPoints, ...clipViaToRange(congestedCoords, originPt, destPt, 0)];
    }

    rutaPoints = [...rutaPoints, ...clipViaToRange(toCoords, originPt, destPt, 0), destPt];

    setCongestedRouteCoords(rutaPoints);

    let distTotal = 0;
    for (let i = 1; i < rutaPoints.length; i++) {
      distTotal += haversineKm(rutaPoints[i-1][0], rutaPoints[i-1][1], rutaPoints[i][0], rutaPoints[i][1]);
    }
    setCongestedRouteDist(distTotal * 1000);

    const factor = getCongestionFactor(congestedRoadName);
    const velocidadBase = 50;
    const tiempoBaseSeg = Math.round((distTotal / velocidadBase) * 3600);
    const estimatedTime = Math.round(tiempoBaseSeg * factor);
    congestedRouteTimeRef.current = estimatedTime;
    setCongestedRouteTime(estimatedTime);
  }, [getCongestionFactor, segments, fetchTomTomRoute]);

  const calculateCongestedRouteRef = useRef(null);
  calculateCongestedRouteRef.current = calculateCongestedRoute;

  // ─── Coordenadas ruta ───
  const routeCoords = routeResult?.coordenadas_trayecto ? (() => {
    try {
      const p = typeof routeResult.coordenadas_trayecto === 'string'
        ? JSON.parse(routeResult.coordenadas_trayecto)
        : routeResult.coordenadas_trayecto;
      return p.coordinates?.map(c => [c[1], c[0]]) || [];
    } catch { return []; }
  })() : [];

  // ─── Estadísticas rápidas ───
  const severos = segments.filter(s => s.ultimo_flujo?.nivel_congestion === 'SEVERO').length;
  const altos = segments.filter(s => s.ultimo_flujo?.nivel_congestion === 'ALTO').length;
  const velocidades = segments
    .map(s => s.ultimo_flujo?.velocidad_promedio)
    .filter(Boolean);
  const velProm = velocidades.length
    ? `${(velocidades.reduce((a, b) => a + b, 0) / velocidades.length).toFixed(0)} km/h`
    : '—';

  return (
    <div className="relative w-full h-full">
      {/* ─── MAPA ─── */}
      <MapContainer
        center={MEDELLIN_CENTER}
        zoom={12}
        style={{ height: '100%', width: '100%' }}
        className="rounded-xl"
        zoomControl={true}
      >
        <TileLayer
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OSM</a>'
        />

        <MapCenterer segments={segments} />

        {/* ─── Segmentos viales coloreados por congestión (solo corredor de ruta activa) ─── */}
        {routeCorridorSegments.map(seg => {
          const coords = getSegmentCoords(seg);
          if (!coords.length) return null;
          const flujo = seg.ultimo_flujo;
          const nivel = flujo?.nivel_congestion || 'SIN_DATO';
          const style = CONGESTION_STYLES[nivel] || CONGESTION_STYLES.SIN_DATO;
          const mid = getSegmentMidpoint(coords);

          return (
            <React.Fragment key={seg.id || Math.random()}>
              <Polyline
                positions={coords}
                pathOptions={{
                  color: style.color,
                  weight: style.weight,
                  opacity: style.opacity,
                }}
              />
              {/* Indicador de alerta en segmentos SEVERO */}
              {nivel === 'SEVERO' && mid && (
                <CircleMarker
                  center={mid}
                  radius={8}
                  pathOptions={{
                    color: '#DC2626',
                    fillColor: '#FECACA',
                    fillOpacity: 0.6,
                    weight: 2,
                  }}
                >
                  <Tooltip permanent direction="top" offset={[0, -8]}>
                    <span className="text-[10px] font-bold text-red-700">
                      🔴 {seg.nombre}
                    </span>
                  </Tooltip>
                </CircleMarker>
              )}
              {/* Label de velocidad en vías principales */}
              {controls.showSpeed && mid && nivel !== 'SIN_DATO' && (
                <CircleMarker
                  center={mid}
                  radius={3}
                  pathOptions={{
                    color: style.markerColor,
                    fillColor: '#fff',
                    fillOpacity: 0.8,
                    weight: 2,
                  }}
                >
                  <Tooltip permanent direction="top" offset={[0, -10]}>
                    <span className={`text-[10px] font-bold px-1 py-0.5 rounded`}
                      style={{ color: style.color, backgroundColor: 'rgba(255,255,255,0.9)' }}>
                      {seg.nombre} · {flujo?.velocidad_promedio} km/h
                    </span>
                  </Tooltip>
                </CircleMarker>
              )}
            </React.Fragment>
          );
        })}

        {/* ─── Ruta alternativa ─── */}
        {controls.showRoutes && routeCoords.length > 1 && (
          <Polyline
            positions={routeCoords}
            pathOptions={{
              color: '#8B5CF6',
              weight: 5,
              opacity: 0.75,
              dashArray: '10, 10',
            }}
          >
            <Tooltip permanent direction="top" className="bg-purple-700 border-0 text-white text-xs font-bold px-2 py-1 rounded shadow-lg">
              🟣 {routeResult?.ruta_label || 'Ruta alternativa'}
            </Tooltip>
          </Polyline>
        )}

        {/* ─── Ruta congestionada (original) ─── */}
        {controls.showRoutes && congestedRouteCoords.length > 1 && (
          <Polyline
            positions={congestedRouteCoords}
            pathOptions={{
              color: '#DC2626',
              weight: 6,
              opacity: 0.6,
              dashArray: '8, 6',
            }}
          >
            <Tooltip permanent direction="top" className="bg-red-700 border-0 text-white text-xs font-bold px-2 py-1 rounded shadow-lg">
              🔴 {autoRouteInfo?.via || 'Ruta congestionada'}
            </Tooltip>
          </Polyline>
        )}

        {/* ─── Marcadores de origen y destino de la ruta ─── */}
        {controls.showRoutes && routeOriginCoords && (
          <Marker position={routeOriginCoords}>
            <Tooltip permanent direction="right" className="bg-green-600 border-0 text-white text-xs font-bold px-2 py-1 rounded shadow-lg">
              🟢 Origen
            </Tooltip>
          </Marker>
        )}
        {controls.showRoutes && routeDestCoords && (
          <Marker position={routeDestCoords}>
            <Tooltip permanent direction="left" className="bg-red-600 border-0 text-white text-xs font-bold px-2 py-1 rounded shadow-lg">
              🔴 Destino
            </Tooltip>
          </Marker>
        )}
      </MapContainer>

      {/* ─── Leyenda (fuera de MapContainer) ─── */}
      {controls.showLegend && (
        <div className="absolute bottom-4 left-4 z-[1000] bg-slate-900/90 backdrop-blur rounded-xl border border-slate-700 p-3 text-xs shadow-xl min-w-[150px]">
          <div className="font-bold text-white flex items-center gap-1.5 mb-2">
            <Layers className="w-3.5 h-3.5 text-amber-400" /> Congestión
          </div>
          {Object.entries(CONGESTION_STYLES).map(([key, val]) => (
            <div key={key} className="flex items-center gap-2 py-0.5">
              <div className="w-4 h-1 rounded-full" style={{ backgroundColor: val.color }} />
              <span className="text-slate-300">{val.label}</span>
            </div>
          ))}
          <hr className="my-1.5 border-slate-700" />
          <div className="flex items-center gap-2 py-0.5">
            <div style={{ borderTop: '2px dashed #8B5CF6', width: 16, height: 0 }} />
            <span className="text-slate-300">Ruta alterna</span>
          </div>
          <div className="flex items-center gap-2 py-0.5">
            <div style={{ borderTop: '2px dashed #DC2626', width: 16, height: 0 }} />
            <span className="text-slate-300">Ruta congestionada</span>
          </div>
          <div className="flex items-center gap-2 py-0.5">
            <div className="w-3 h-3 rounded-full bg-red-500 animate-pulse" />
            <span className="text-slate-300">Alerta severa</span>
          </div>
        </div>
      )}

      {/* ─── Alerta de congestión ─── */}
      {currentAlert && (
        <div className="absolute top-4 left-1/2 -translate-x-1/2 z-[1000] animate-pulse">
          <div className="bg-red-600/90 backdrop-blur border border-red-400 text-white px-5 py-3 rounded-xl shadow-2xl flex items-center gap-3 text-sm font-bold">
            <AlertTriangle className="w-5 h-5 flex-shrink-0" />
            <span>{currentAlert.message}</span>
          </div>
        </div>
      )}

      {/* ─── Badge: fuente de datos ─── */}
      <div className="absolute top-4 right-4 z-[1000] flex items-center gap-2">
        {error === 'demo' ? (
          <span className="bg-amber-500/90 text-slate-900 px-3 py-1.5 rounded-full text-xs font-bold shadow-lg backdrop-blur flex items-center gap-1.5">
            <WifiOff className="w-3 h-3" /> Demo
          </span>
        ) : lastUpdate?.includes('tomtom') ? (
          <span className="bg-blue-600/90 text-white px-3 py-1.5 rounded-full text-xs font-bold shadow-lg backdrop-blur flex items-center gap-1.5">
            <Activity className="w-3 h-3" /> TomTom Direct
          </span>
        ) : segments.length > 0 ? (
          <span className="bg-green-600/90 text-white px-3 py-1.5 rounded-full text-xs font-bold shadow-lg backdrop-blur flex items-center gap-1.5">
            <Activity className="w-3 h-3" /> API Backend
          </span>
        ) : null}
        {lastUpdate && (
          <span className="bg-slate-800/80 text-slate-400 px-2.5 py-1.5 rounded-lg text-xs backdrop-blur">
            ↻ {lastUpdate}
          </span>
        )}
      </div>

      {/* ─── PANEL DE CONTROL ─── */}
      <div className={`absolute top-20 right-4 z-[1000] transition-all duration-300 ${
        controls.panelOpen ? 'w-64' : 'w-10'
      }`}>
        <button
          onClick={() => toggle('panelOpen')}
          className="w-full flex items-center justify-between bg-slate-900/90 backdrop-blur-md border border-slate-700 text-white px-3 py-2.5 rounded-t-xl hover:bg-slate-800/90 transition cursor-pointer"
        >
          {controls.panelOpen ? (
            <>
              <span className="text-sm font-bold flex items-center gap-2">
                <Activity className="w-4 h-4 text-amber-400" />
                Control
              </span>
              <ChevronDown className="w-4 h-4" />
            </>
          ) : (
            <Activity className="w-5 h-5 text-amber-400 mx-auto" />
          )}
        </button>

        {controls.panelOpen && (
          <div className="bg-slate-900/90 backdrop-blur-md border-x border-b border-slate-700 rounded-b-xl p-3 space-y-2.5 max-h-[70vh] overflow-y-auto">
            {/* KPIs */}
            <div className="grid grid-cols-2 gap-1.5 mb-1">
              <KPI label="Severo" value={severos} color="#DC2626" />
              <KPI label="Alto" value={altos} color="#EA580C" />
              <KPI label="Total vías" value={visibleSegments.length} color="#94A3B8" />
              <KPI label="Vel. prom" value={velProm} color="#22C55E" />
            </div>

            {/* Toggles */}
            <div className="space-y-0.5 pt-1 border-t border-slate-700">
              <ToggleRow
                icon={<AlertTriangle className="w-3.5 h-3.5" />}
                label="Solo congestión activa"
                enabled={controls.soloCongestion}
                onClick={() => toggle('soloCongestion')}
                desc={controls.soloCongestion ? 'Solo ALTO/SEVERO' : 'Todas las vías'}
              />
              <ToggleRow
                icon={<Gauge className="w-3.5 h-3.5" />}
                label="Velocidades en vías"
                enabled={controls.showSpeed}
                onClick={() => toggle('showSpeed')}
              />
              <ToggleRow
                icon={<Route className="w-3.5 h-3.5" />}
                label="Rutas alternativas"
                enabled={controls.showRoutes}
                onClick={() => toggle('showRoutes')}
              />
              <ToggleRow
                icon={<Activity className="w-3.5 h-3.5" />}
                label="Alertas automáticas"
                enabled={controls.autoAlerts}
                onClick={() => toggle('autoAlerts')}
              />
              <ToggleRow
                icon={<Layers className="w-3.5 h-3.5" />}
                label="Leyenda"
                enabled={controls.showLegend}
                onClick={() => toggle('showLegend')}
              />
              <ToggleRow
                icon={<RefreshCw className="w-3.5 h-3.5" />}
                label="Tiempo real (15s)"
                enabled={controls.realTime}
                onClick={() => toggle('realTime')}
                desc={controls.realTime ? 'C/15 seg' : 'C/45 seg'}
              />
            </div>

            {/* Botón actualizar */}
            <button
              onClick={fetchData}
              disabled={loading}
              className="w-full flex items-center justify-center gap-2 bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-bold py-2 rounded-lg transition border border-slate-700 disabled:opacity-50 cursor-pointer"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
              {loading ? 'Cargando...' : 'Actualizar datos'}
            </button>

            {/* ─── Ruta alternativa automática ─── */}
            {routeError && (
              <div className="bg-red-900/60 border border-red-700 rounded-lg p-2 text-[10px] text-red-300">
                ⚠️ {routeError}
              </div>
            )}

            {routeResult && (
              <div className="bg-slate-800 rounded-lg p-2 text-[11px] space-y-0.5 border border-purple-500/50">
                <div className="flex items-center justify-between mb-1">
                  <div className="text-purple-400 font-bold text-xs flex items-center gap-1">
                    <Navigation className="w-3 h-3" />
                    {routeResult.ruta_label}
                  </div>
                  <div className="flex items-center gap-1">
                    {routeResult.source === 'tomtom-routing' ? (
                      <span className="text-[9px] text-blue-400 bg-blue-400/10 px-1.5 py-0.5 rounded-full">
                        TomTom
                      </span>
                    ) : (
                      <span className="text-[9px] text-amber-500 bg-amber-500/10 px-1.5 py-0.5 rounded-full">
                        Mock
                      </span>
                    )}
                    {autoRouteInfo && (
                      <span className="text-[9px] text-amber-400 bg-amber-400/10 px-1.5 py-0.5 rounded-full">
                        {autoRouteInfo.via}
                      </span>
                    )}
                  </div>
                </div>
                <div className="flex justify-between text-slate-300">
                  <span className="text-red-400">🔴 Ruta congestionada:</span>
                  <span className="text-red-400 font-bold">{Math.round(routeResult.tiempo_estimado_original / 60)} min</span>
                </div>
                <div className="flex justify-between text-slate-300">
                  <span className="text-purple-400">🟣 Ruta alternativa:</span>
                  <span className="text-green-400 font-bold">{Math.round(routeResult.tiempo_estimado_alterno / 60)} min</span>
                </div>
                <div className="flex justify-between text-slate-300">
                  <span>Ahorro:</span>
                  <span className="text-purple-400 font-bold">{routeResult.ahorro_porcentaje}% ({Math.round(routeResult.ahorro_segundos / 60)} min)</span>
                </div>
                {congestedRouteDist != null && (
                  <div className="flex justify-between text-slate-300">
                    <span>Dist. congestionada:</span>
                    <span className="text-red-400">{Math.round(congestedRouteDist / 10) / 100} km</span>
                  </div>
                )}
                <div className="flex justify-between text-slate-300">
                  <span>Dist. alternativa:</span>
                  <span className="text-purple-400">{routeResult.distancia_km} km</span>
                </div>
                <div className="flex justify-between text-slate-300">
                  <span>Vías evitadas:</span>
                  <span className="text-green-400">{routeResult.vias_evitadas} con congestión</span>
                </div>
                {routeResult.cumple_regla && (
                  <div className="text-green-400 text-[10px] mt-1">✅ Ahorro mínimo garantizado (≥15% o ≥5 min)</div>
                )}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Mini componentes ───
function KPI({ label, value, color }) {
  return (
    <div className="bg-slate-800 rounded-lg p-1.5 text-center">
      <div className="text-base font-bold" style={{ color }}>{value}</div>
      <div className="text-[9px] text-slate-400 uppercase tracking-wider">{label}</div>
    </div>
  );
}

function ToggleRow({ icon, label, enabled, onClick, desc }) {
  return (
    <button
      onClick={onClick}
      className="w-full flex items-center justify-between px-2 py-1.5 rounded-lg hover:bg-slate-800/80 transition text-xs group cursor-pointer"
    >
      <span className="flex items-center gap-2">
        <span className={enabled ? 'text-amber-400' : 'text-slate-600'}>{icon}</span>
        <span className="text-slate-300">{label}</span>
        {desc && <span className="text-[9px] text-slate-500 ml-0.5">({desc})</span>}
      </span>
      {enabled
        ? <ToggleRight className="w-4 h-4 text-amber-400" />
        : <ToggleLeft className="w-4 h-4 text-slate-600" />
      }
    </button>
  );
}
