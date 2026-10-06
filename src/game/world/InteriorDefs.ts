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
// 15 tiles wide × 13 tiles tall
// Bedroom (top-left) | Bathroom (top-right) | Living+Kitchen (bottom)
const HOME_TILES: number[][] = [
  [1,1,1,1,1,1,1,1,1,1,1,1,1,1,1], // row  0 — top wall
  [1,0,0,0,0,0,1,1,0,0,0,0,0,0,1], // row  1
  [1,0,0,0,0,0,1,1,0,0,0,0,0,0,1], // row  2
  [1,0,0,0,0,0,1,1,0,0,0,0,0,0,1], // row  3
  [1,0,0,0,0,0,1,1,0,0,0,0,0,0,1], // row  4
  [1,0,0,0,0,0,1,1,0,0,0,0,0,0,1], // row  5
  [1,1,1,0,1,1,1,1,1,1,1,0,1,1,1], // row  6 — divider wall, doorways at 3 and 11
  [1,0,0,0,0,0,0,0,0,0,0,0,0,0,1], // row  7
  [1,0,0,0,0,0,0,0,0,0,0,0,0,0,1], // row  8
  [1,0,0,0,0,0,0,0,0,0,0,0,0,0,1], // row  9
  [1,0,0,0,0,0,0,0,0,0,0,0,0,0,1], // row 10
  [1,0,0,0,0,0,0,0,0,0,0,0,0,0,1], // row 11
  [1,1,1,1,1,1,1,2,1,1,1,1,1,1,1], // row 12 — bottom wall, exit at col 7
];

export const PLAYER_HOME_INTERIOR: InteriorDef = {
  id: 'player_home_interior',
  buildingId: 'player_home',
  tiles: HOME_TILES,
  spawnX:    7, spawnY: 11,   // just inside the exit door
  exitTileX: 7, exitTileY: 12,
  // player_home exterior: tileX=1 tileY=1 w=5 h=5
  // visual door col=2 → door at (3,5), return to tile just below: (3,6)
  returnX: 3, returnY: 6,
  furniture: [
    // BEDROOM (cols 1-5, rows 1-5)
    { id:'bed',      emoji:'🛏️', label:'Cama',     tileX:1, tileY:1, widthTiles:3, heightTiles:2, solid:true,  action:'sleep', color:0x8B4513 },
    { id:'wardrobe', emoji:'🗄️',  label:'Guarda-roupa', tileX:4, tileY:1, widthTiles:1, heightTiles:3, solid:true,  color:0x5C3317 },
    { id:'desk',     emoji:'💻', label:'Mesa de estudo', tileX:1, tileY:4, widthTiles:2, heightTiles:1, solid:true,  action:'study', color:0x6B4226 },
    { id:'chair',    emoji:'🪑', label:'Cadeira',  tileX:3, tileY:4, widthTiles:1, heightTiles:1, solid:false, color:0xA0522D },

    // BATHROOM (cols 8-13, rows 1-5)
    { id:'toilet',   emoji:'🚽', label:'Vaso',     tileX:9,  tileY:1, widthTiles:1, heightTiles:1, solid:true,  color:0xE8E8E8 },
    { id:'sink',     emoji:'🪥', label:'Pia',      tileX:11, tileY:1, widthTiles:1, heightTiles:1, solid:true,  color:0xE8E8F8 },
    { id:'bathtub',  emoji:'🛁', label:'Banheira', tileX:9,  tileY:3, widthTiles:3, heightTiles:2, solid:true,  color:0xD0D8FF },

    // LIVING / KITCHEN (cols 1-13, rows 7-11)
    { id:'sofa',     emoji:'🛋️', label:'Sofá',     tileX:1,  tileY:8, widthTiles:3, heightTiles:1, solid:false, color:0x4169E1 },
    { id:'tv',       emoji:'📺', label:'TV',       tileX:1,  tileY:7, widthTiles:2, heightTiles:1, solid:true,  color:0x1a1a2e },
    { id:'table',    emoji:'🍽️', label:'Mesa',     tileX:6,  tileY:8, widthTiles:2, heightTiles:2, solid:true,  color:0x8B7355 },
    { id:'stove',    emoji:'🍳', label:'Fogão',    tileX:11, tileY:7, widthTiles:2, heightTiles:1, solid:true,  action:'idle',  color:0x808080 },
    { id:'fridge',   emoji:'🧊', label:'Geladeira',tileX:12, tileY:8, widthTiles:1, heightTiles:2, solid:true,  color:0xD0D0D0 },
  ],
};

export const INTERIORS: Record<string, InteriorDef> = {
  player_home_interior: PLAYER_HOME_INTERIOR,
};
