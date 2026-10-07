// Tile type constants
export const T = {
  GRASS: 0,
  ROAD_H: 1,
  ROAD_V: 2,
  ROAD_X: 3,
  ROAD_TL: 4,
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
  /** column offset of door within building (default: center) */
  doorX?: number;
  interactionRadius: number;
  actions: string[];
  /** if set, pressing E at the door enters this interior */
  interiorId?: string;
}

/** World tile position of a building's door */
export function buildingDoorTile(b: BuildingDef): { x: number; y: number } {
  const col = b.doorX ?? Math.floor(b.widthTiles / 2);
  return { x: b.tileX + col, y: b.tileY + b.heightTiles - 1 };
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

export function buildMap(): number[][] {
  const g  = T.GRASS;
  const rh = T.ROAD_H;
  const rv = T.ROAD_V;
  const rx = T.ROAD_X;
  const sw = T.SIDEWALK;
  const tr = T.TREE;
  const pk = T.PARK_GRASS;

  const map: number[][] = Array.from({ length: MAP_HEIGHT }, () =>
    Array(MAP_WIDTH).fill(g)
  );

  // ── MAIN HORIZONTAL ROAD at y=20 (sidewalk / road / sidewalk) ──
  for (let x = 0; x < MAP_WIDTH; x++) {
    map[19][x] = sw;
    map[20][x] = rh;
    map[21][x] = sw;
  }

  // ── SECONDARY HORIZONTAL ROAD at y=8 — now with proper sidewalks ──
  for (let x = 0; x < MAP_WIDTH; x++) {
    map[7][x]  = sw;
    map[8][x]  = rh;
    map[9][x]  = sw;
  }

  // ── SECONDARY HORIZONTAL ROAD at y=36 — with sidewalks ──
  for (let x = 0; x < MAP_WIDTH; x++) {
    map[35][x] = sw;
    map[36][x] = rh;
    map[37][x] = sw;
  }

  // ── MAIN VERTICAL ROAD at x=30 (sidewalk / road / sidewalk) ──
  for (let y = 0; y < MAP_HEIGHT; y++) {
    map[y][29] = sw;
    map[y][30] = rv;
    map[y][31] = sw;
  }

  // ── SECONDARY VERTICAL ROAD at x=12 — with sidewalks ──
  for (let y = 0; y < MAP_HEIGHT; y++) {
    map[y][11] = sw;
    map[y][12] = rv;
    map[y][13] = sw;
  }

  // ── SECONDARY VERTICAL ROAD at x=48 — with sidewalks ──
  for (let y = 0; y < MAP_HEIGHT; y++) {
    map[y][47] = sw;
    map[y][48] = rv;
    map[y][49] = sw;
  }

  // Intersections
  for (const [iy, ix] of [
    [20, 30], [20, 12], [20, 48],
    [8,  30], [8,  12], [8,  48],
    [36, 30], [36, 12], [36, 48],
  ]) {
    map[iy][ix] = rx;
  }

  // ── PARK (center-left, rows 23–34, cols 14–28) ──
  // Starts at x=14 so sidewalk at x=13 is visible as park border
  for (let y = 23; y <= 34; y++) {
    for (let x = 14; x <= 28; x++) {
      map[y][x] = pk;
    }
  }

  // Park perimeter trees
  for (let x = 14; x <= 28; x += 3) {
    map[23][x] = tr;
    map[34][x] = tr;
  }
  for (let y = 24; y <= 33; y += 3) {
    map[y][14] = tr;
    map[y][28] = tr;
  }

  // Central tree cluster in park
  map[28][20] = tr; map[28][21] = tr;
  map[27][20] = tr; map[27][21] = tr;

  // ── Árvores nos jardins residenciais (NW, entre prédios e rua) ──
  // Entre a zona residencial e a rua y=7/8/9
  for (let x = 1; x <= 10; x += 3) { map[10][x] = tr; }
  // Lateral direita das casas (entre residencial e a rua x=11/12/13)
  for (let y = 1; y <= 6; y += 2) { map[y][10] = tr; }
  for (let y = 11; y <= 16; y += 2) { map[y][10] = tr; }
  // Cantinhos de grama nos arredores
  map[1][14] = tr; map[2][14] = tr; map[3][14] = tr;
  map[4][14] = tr; map[5][14] = tr;
  map[11][14] = tr; map[12][14] = tr; map[13][14] = tr;
  map[14][14] = tr; map[15][14] = tr;

  // ── Árvores na zona comercial (NE) ──
  // Linha de árvores na borda superior (y=1) entre x=32 e x=46
  for (let x = 45; x <= 46; x++) { map[1][x] = tr; map[2][x] = tr; }
  // Árvores no corredor entre commercial e a rua vertical x=30
  for (let y = 1; y <= 6; y += 2) { map[y][31] = tr; }
  for (let y = 11; y <= 17; y += 2) { map[y][31] = tr; }

  // ── Árvores na zona educacional (SW) ──
  for (let x = 1; x <= 10; x += 3) { map[38][x] = tr; }
  for (let x = 14; x <= 27; x += 4) { map[38][x] = tr; }

  // ── Árvores na zona de serviços (SE) ──
  for (let y = 38; y <= 48; y += 3) { map[y][50] = tr; }
  for (let y = 38; y <= 48; y += 3) { map[y][51] = tr; }

  // ── Fileira de árvores na borda sul do mapa ──
  for (let x = 0; x < MAP_WIDTH; x += 4) { map[49][x] = tr; }
  // Borda norte
  for (let x = 0; x < MAP_WIDTH; x += 5) { map[0][x] = tr; }
  // Bordas leste e oeste
  for (let y = 5; y <= 48; y += 5) { map[y][0] = tr; }
  for (let y = 5; y <= 48; y += 5) { map[y][59] = tr; }

  return map;
}

// ── BUILDINGS ────────────────────────────────────────────────────────────────
// All y positions adjusted to clear sidewalk rows (y=7,9 and y=35,37)
// x positions clear of x=11,13 and x=47,49 sidewalks

export const BUILDINGS: BuildingDef[] = [

  // ── RESIDENTIAL ZONE (top-left, rows 1–6, cols 1–10) ──
  {
    id: 'player_home',
    label: 'Sua Casa',
    tileX: 1, tileY: 1,
    widthTiles: 5, heightTiles: 5,
    color: 0xF5E6C8, roofColor: 0xC0392B,
    interactionRadius: 3,
    actions: ['sleep', 'idle'],
    interiorId: 'player_home_interior',
  },
  {
    id: 'neighbor_house_1',
    label: 'Casa Vizinha',
    tileX: 7, tileY: 1,
    widthTiles: 4, heightTiles: 5,
    color: 0xD5E8C0, roofColor: 0x2980B9,
    interactionRadius: 2,
    actions: ['visit'],
  },

  // Second row of houses — clear of y=7 sidewalk (start at y=11, end by y=17)
  {
    id: 'neighbor_house_2',
    label: 'Casa da Rua',
    tileX: 1, tileY: 11,
    widthTiles: 4, heightTiles: 5,
    color: 0xE8D5E8, roofColor: 0x8E44AD,
    interactionRadius: 2,
    actions: ['visit'],
  },
  {
    id: 'neighbor_house_3',
    label: 'Casa da Família',
    tileX: 6, tileY: 11,
    widthTiles: 4, heightTiles: 5,
    color: 0xE8E8D5, roofColor: 0x16A085,
    interactionRadius: 2,
    actions: ['visit'],
  },

  // ── COMMERCIAL ZONE (top-right, rows 1–17, cols 32–46) ──
  {
    id: 'market',
    label: 'Mercado',
    tileX: 32, tileY: 1,
    widthTiles: 7, heightTiles: 6,
    color: 0xFFF3CD, roofColor: 0xE67E22,
    interactionRadius: 3,
    actions: ['shop'],
  },
  {
    id: 'restaurant',
    label: 'Restaurante',
    tileX: 40, tileY: 1,
    widthTiles: 6, heightTiles: 6,
    color: 0xFFE0E0, roofColor: 0xE74C3C,
    interactionRadius: 3,
    actions: ['shop'],
  },
  {
    id: 'bank',
    label: 'Banco',
    tileX: 32, tileY: 11,
    widthTiles: 7, heightTiles: 5,
    color: 0xD5E8FF, roofColor: 0x2C3E50,
    interactionRadius: 3,
    actions: ['visit'],
  },

  // ── EDUCATIONAL ZONE (below main road, rows 23–34, cols 1–10) ──
  {
    id: 'school',
    label: 'Escola',
    tileX: 1, tileY: 23,
    widthTiles: 9, heightTiles: 7,
    color: 0xE8F5E9, roofColor: 0x27AE60,
    interactionRadius: 4,
    actions: ['study'],
  },
  {
    id: 'library',
    label: 'Biblioteca',
    tileX: 1, tileY: 32,
    widthTiles: 6, heightTiles: 3,
    color: 0xFCF3CF, roofColor: 0xF39C12,
    interactionRadius: 3,
    actions: ['study'],
  },

  // ── WORK / SERVICES (bottom-right, rows 23–34, cols 32–46) ──
  {
    id: 'office',
    label: 'Escritório',
    tileX: 32, tileY: 23,
    widthTiles: 8, heightTiles: 7,
    color: 0xEBEFF4, roofColor: 0x3498DB,
    interactionRadius: 3,
    actions: ['work'],
  },
  {
    id: 'hospital',
    label: 'Hospital',
    tileX: 32, tileY: 32,
    widthTiles: 7, heightTiles: 3,
    color: 0xFFFFFF, roofColor: 0xE74C3C,
    interactionRadius: 3,
    actions: ['visit'],
  },

  // Bus stop near main road
  {
    id: 'bus_stop',
    label: 'Ponto',
    tileX: 27, tileY: 17,
    widthTiles: 2, heightTiles: 2,
    color: 0xBDC3C7, roofColor: 0x7F8C8D,
    interactionRadius: 2,
    actions: ['idle'],
  },
];

// ── NPCS ─────────────────────────────────────────────────────────────────────
export const NPCS: NpcDef[] = [
  {
    id: 'ana',
    name: 'Ana',
    role: 'Vizinha',
    startTileX: 9, startTileY: 4,
    color: 0xFF69B4, headColor: 0xF4C2A1,
    schedule: [
      { tileX: 9, tileY: 4,  waitMs: 3000 },
      { tileX: 14, tileY: 4,  waitMs: 2000 },
      { tileX: 14, tileY: 17, waitMs: 4000 },
      { tileX: 9, tileY: 17,  waitMs: 2000 },
    ],
  },
  {
    id: 'carlos',
    name: 'Carlos',
    role: 'Vendedor',
    startTileX: 34, startTileY: 4,
    color: 0x4169E1, headColor: 0x8D5524,
    schedule: [
      { tileX: 34, tileY: 4, waitMs: 5000 },
      { tileX: 38, tileY: 4, waitMs: 3000 },
      { tileX: 38, tileY: 6, waitMs: 2000 },
      { tileX: 34, tileY: 6, waitMs: 4000 },
    ],
  },
  {
    id: 'professora_maria',
    name: 'Prof. Maria',
    role: 'Professora',
    startTileX: 5, startTileY: 26,
    color: 0x228B22, headColor: 0xC68642,
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
    startTileX: 19, startTileY: 28,
    color: 0x8B4513, headColor: 0xFAD5A5,
    schedule: [
      { tileX: 19, tileY: 28, waitMs: 10000 },
      { tileX: 22, tileY: 28, waitMs: 8000 },
      { tileX: 22, tileY: 31, waitMs: 10000 },
      { tileX: 19, tileY: 31, waitMs: 6000 },
    ],
  },
  {
    id: 'lucia',
    name: 'Lúcia',
    role: 'Médica',
    startTileX: 34, startTileY: 33,
    color: 0xE8E8E8, headColor: 0xF4C2A1,
    schedule: [
      { tileX: 34, tileY: 33, waitMs: 4000 },
      { tileX: 37, tileY: 33, waitMs: 3000 },
      { tileX: 37, tileY: 34, waitMs: 5000 },
      { tileX: 34, tileY: 34, waitMs: 4000 },
    ],
  },
];
