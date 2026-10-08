// Tile type constants
export const T = {
  GRASS:       0,
  ROAD_H:      1,
  ROAD_V:      2,
  ROAD_X:      3,
  ROAD_TL:     4,
  ROAD_TR:     5,
  ROAD_BL:     6,
  ROAD_BR:     7,
  SIDEWALK:    8,
  DIRT:        9,
  WATER:       10,
  SAND:        11,
  TREE:        12,
  FLOWER:      13,
  PARK_GRASS:  14,
  TREE_ALT:    15,   // alternate tree species (visual variety)
  BUSH:        16,   // small bush
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
  interiorId?: string;
  /** visual archetype controls which frame rows are used */
  archetype?: 'house' | 'shop' | 'office' | 'institution' | 'public_service';
}

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

/** Decorative street objects placed on the map */
export interface StreetObjectDef {
  type: 'lamp' | 'bench' | 'trash' | 'mailbox' | 'sign' | 'flower_pot' | 'fire_hydrant';
  tileX: number;
  tileY: number;
}

// ── Map dimensions ─────────────────────────────────────────────────────────────
export const TILE_SIZE  = 32;
export const MAP_WIDTH  = 50;
export const MAP_HEIGHT = 40;

// ── Road layout ───────────────────────────────────────────────────────────────
const H_ROAD_ROWS = [[6, 7], [17, 18], [30, 31]] as const;
const V_ROAD_COLS = [[10, 11], [25, 26], [40, 41]] as const;

export function buildMap(): number[][] {
  const g  = T.GRASS;
  const rh = T.ROAD_H;
  const rv = T.ROAD_V;
  const rx = T.ROAD_X;
  const sw = T.SIDEWALK;
  const tr = T.TREE;
  const ta = T.TREE_ALT;
  const pk = T.PARK_GRASS;
  const fl = T.FLOWER;
  const bu = T.BUSH;

  const map: number[][] = Array.from({ length: MAP_HEIGHT }, () =>
    Array(MAP_WIDTH).fill(g)
  );

  // ── Horizontal roads ──
  for (const [r1, r2] of H_ROAD_ROWS) {
    for (let x = 0; x < MAP_WIDTH; x++) {
      map[r1 - 1][x] = sw;
      map[r1][x]     = rh;
      map[r2][x]     = rh;
      map[r2 + 1][x] = sw;
    }
  }

  // ── Vertical roads ──
  for (const [c1, c2] of V_ROAD_COLS) {
    for (let y = 0; y < MAP_HEIGHT; y++) {
      map[y][c1 - 1] = sw;
      map[y][c1]     = rv;
      map[y][c2]     = rv;
      map[y][c2 + 1] = sw;
    }
  }

  // ── Intersections ──
  for (const [r1, r2] of H_ROAD_ROWS) {
    for (const [c1, c2] of V_ROAD_COLS) {
      map[r1][c1] = rx; map[r1][c2] = rx;
      map[r2][c1] = rx; map[r2][c2] = rx;
      // sidewalk corners at intersection
      map[r1 - 1][c1 - 1] = sw; map[r1 - 1][c2 + 1] = sw;
      map[r2 + 1][c1 - 1] = sw; map[r2 + 1][c2 + 1] = sw;
    }
  }

  // ── Park (center, rows 20-28, cols 13-23) ──
  for (let y = 20; y <= 28; y++) {
    for (let x = 13; x <= 23; x++) {
      map[y][x] = pk;
    }
  }
  // Winding footpath through park (sidewalk tiles)
  map[22][14] = sw; map[22][15] = sw; map[22][16] = sw;
  map[23][16] = sw;
  map[24][16] = sw; map[24][17] = sw; map[24][18] = sw;
  map[23][18] = sw;
  map[22][18] = sw; map[22][19] = sw; map[22][20] = sw; map[22][21] = sw;
  map[25][21] = sw; map[26][21] = sw; map[26][20] = sw;
  map[25][15] = sw; map[26][15] = sw; map[26][16] = sw;
  // Organic (asymmetric) tree groupings
  map[20][13] = tr; map[20][15] = ta; map[20][20] = tr; map[20][22] = ta;
  map[21][13] = ta; map[21][23] = tr;
  map[22][23] = ta; map[22][13] = tr;
  map[23][13] = ta; map[23][14] = tr;
  map[24][23] = tr; map[25][23] = ta; map[25][22] = tr;
  map[26][13] = tr; map[27][13] = ta; map[27][14] = tr;
  map[27][23] = ta; map[28][22] = tr;
  map[28][13] = ta; map[28][17] = tr;
  // Off-center grove
  map[23][19] = tr; map[23][20] = ta;
  map[24][20] = tr; map[24][21] = ta;
  map[25][19] = ta; map[25][20] = tr;
  // Scattered flowers
  map[21][15] = fl; map[21][19] = fl; map[21][22] = fl;
  map[23][15] = fl; map[23][17] = fl;
  map[25][17] = fl;
  map[26][18] = fl; map[26][22] = fl;
  map[27][16] = fl; map[27][20] = fl;
  // Bushes
  map[22][22] = bu; map[27][21] = bu; map[24][14] = bu;

  // ── NW residential garden strips (between houses) ──
  map[5][3] = tr; map[5][7] = ta;
  map[3][9] = bu; map[5][9] = bu;
  // Flowers near houses
  map[1][8] = fl; map[4][8] = fl;
  map[9][8] = fl; map[12][8] = fl;

  // ── Tree strips between NW residential and road ──
  for (let y = 1; y <= 5; y += 2) { map[y][12] = y % 4 === 0 ? ta : tr; }
  for (let y = 9; y <= 15; y += 2) { map[y][12] = y % 4 === 1 ? ta : tr; }

  // ── Commercial zone perimeter trees (E side col 24) ──
  for (let y = 1; y <= 5; y += 2) { map[y][24] = tr; }
  for (let y = 9; y <= 15; y += 2) { map[y][24] = ta; }

  // ── Street trees along horizontal roads ──
  // Along first H road (row 5 sidewalk), between V roads
  for (let x = 13; x <= 23; x += 4) { map[5][x] = tr; }
  // Along second H road (row 19 sidewalk)
  for (let x = 2; x <= 8; x += 3) { map[19][x] = ta; }
  for (let x = 13; x <= 23; x += 4) { map[19][x] = tr; }
  for (let x = 27; x <= 38; x += 4) { map[19][x] = ta; }
  // Along third H road (row 29 sidewalk)
  for (let x = 2; x <= 8; x += 3) { map[29][x] = tr; }
  for (let x = 27; x <= 38; x += 3) { map[29][x] = ta; }

  // ── Trees — SW educational zone ──
  for (let x = 1; x <= 8; x += 4) { map[19][x] = ta; }

  // ── Border trees (perimeter) ──
  for (let x = 0; x < MAP_WIDTH; x += 4) { map[0][x] = tr; }
  for (let x = 2; x < MAP_WIDTH; x += 4) { map[0][x] = ta; }
  for (let x = 0; x < MAP_WIDTH; x += 4) { map[39][x] = ta; }
  for (let x = 2; x < MAP_WIDTH; x += 4) { map[39][x] = tr; }
  for (let y = 4; y <= 38; y += 5) { map[y][0]  = tr; }
  for (let y = 2; y <= 37; y += 5) { map[y][49] = ta; }

  // ── Bushes along sidewalks ──
  map[5][1] = bu; map[5][4] = bu;
  map[16][1] = bu; map[16][4] = bu;
  map[19][14] = bu; map[19][18] = bu; map[19][22] = bu;

  return map;
}

// ── BUILDINGS ─────────────────────────────────────────────────────────────────
export const BUILDINGS: BuildingDef[] = [

  // ── RESIDENTIAL ZONE (NW, rows 1–5, cols 1–8) ─────────────────────────────
  {
    id: 'player_home',
    label: 'Sua Casa',
    tileX: 1, tileY: 1,
    widthTiles: 4, heightTiles: 5,
    color: 0xF5E6C8, roofColor: 0xC0392B,
    interactionRadius: 3,
    actions: ['sleep', 'idle'],
    interiorId: 'player_home_interior',
    archetype: 'house',
  },
  {
    id: 'neighbor_house_1',
    label: 'Casa Vizinha',
    tileX: 6, tileY: 1,
    widthTiles: 3, heightTiles: 5,
    color: 0xD5E8C0, roofColor: 0x2980B9,
    interactionRadius: 2,
    actions: ['visit'],
    archetype: 'house',
  },

  // ── RESIDENTIAL LOWER (rows 9–15) ──────────────────────────────────────────
  {
    id: 'neighbor_house_2',
    label: 'Casa da Rua',
    tileX: 1, tileY: 9,
    widthTiles: 4, heightTiles: 5,
    color: 0xE8D5E8, roofColor: 0x8E44AD,
    interactionRadius: 2,
    actions: ['visit'],
    archetype: 'house',
  },
  {
    id: 'neighbor_house_3',
    label: 'Casa dos Souza',
    tileX: 6, tileY: 9,
    widthTiles: 3, heightTiles: 5,
    color: 0xE8E8D5, roofColor: 0x16A085,
    interactionRadius: 2,
    actions: ['visit'],
    archetype: 'house',
  },

  // ── COMMERCIAL ZONE (cols 13–23) ──────────────────────────────────────────
  {
    id: 'market',
    label: 'Mercado',
    tileX: 13, tileY: 1,
    widthTiles: 5, heightTiles: 5,
    color: 0xFFF3CD, roofColor: 0xE67E22,
    interactionRadius: 3,
    actions: ['shop'],
    archetype: 'shop',
  },
  {
    id: 'restaurant',
    label: 'Restaurante',
    tileX: 19, tileY: 1,
    widthTiles: 4, heightTiles: 5,
    color: 0xFFE0E0, roofColor: 0xE74C3C,
    interactionRadius: 3,
    actions: ['shop'],
    archetype: 'shop',
  },
  {
    id: 'bank',
    label: 'Banco',
    tileX: 13, tileY: 9,
    widthTiles: 5, heightTiles: 5,
    color: 0xD5E8FF, roofColor: 0x2C3E50,
    interactionRadius: 3,
    actions: ['visit'],
    archetype: 'institution',
  },
  {
    id: 'pharmacy',
    label: 'Farmácia',
    tileX: 19, tileY: 9,
    widthTiles: 4, heightTiles: 5,
    color: 0xE8FFE8, roofColor: 0x27AE60,
    interactionRadius: 2,
    actions: ['visit'],
    archetype: 'shop',
  },

  // ── EDUCATIONAL ZONE (SW, rows 20–28, cols 1–8) ───────────────────────────
  {
    id: 'school',
    label: 'Escola',
    tileX: 1, tileY: 20,
    widthTiles: 7, heightTiles: 5,
    color: 0xE8F5E9, roofColor: 0x27AE60,
    interactionRadius: 4,
    actions: ['study'],
    archetype: 'institution',
  },
  {
    id: 'library',
    label: 'Biblioteca',
    tileX: 1, tileY: 26,
    widthTiles: 5, heightTiles: 4,
    color: 0xFCF3CF, roofColor: 0xF39C12,
    interactionRadius: 3,
    actions: ['study'],
    archetype: 'institution',
  },

  // ── WORK / SERVICES (SE, rows 20–28, cols 27–38) ─────────────────────────
  {
    id: 'office',
    label: 'Escritório',
    tileX: 27, tileY: 20,
    widthTiles: 6, heightTiles: 5,
    color: 0xEBEFF4, roofColor: 0x3498DB,
    interactionRadius: 3,
    actions: ['work'],
    archetype: 'office',
  },
  {
    id: 'hospital',
    label: 'Hospital',
    tileX: 27, tileY: 26,
    widthTiles: 5, heightTiles: 4,
    color: 0xFFFFFF, roofColor: 0xE74C3C,
    interactionRadius: 3,
    actions: ['visit'],
    archetype: 'public_service',
  },

  // Bus stop
  {
    id: 'bus_stop',
    label: 'Ponto',
    tileX: 22, tileY: 14,
    widthTiles: 2, heightTiles: 2,
    color: 0xBDC3C7, roofColor: 0x7F8C8D,
    interactionRadius: 2,
    actions: ['idle'],
    archetype: 'public_service',
  },
];

// ── STREET OBJECTS ────────────────────────────────────────────────────────────
export const STREET_OBJECTS: StreetObjectDef[] = [
  // Lamps along main H road (row 5)
  { type: 'lamp', tileX: 2,  tileY: 5 },
  { type: 'lamp', tileX: 5,  tileY: 5 },
  { type: 'lamp', tileX: 13, tileY: 5 },
  { type: 'lamp', tileX: 17, tileY: 5 },
  { type: 'lamp', tileX: 21, tileY: 5 },
  // Lamps along second H road (row 16)
  { type: 'lamp', tileX: 2,  tileY: 16 },
  { type: 'lamp', tileX: 7,  tileY: 16 },
  { type: 'lamp', tileX: 13, tileY: 16 },
  { type: 'lamp', tileX: 19, tileY: 16 },
  { type: 'lamp', tileX: 27, tileY: 16 },
  // Lamps along third H road (row 29)
  { type: 'lamp', tileX: 2,  tileY: 29 },
  { type: 'lamp', tileX: 6,  tileY: 29 },
  { type: 'lamp', tileX: 27, tileY: 29 },
  { type: 'lamp', tileX: 33, tileY: 29 },

  // Benches in park
  { type: 'bench', tileX: 15, tileY: 22 },
  { type: 'bench', tileX: 21, tileY: 22 },
  { type: 'bench', tileX: 15, tileY: 26 },
  { type: 'bench', tileX: 21, tileY: 26 },

  // Benches along streets
  { type: 'bench', tileX: 4,  tileY: 16 },
  { type: 'bench', tileX: 18, tileY: 16 },
  { type: 'bench', tileX: 30, tileY: 29 },

  // Trash cans near commercial buildings
  { type: 'trash', tileX: 12, tileY: 5 },
  { type: 'trash', tileX: 18, tileY: 8 },
  { type: 'trash', tileX: 23, tileY: 5 },
  { type: 'trash', tileX: 23, tileY: 16 },

  // Mailboxes near residential
  { type: 'mailbox', tileX: 5,  tileY: 5 },
  { type: 'mailbox', tileX: 8,  tileY: 5 },
  { type: 'mailbox', tileX: 5,  tileY: 16 },
  { type: 'mailbox', tileX: 8,  tileY: 16 },

  // Fire hydrants
  { type: 'fire_hydrant', tileX: 13, tileY: 16 },
  { type: 'fire_hydrant', tileX: 24, tileY: 16 },
  { type: 'fire_hydrant', tileX: 1,  tileY: 19 },

  // Flower pots near buildings
  { type: 'flower_pot', tileX: 5,  tileY: 5  },
  { type: 'flower_pot', tileX: 13, tileY: 8  },
  { type: 'flower_pot', tileX: 18, tileY: 8  },
  { type: 'flower_pot', tileX: 5,  tileY: 19 },
  { type: 'flower_pot', tileX: 7,  tileY: 19 },
];

// ── NPCS ─────────────────────────────────────────────────────────────────────
export const NPCS: NpcDef[] = [
  {
    id: 'ana',
    name: 'Ana',
    role: 'Vizinha',
    startTileX: 8, startTileY: 3,
    color: 0xFF69B4, headColor: 0xF4C2A1,
    schedule: [
      { tileX: 8,  tileY: 3,  waitMs: 3000 },
      { tileX: 12, tileY: 3,  waitMs: 2000 },
      { tileX: 12, tileY: 14, waitMs: 4000 },
      { tileX: 8,  tileY: 14, waitMs: 2000 },
    ],
  },
  {
    id: 'carlos',
    name: 'Carlos',
    role: 'Vendedor',
    startTileX: 15, startTileY: 3,
    color: 0x4169E1, headColor: 0x8D5524,
    schedule: [
      { tileX: 15, tileY: 3, waitMs: 5000 },
      { tileX: 20, tileY: 3, waitMs: 3000 },
      { tileX: 20, tileY: 5, waitMs: 2000 },
      { tileX: 15, tileY: 5, waitMs: 4000 },
    ],
  },
  {
    id: 'professora_maria',
    name: 'Prof. Maria',
    role: 'Professora',
    startTileX: 4, startTileY: 22,
    color: 0x228B22, headColor: 0xC68642,
    schedule: [
      { tileX: 4, tileY: 22, waitMs: 8000 },
      { tileX: 7, tileY: 22, waitMs: 3000 },
      { tileX: 7, tileY: 24, waitMs: 5000 },
      { tileX: 4, tileY: 24, waitMs: 3000 },
    ],
  },
  {
    id: 'seu_jose',
    name: 'Seu José',
    role: 'Aposentado',
    startTileX: 16, startTileY: 23,
    color: 0x8B4513, headColor: 0xFAD5A5,
    schedule: [
      { tileX: 16, tileY: 23, waitMs: 10000 },
      { tileX: 20, tileY: 23, waitMs: 8000 },
      { tileX: 20, tileY: 26, waitMs: 10000 },
      { tileX: 16, tileY: 26, waitMs: 6000 },
    ],
  },
  {
    id: 'lucia',
    name: 'Lúcia',
    role: 'Médica',
    startTileX: 29, startTileY: 27,
    color: 0xE8E8E8, headColor: 0xF4C2A1,
    schedule: [
      { tileX: 29, tileY: 27, waitMs: 4000 },
      { tileX: 31, tileY: 27, waitMs: 3000 },
      { tileX: 31, tileY: 28, waitMs: 5000 },
      { tileX: 29, tileY: 28, waitMs: 4000 },
    ],
  },
];
