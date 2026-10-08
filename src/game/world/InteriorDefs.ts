// 0 = floor (walkable), 1 = wall (solid), 2 = exit door (walkable, triggers exit)

export interface FurnitureDef {
  id: string;
  emoji: string;
  label: string;
  tileX: number;
  tileY: number;
  widthTiles: number;
  heightTiles: number;
  solid: boolean;
  action?: string;
  color: number;
}

export interface InteriorDef {
  id: string;
  buildingId: string;
  /** tile map: row-major, 0=floor 1=wall 2=exit */
  tiles: number[][];
  /** where player appears inside when entering */
  spawnX: number;
  spawnY: number;
  /** exit tile position (type 2 in tiles array) */
  exitTileX: number;
  exitTileY: number;
  /** where player returns to in the exterior world */
  returnX: number;
  returnY: number;
  furniture: FurnitureDef[];
}

// ── PLAYER HOME INTERIOR ─────────────────────────────────────────────────────
// 24 tiles wide × 18 tiles tall @ TILE_SIZE=32 → 768×576 world units
// At zoom 2.0 on a 1536px canvas: map exactly fills the width → no empty sides
//
// Layout:
//   Top half (rows 1-5): Quarto | Banheiro | Estudo
//   Bottom half (rows 7-16): Sala+Jantar | Cozinha
//   col 7 = wall (quarto|banheiro), col 13-14 = wall (banheiro|estudo)
//   col 15 = wall (sala|cozinha, rows 6-17), door at col 3 and col 18 in row 6
const HOME_TILES: number[][] = [
  // cols: 0  1  2  3  4  5  6  7  8  9 10 11 12 13 14 15 16 17 18 19 20 21 22 23
  [1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1], // row  0 — top wall
  [1,0,0,0,0,0,0,1,0,0,0,0,0,1,1,0,0,0,0,0,0,0,0,1], // row  1
  [1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,1], // row  2 — doors: col7(Q↔B), col13-14(B↔E)
  [1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,1], // row  3 — doors: col7(Q↔B), col13-14(B↔E)
  [1,0,0,0,0,0,0,1,0,0,0,0,0,1,1,0,0,0,0,0,0,0,0,1], // row  4
  [1,0,0,0,0,0,0,1,0,0,0,0,0,1,1,0,0,0,0,0,0,0,0,1], // row  5
  [1,1,1,0,1,1,1,1,1,1,1,1,1,1,1,1,1,1,0,1,1,1,1,1], // row  6 — divider (doors at 3 and 18)
  [1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,1,0,0,0,0,0,0,0,1], // row  7
  [1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,1,0,0,0,0,0,0,0,1], // row  8
  [1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,1,0,0,0,0,0,0,0,1], // row  9
  [1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,1,0,0,0,0,0,0,0,1], // row 10
  [1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,1], // row 11 — door col15 (Sala↔Cozinha)
  [1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,1], // row 12 — door col15 (Sala↔Cozinha)
  [1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,1,0,0,0,0,0,0,0,1], // row 13
  [1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,1,0,0,0,0,0,0,0,1], // row 14
  [1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,1,0,0,0,0,0,0,0,1], // row 15
  [1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,1,0,0,0,0,0,0,0,1], // row 16
  [1,1,1,1,1,1,1,1,1,1,1,1,2,1,1,1,1,1,1,1,1,1,1,1], // row 17 — exit at col 12
];

export const PLAYER_HOME_INTERIOR: InteriorDef = {
  id: 'player_home_interior',
  buildingId: 'player_home',
  tiles: HOME_TILES,
  spawnX: 7, spawnY: 15,   // inside living room, near center
  exitTileX: 12, exitTileY: 17,
  returnX: 6, returnY: 5,
  furniture: [
    // ── QUARTO (cols 1-6, rows 1-5) ──────────────────────────────────────────
    // bed: 2 tiles wide × 1 tile tall (single/twin bed — proportional to character)
    { id:'bed',      emoji:'🛏️', label:'Cama',          tileX:1, tileY:1, widthTiles:2, heightTiles:1, solid:true,  action:'sleep', color:0x5b7fa6 },
    { id:'wardrobe', emoji:'🗄️',  label:'Guarda-roupa',  tileX:5, tileY:1, widthTiles:1, heightTiles:2, solid:true,  color:0x5C3317 },
    { id:'desk',     emoji:'💻', label:'Mesa de estudo', tileX:1, tileY:4, widthTiles:1, heightTiles:1, solid:true,  action:'study', color:0x6B4226 },
    { id:'chair',    emoji:'🪑', label:'Cadeira',        tileX:2, tileY:4, widthTiles:1, heightTiles:1, solid:false, color:0xA0522D },

    // ── BANHEIRO (cols 8-12, rows 1-5) ───────────────────────────────────────
    { id:'toilet',  emoji:'🚽', label:'Vaso',     tileX:8,  tileY:1, widthTiles:1, heightTiles:1, solid:true, color:0xE8E8E8 },
    { id:'sink',    emoji:'🪥', label:'Pia',      tileX:10, tileY:1, widthTiles:1, heightTiles:1, solid:true, color:0xE8E8F8 },
    { id:'bathtub', emoji:'🛁', label:'Banheira', tileX:8,  tileY:3, widthTiles:1, heightTiles:2, solid:true, color:0xD0D8FF },

    // ── ESTUDO (cols 15-22, rows 1-5) ────────────────────────────────────────
    { id:'bookshelf', emoji:'📚', label:'Estante', tileX:16, tileY:1, widthTiles:3, heightTiles:1, solid:true, color:0x7B5535 },
    { id:'study_desk',emoji:'🖥️', label:'Computador', tileX:16, tileY:3, widthTiles:2, heightTiles:1, solid:true, action:'study', color:0x2a2a3a },

    // ── SALA (cols 1-14, rows 7-16) ──────────────────────────────────────────
    { id:'tv',    emoji:'📺', label:'TV',    tileX:1,  tileY:7,  widthTiles:2, heightTiles:1, solid:true,  color:0x1a1a2e },
    { id:'sofa',  emoji:'🛋️', label:'Sofá',  tileX:1,  tileY:10, widthTiles:3, heightTiles:1, solid:false, color:0x4169E1 },
    { id:'table', emoji:'🍽️', label:'Mesa',  tileX:7,  tileY:9,  widthTiles:2, heightTiles:2, solid:true,  color:0x8B7355 },

    // ── COZINHA (cols 16-22, rows 7-16) ──────────────────────────────────────
    { id:'stove',  emoji:'🍳', label:'Fogão',     tileX:16, tileY:7,  widthTiles:2, heightTiles:1, solid:true, action:'idle', color:0x808080 },
    { id:'fridge', emoji:'🧊', label:'Geladeira', tileX:21, tileY:7,  widthTiles:1, heightTiles:2, solid:true, color:0xD0D0D0 },
    { id:'sink2',  emoji:'🚰', label:'Pia',       tileX:21, tileY:11, widthTiles:1, heightTiles:1, solid:true, color:0xC0C8E0 },
  ],
};

export const INTERIORS: Record<string, InteriorDef> = {
  player_home_interior: PLAYER_HOME_INTERIOR,
};
