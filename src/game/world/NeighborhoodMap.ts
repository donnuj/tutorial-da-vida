// Tile type constants
export const T = {
  GRASS: 0,
  ROAD_H: 1,
  ROAD_V: 2,
  ROAD_X: 3,   // intersection
  ROAD_TL: 4,  // corner top-left
  ROAD_TR: 5,
  ROAD_BL: 6,
  ROAD_BR: 7,
  SIDEWALK: 8,
  DIRT: 9,
  WATER: 10,
  SAND: 11,
  TREE: 12,
  FLOWER: 13,
  PARK_GRASS: 14,
} as const;

export type TileType = typeof T[keyof typeof T];

export interface BuildingDef {
  id: string;
  label: string;
  tileX: number;
  tileY: number;
  widthTiles: number;
  heightTiles: number;
  color: number;
  roofColor: number;
  doorX?: number;
  interactionRadius: number;
  actions: string[];
}

export interface NpcDef {
  id: string;
  name: string;
  role: string;
  startTileX: number;
  startTileY: number;
  color: number;
  headColor: number;
  schedule: PatrolPoint[];
}

export interface PatrolPoint {
  tileX: number;
  tileY: number;
  waitMs: number;
}

export const TILE_SIZE = 32;
export const MAP_WIDTH = 60;
export const MAP_HEIGHT = 50;

// The full tile map grid (60 x 50)
// Using a compact representation — 0=grass, 1=road_h, 2=road_v, etc.
export function buildMap(): number[][] {
  const g = T.GRASS;
  const rh = T.ROAD_H;
  const rv = T.ROAD_V;
  const rx = T.ROAD_X;
  const sw = T.SIDEWALK;
  const tr = T.TREE;
  const pk = T.PARK_GRASS;
  const di = T.DIRT;

  // Initialize with grass
  const map: number[][] = Array.from({ length: MAP_HEIGHT }, () =>
    Array(MAP_WIDTH).fill(g)
  );

  // === MAIN ROADS ===
  // Horizontal main road at y=20 (3 tiles wide: 19, 20, 21)
  for (let x = 0; x < MAP_WIDTH; x++) {
    map[19][x] = sw;
    map[20][x] = rh;
    map[21][x] = sw;
  }

  // Horizontal secondary road at y=8 (1 tile)
  for (let x = 0; x < MAP_WIDTH; x++) {
    map[8][x] = rh;
  }

  // Horizontal secondary road at y=36
  for (let x = 0; x < MAP_WIDTH; x++) {
    map[36][x] = rh;
  }

  // Vertical main road at x=30 (3 tiles wide: 29, 30, 31)
  for (let y = 0; y < MAP_HEIGHT; y++) {
    map[y][29] = sw;
    map[y][30] = rv;
    map[y][31] = sw;
  }

  // Vertical secondary road at x=12
  for (let y = 0; y < MAP_HEIGHT; y++) {
    map[y][12] = rv;
  }

  // Vertical secondary road at x=48
  for (let y = 0; y < MAP_HEIGHT; y++) {
    map[y][48] = rv;
  }

  // Fix intersections
  for (const [iy, ix] of [
    [20, 30], [20, 12], [20, 48],
    [8, 30],  [8, 12],  [8, 48],
    [36, 30], [36, 12], [36, 48],
  ]) {
    map[iy][ix] = rx;
  }

  // === PARK (center-left zone, rows 22-34, cols 13-28) ===
  for (let y = 22; y <= 34; y++) {
    for (let x = 13; x <= 28; x++) {
      map[y][x] = pk;
    }
  }
  // Trees in park perimeter
  for (let x = 14; x <= 27; x += 3) {
    map[22][x] = tr;
    map[34][x] = tr;
  }
  for (let y = 23; y <= 33; y += 3) {
    map[y][13] = tr;
    map[y][28] = tr;
  }
  // Central tree cluster
  map[28][20] = tr; map[28][21] = tr;
  map[27][20] = tr; map[27][21] = tr;

  return map;
}

export const BUILDINGS: BuildingDef[] = [
  // === RESIDENTIAL ZONE (top-left, rows 1-18, cols 1-11) ===
  {
    id: 'player_home',
    label: 'Sua Casa',
    tileX: 1, tileY: 1,
    widthTiles: 5, heightTiles: 6,
    color: 0xF5E6C8,
    roofColor: 0xC0392B,
    interactionRadius: 3,
    actions: ['sleep', 'idle'],
  },
  {
    id: 'neighbor_house_1',
    label: 'Casa do Vizinho',
    tileX: 7, tileY: 1,
    widthTiles: 4, heightTiles: 6,
    color: 0xD5E8C0,
    roofColor: 0x2980B9,
    interactionRadius: 2,
    actions: ['visit'],
  },
  {
    id: 'neighbor_house_2',
    label: 'Casa da Vizinha',
    tileX: 1, tileY: 9,
    widthTiles: 4, heightTiles: 6,
    color: 0xE8D5E8,
    roofColor: 0x8E44AD,
    interactionRadius: 2,
    actions: ['visit'],
  },
  {
    id: 'neighbor_house_3',
    label: 'Casa da Família',
    tileX: 7, tileY: 9,
    widthTiles: 4, heightTiles: 6,
    color: 0xE8E8D5,
    roofColor: 0x16A085,
    interactionRadius: 2,
    actions: ['visit'],
  },

  // === COMMERCIAL ZONE (top-right, rows 1-18, cols 32-47) ===
  {
    id: 'market',
    label: 'Mercado',
    tileX: 32, tileY: 1,
    widthTiles: 7, heightTiles: 7,
    color: 0xFFF3CD,
    roofColor: 0xE67E22,
    interactionRadius: 3,
    actions: ['shop'],
  },
  {
    id: 'restaurant',
    label: 'Restaurante',
    tileX: 32, tileY: 10,
    widthTiles: 6, heightTiles: 7,
    color: 0xFFE0E0,
    roofColor: 0xE74C3C,
    interactionRadius: 3,
    actions: ['shop'],
  },
  {
    id: 'bank',
    label: 'Banco',
    tileX: 40, tileY: 1,
    widthTiles: 7, heightTiles: 6,
    color: 0xD5E8FF,
    roofColor: 0x2C3E50,
    interactionRadius: 3,
    actions: ['visit'],
  },

  // === EDUCATIONAL ZONE (bottom-left, rows 22-35, cols 1-11) ===
  {
    id: 'school',
    label: 'Escola',
    tileX: 1, tileY: 22,
    widthTiles: 10, heightTiles: 8,
    color: 0xE8F5E9,
    roofColor: 0x27AE60,
    interactionRadius: 4,
    actions: ['study'],
  },
  {
    id: 'library',
    label: 'Biblioteca',
    tileX: 1, tileY: 32,
    widthTiles: 6, heightTiles: 5,
    color: 0xFCF3CF,
    roofColor: 0xF39C12,
    interactionRadius: 3,
    actions: ['study'],
  },

  // === WORK / SERVICES (bottom-right, rows 22-35, cols 32-47) ===
  {
    id: 'office',
    label: 'Escritório',
    tileX: 32, tileY: 22,
    widthTiles: 8, heightTiles: 7,
    color: 0xEBEFF4,
    roofColor: 0x3498DB,
    interactionRadius: 3,
    actions: ['work'],
  },
  {
    id: 'hospital',
    label: 'Hospital',
    tileX: 32, tileY: 31,
    widthTiles: 7, heightTiles: 6,
    color: 0xFFFFFF,
    roofColor: 0xE74C3C,
    interactionRadius: 3,
    actions: ['visit'],
  },
  {
    id: 'bus_stop',
    label: 'Ponto de Ônibus',
    tileX: 27, tileY: 17,
    widthTiles: 2, heightTiles: 2,
    color: 0xBDC3C7,
    roofColor: 0x7F8C8D,
    interactionRadius: 2,
    actions: ['idle'],
  },
];

export const NPCS: NpcDef[] = [
  {
    id: 'ana',
    name: 'Ana',
    role: 'Vizinha',
    startTileX: 9, startTileY: 5,
    color: 0xFF69B4,
    headColor: 0xF4C2A1,
    schedule: [
      { tileX: 9, tileY: 5, waitMs: 3000 },
      { tileX: 15, tileY: 5, waitMs: 2000 },
      { tileX: 15, tileY: 15, waitMs: 5000 },
      { tileX: 9, tileY: 15, waitMs: 2000 },
    ],
  },
  {
    id: 'carlos',
    name: 'Carlos',
    role: 'Vendedor',
    startTileX: 34, startTileY: 3,
    color: 0x4169E1,
    headColor: 0x8D5524,
    schedule: [
      { tileX: 34, tileY: 3, waitMs: 5000 },
      { tileX: 37, tileY: 3, waitMs: 3000 },
      { tileX: 37, tileY: 6, waitMs: 2000 },
      { tileX: 34, tileY: 6, waitMs: 4000 },
    ],
  },
  {
    id: 'professora_maria',
    name: 'Prof. Maria',
    role: 'Professora',
    startTileX: 5, startTileY: 26,
    color: 0x228B22,
    headColor: 0xC68642,
    schedule: [
      { tileX: 5, tileY: 26, waitMs: 8000 },
      { tileX: 8, tileY: 26, waitMs: 3000 },
      { tileX: 8, tileY: 29, waitMs: 5000 },
      { tileX: 5, tileY: 29, waitMs: 3000 },
    ],
  },
  {
    id: 'seu_jose',
    name: 'Seu José',
    role: 'Aposentado',
    startTileX: 20, startTileY: 28,
    color: 0x8B4513,
    headColor: 0xFAD5A5,
    schedule: [
      { tileX: 20, tileY: 28, waitMs: 10000 },
      { tileX: 22, tileY: 28, waitMs: 8000 },
      { tileX: 22, tileY: 30, waitMs: 10000 },
      { tileX: 20, tileY: 30, waitMs: 6000 },
    ],
  },
  {
    id: 'lucia',
    name: 'Lúcia',
    role: 'Médica',
    startTileX: 34, startTileY: 34,
    color: 0xFFFFFF,
    headColor: 0xF4C2A1,
    schedule: [
      { tileX: 34, tileY: 34, waitMs: 4000 },
      { tileX: 37, tileY: 34, waitMs: 3000 },
      { tileX: 37, tileY: 36, waitMs: 5000 },
      { tileX: 34, tileY: 36, waitMs: 4000 },
    ],
  },
];
