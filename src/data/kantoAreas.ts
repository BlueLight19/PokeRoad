// Static zone data for the Kanto 2D world map
// Coordinates are percentages (0-100) mapped to the Kanto_map.png terrain image (2390x1792)

export interface KantoArea {
  id: string;
  name: string;
  zoneIds: string[];
}

export const KANTO_AREAS: KantoArea[] = [
  { id: 'bourg-palette', name: 'Bourg Palette & Route 1', zoneIds: ['bourg-palette', 'route-1'] },
  { id: 'jadielle', name: 'Jadielle & Foret de Jade', zoneIds: ['jadielle', 'route-22', 'route-2', 'foret-jade'] },
  { id: 'argenta', name: 'Argenta & Mont Selenite', zoneIds: ['argenta', 'route-3', 'mt-moon', 'route-4'] },
  { id: 'azuria', name: 'Azuria & Ponts', zoneIds: ['azuria', 'route-24', 'route-25'] },
  { id: 'carmin', name: 'Carmin sur Mer & Environs', zoneIds: ['route-5', 'route-6', 'carmin', 'route-11', 'cave-diglett'] },
  { id: 'lavanville', name: 'Lavanville & Tunnels', zoneIds: ['route-9', 'route-10', 'rock-tunnel', 'lavanville'] },
  { id: 'safrania', name: 'Safrania & Celadopole', zoneIds: ['route-8', 'safrania', 'route-7', 'celadopole'] },
  { id: 'parmanie', name: 'Parmanie & Piste Cyclable', zoneIds: ['route-16', 'route-17', 'route-18', 'parmanie', 'route-15', 'route-14', 'route-13', 'route-12'] },
  { id: 'iles', name: "Iles Ecume & Cramois'Ile", zoneIds: ['route-19', 'route-20', 'seafoam-islands', 'cramois-ile', 'pokemon-mansion', 'route-21'] },
  { id: 'ligue', name: 'Route Victoire & Ligue', zoneIds: ['power-plant', 'route-23', 'victory-road', 'plateau-indigo', 'league-hall'] },
  { id: 'postgame', name: 'Postgame', zoneIds: ['cerulean-cave'] },
];

// Zone coordinates mapped to the Kanto terrain map image (Kanto_map.png)
// Image is 2390x1792. Coordinates as percentages (x%, y%).
// Placed to match terrain features: mountains NW, plains center, coast E/S, islands SW.
export const ZONE_COORDS: Record<string, { x: number; y: number }> = {
  // ---- Indigo Plateau (top-left mountains) ----
  'plateau-indigo': { x: 13, y: 12 },
  'league-hall': { x: 13, y: 3 },
  'victory-road': { x: 13, y: 29 },
  'route-23': { x: 13, y: 42 },

  // ---- Pewter / Mt Moon corridor (upper band) ----
  'argenta': { x: 23, y: 18 },
  'route-3': { x: 33, y: 18 },
  'mt-moon': { x: 40, y: 9 },
  'route-4': { x: 47, y: 18 },

  // ---- Cerulean area (upper center-right) ----
  'cerulean-cave': { x: 52, y: 10 },
  'route-24': { x: 58, y: 8 },
  'route-25': { x: 67, y: 8 },
  'azuria': { x: 58, y: 18 },

  // ---- East: Route 9, Rock Tunnel, Power Plant ----
  'route-9': { x: 67, y: 18 },
  'rock-tunnel': { x: 76, y: 30 },
  'route-10': { x: 76, y: 38 },
  'power-plant': { x: 83, y: 38 },

  // ---- Viridian Forest corridor (left side, below Pewter) ----
  'route-2': { x: 23, y: 35 },
  'foret-jade': { x: 23, y: 31 },

  // ---- Mid band: Viridian → Celadon → Saffron → Lavender ----
  'route-22': { x: 18, y: 42 },
  'jadielle': { x: 23, y: 42 },
  'celadopole': { x: 41, y: 48 },
  'route-7': { x: 49, y: 48 },
  'safrania': { x: 58, y: 44 },
  'route-8': { x: 66, y: 44 },
  'lavanville': { x: 76, y: 45 },

  // ---- Cycling Road (west, going south) ----
  'route-16': { x: 33, y: 48 },
  'route-17': { x: 33, y: 56 },
  'route-18': { x: 38, y: 72 },

  // ---- Saffron south → Vermilion ----
  'route-5': { x: 58, y: 32 },
  'route-6': { x: 64, y: 56 },
  'carmin': { x: 63, y: 64 },
  'route-11': { x: 68, y: 61 },
  'cave-diglett': { x: 73, y: 60 },

  // ---- Silence Bridge (east coast, south from Lavender) ----
  'route-12': { x: 76, y: 55 },
  'route-13': { x: 76, y: 66 },
  'route-14': { x: 71, y: 72 },
  'route-15': { x: 67, y: 78 },

  // ---- Fuchsia ----
  'parmanie': { x: 58, y: 80 },

  // ---- Pallet Town & Route 1 ----
  'bourg-palette': { x: 23, y: 72 },
  'route-1': { x: 23, y: 62 },

  // ---- Water routes & islands (south) ----
  'route-19': { x: 58, y: 90 },
  'route-20': { x: 45, y: 90 },
  'seafoam-islands': { x: 37, y: 91 },
  'cramois-ile': { x: 25, y: 91 },
  'pokemon-mansion': { x: 21, y: 91 },
  'route-21': { x: 23, y: 82 },
};

// Connections between zones (for drawing paths on the map)
export const ZONE_CONNECTIONS: [string, string][] = [
  // Pallet → Viridian
  ['bourg-palette', 'route-1'],
  ['route-1', 'jadielle'],

  // Viridian branches
  ['jadielle', 'route-22'],
  ['jadielle', 'route-2'],

  // Viridian Forest → Pewter
  ['route-2', 'foret-jade'],
  ['foret-jade', 'argenta'],

  // Pewter → Mt Moon → Cerulean
  ['argenta', 'route-3'],
  ['route-3', 'mt-moon'],
  ['mt-moon', 'route-4'],
  ['route-4', 'azuria'],

  // Cerulean branches
  ['azuria', 'route-24'],
  ['route-24', 'route-25'],
  ['azuria', 'route-5'],
  ['azuria', 'route-9'],
  ['azuria', 'cerulean-cave'],

  // Cerulean south → Vermilion
  ['route-5', 'safrania'],
  ['route-6', 'carmin'],
  ['carmin', 'route-11'],
  ['route-11', 'cave-diglett'],

  // Route 9 → Rock Tunnel → Lavender
  ['route-9', 'rock-tunnel'],
  ['rock-tunnel', 'route-10'],
  ['route-10', 'lavanville'],
  ['route-10', 'power-plant'],

  // Lavender → Saffron → Celadon
  ['lavanville', 'route-8'],
  ['route-8', 'safrania'],
  ['safrania', 'route-7'],
  ['route-7', 'celadopole'],
  ['safrania', 'route-6'],

  // Cycling Road
  ['celadopole', 'route-16'],
  ['route-16', 'route-17'],
  ['route-17', 'route-18'],
  ['route-18', 'parmanie'],

  // Silence Bridge (Lavender south → Fuchsia)
  ['lavanville', 'route-12'],
  ['route-12', 'route-13'],
  ['route-13', 'route-14'],
  ['route-14', 'route-15'],
  ['route-15', 'parmanie'],

  // Water routes: Fuchsia → Seafoam → Cinnabar → Pallet
  ['parmanie', 'route-19'],
  ['route-19', 'route-20'],
  ['route-20', 'seafoam-islands'],
  ['seafoam-islands', 'cramois-ile'],
  ['cramois-ile', 'pokemon-mansion'],
  ['cramois-ile', 'route-21'],
  ['route-21', 'bourg-palette'],

  // Victory Road
  ['route-22', 'route-23'],
  ['route-23', 'victory-road'],
  ['victory-road', 'plateau-indigo'],
  ['plateau-indigo', 'league-hall'],
];
