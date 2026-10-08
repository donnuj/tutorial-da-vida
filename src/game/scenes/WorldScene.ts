import Phaser from 'phaser';
import {
  T, TILE_SIZE, MAP_WIDTH, MAP_HEIGHT,
  buildMap, BUILDINGS, NPCS, STREET_OBJECTS, buildingDoorTile,
  type BuildingDef, type StreetObjectDef,
} from '../world/NeighborhoodMap';
import { Player } from '../entities/Player';
import { NPC } from '../entities/NPC';
import { TimeSystem } from '../systems/TimeSystem';
import { CollisionMap } from '../systems/CollisionMap';
import { useGameStore } from '@/src/store/gameStore';

// ── rpg-urban.png: 27×18 grid, 16×16 tiles, NO spacing
// Frame = row*27 + col
//
// TERRAIN (confirmed via debug):
//   1   = grass / park lawn
//   35  = sidewalk (row 1, col 8)
//
// ROAD tiles:
//   406 = ROAD_H  — row 15 col 1 (asphalt with dashes)
//   380 = ROAD_V  — row 14 col 2 (rotate 0, same tile rotated)
//   439 = ROAD_X  — row 16 col 7 (solid asphalt, intersection)
//
// TREES (row 8+, col 16-18):
//   232 = tree A top  (row 8, col 16)
//   233 = tree B top  (row 8, col 17)
//   234 = tree C top  (row 8, col 18)
//   259 = tree A base (row 9, col 16)  — trunk/base tile
//   260 = tree B base (row 9, col 17)
//   261 = tree C base (row 9, col 18)
//
// BUILDINGS — columns 16-22 (7 tiles wide):
//   Residential (rows 0-3):
//     roof   [16,17,18,19,20,21,22]
//     upper  [43,44,45,46,47,48,49]
//     mid    [70,71,72,73,74,75,76]
//     ground [97,98,99,100,101,102,103]
//   Commercial (rows 4-7):
//     roof   [124,125,126,127,128,129,130]
//     upper  [151,152,153,154,155,156,157]
//     mid    [178,179,180,181,182,183,184]
//     ground [205,206,207,208,209,210,211]

// Depth layers
const DEPTH = {
  GROUND:       0,
  ROAD:         1,
  GROUND_DECOR: 2,
  BLDG_SHADOW:  3,
  BLDG_LOWER:   5,
  BLDG_UPPER:   6,
  BLDG_ROOF:    7,
  OBJ_SHADOW:   8,
  STREET_OBJ:   9,
  TREE_BASE:    10,
  NPC:          40,
  PLAYER:       50,
  TREE_CROWN:   60,
  BLDG_LABEL:   65,
  DAY_NIGHT:    200,
  HINT:         300,
} as const;

const ROAD_TYPES = new Set<number>([
  T.ROAD_H, T.ROAD_V, T.ROAD_X,
  T.ROAD_TL, T.ROAD_TR, T.ROAD_BL, T.ROAD_BR,
]);

// Building frame rows indexed by archetype
type BuildingRowset = readonly (readonly number[])[];
const BLDG_FRAMES: Record<string, BuildingRowset> = {
  house: [
    [16, 17, 18, 19, 20, 21, 22],   // roof
    [43, 44, 45, 46, 47, 48, 49],   // upper
    [70, 71, 72, 73, 74, 75, 76],   // mid
    [97, 98, 99, 100, 101, 102, 103], // ground
  ],
  shop: [
    [124, 125, 126, 127, 128, 129, 130],
    [151, 152, 153, 154, 155, 156, 157],
    [178, 179, 180, 181, 182, 183, 184],
    [205, 206, 207, 208, 209, 210, 211],
  ],
  office: [
    [124, 125, 126, 127, 128, 129, 130],
    [151, 152, 153, 154, 155, 156, 157],
    [151, 152, 153, 154, 155, 156, 157],
    [178, 179, 180, 181, 182, 183, 184],
    [205, 206, 207, 208, 209, 210, 211],
  ],
  institution: [
    [16, 17, 18, 19, 20, 21, 22],
    [43, 44, 45, 46, 47, 48, 49],
    [43, 44, 45, 46, 47, 48, 49],
    [70, 71, 72, 73, 74, 75, 76],
    [97, 98, 99, 100, 101, 102, 103],
  ],
  public_service: [
    [124, 125, 126, 127, 128, 129, 130],
    [178, 179, 180, 181, 182, 183, 184],
    [205, 206, 207, 208, 209, 210, 211],
  ],
};

const ACTION_ICONS: Record<string, string> = {
  work: '⚒', study: '📖', sleep: '💤', shop: '🛒', visit: '👋', idle: '💬',
};

// Street object visual definitions
const STREET_OBJ_DEF: Record<StreetObjectDef['type'], {
  color: number; accentColor: number;
  w: number; h: number;
  drawFn: (g: Phaser.GameObjects.Graphics, cx: number, cy: number) => void;
}> = {
  lamp: {
    color: 0x8a8070, accentColor: 0xFFEE88,
    w: 4, h: 24,
    drawFn: (g, cx, cy) => {
      // Pole
      g.fillStyle(0x6a6050, 1);
      g.fillRect(cx - 2, cy - 20, 4, 22);
      // Arm
      g.fillRect(cx - 2, cy - 20, 8, 3);
      // Lamp head
      g.fillStyle(0x504030, 1);
      g.fillRect(cx + 4, cy - 24, 8, 6);
      // Glow
      g.fillStyle(0xFFEE88, 0.9);
      g.fillRect(cx + 5, cy - 23, 6, 4);
    },
  },
  bench: {
    color: 0x8B6914, accentColor: 0xA07828,
    w: 24, h: 10,
    drawFn: (g, cx, cy) => {
      // Legs
      g.fillStyle(0x5a3c0a, 1);
      g.fillRect(cx - 12, cy - 2, 4, 8);
      g.fillRect(cx + 8,  cy - 2, 4, 8);
      // Seat
      g.fillStyle(0x9B7520, 1);
      g.fillRoundedRect(cx - 13, cy - 6, 26, 5, 2);
      // Back
      g.fillStyle(0x8B6914, 1);
      g.fillRoundedRect(cx - 13, cy - 14, 26, 5, 2);
      // Armrests
      g.fillStyle(0x6a4a10, 1);
      g.fillRect(cx - 14, cy - 14, 3, 14);
      g.fillRect(cx + 11, cy - 14, 3, 14);
    },
  },
  trash: {
    color: 0x4a6030, accentColor: 0x3a5020,
    w: 12, h: 16,
    drawFn: (g, cx, cy) => {
      g.fillStyle(0x3a5020, 1);
      g.fillRect(cx - 6, cy - 14, 12, 14);
      g.fillStyle(0x2a3a10, 1);
      g.fillRect(cx - 7, cy - 16, 14, 4);
      // Lid
      g.fillStyle(0x506030, 1);
      g.fillRect(cx - 6, cy - 18, 12, 3);
    },
  },
  mailbox: {
    color: 0x2244aa, accentColor: 0xffffff,
    w: 14, h: 18,
    drawFn: (g, cx, cy) => {
      // Pole
      g.fillStyle(0x888888, 1);
      g.fillRect(cx - 1, cy - 16, 3, 16);
      // Box
      g.fillStyle(0x1a3399, 1);
      g.fillRoundedRect(cx - 7, cy - 26, 14, 10, 3);
      // Highlight
      g.fillStyle(0x2255cc, 1);
      g.fillRoundedRect(cx - 6, cy - 25, 12, 4, 2);
      // Slot
      g.fillStyle(0x000033, 1);
      g.fillRect(cx - 4, cy - 20, 8, 2);
    },
  },
  sign: {
    color: 0xE8C840, accentColor: 0x000000,
    w: 14, h: 20,
    drawFn: (g, cx, cy) => {
      g.fillStyle(0x888888, 1);
      g.fillRect(cx - 1, cy - 20, 3, 20);
      g.fillStyle(0xE8C840, 1);
      g.fillRect(cx - 8, cy - 26, 16, 10);
      g.fillStyle(0x000000, 1);
      g.fillRect(cx - 6, cy - 24, 12, 6);
    },
  },
  flower_pot: {
    color: 0xcc4422, accentColor: 0x44aa22,
    w: 10, h: 12,
    drawFn: (g, cx, cy) => {
      // Pot (trapezoid via polygon)
      g.fillStyle(0xcc4422, 1);
      g.fillPoints([
        { x: cx - 4, y: cy - 10 }, { x: cx + 4,  y: cy - 10 },
        { x: cx + 6,  y: cy }, { x: cx - 6, y: cy },
      ], true);
      // Soil
      g.fillStyle(0x6b3a1a, 1);
      g.fillRect(cx - 5, cy - 13, 10, 4);
      // Plant
      g.fillStyle(0x44aa22, 1);
      g.fillCircle(cx, cy - 17, 5);
      g.fillCircle(cx - 4, cy - 15, 3);
      g.fillCircle(cx + 4, cy - 15, 3);
      // Flower center
      g.fillStyle(0xFFDD00, 1);
      g.fillCircle(cx, cy - 17, 2);
    },
  },
  fire_hydrant: {
    color: 0xcc2222, accentColor: 0xffffff,
    w: 10, h: 14,
    drawFn: (g, cx, cy) => {
      g.fillStyle(0xaa1111, 1);
      g.fillRect(cx - 4, cy - 12, 8, 12);
      g.fillStyle(0xcc2222, 1);
      g.fillRoundedRect(cx - 5, cy - 14, 10, 5, 3);
      // Top cap
      g.fillStyle(0xcc2222, 1);
      g.fillCircle(cx, cy - 15, 4);
      // Side nozzles
      g.fillStyle(0xaa1111, 1);
      g.fillRect(cx - 8, cy - 8, 3, 4);
      g.fillRect(cx + 5, cy - 8, 3, 4);
      // Highlights
      g.fillStyle(0xff4444, 0.7);
      g.fillRect(cx - 2, cy - 12, 2, 8);
    },
  },
};

// Deterministic per-tile hash — avoids visible diagonal/stripe patterns
function tileHash(x: number, y: number): number {
  let h = (x * 1664525 + y * 1013904223) | 0;
  h ^= h >>> 16;
  return h >>> 0;
}

export class WorldScene extends Phaser.Scene {
  private map!: number[][];
  private collisionMap!: CollisionMap;

  private player!: Player;
  private npcs: NPC[] = [];
  private cursors!: Phaser.Types.Input.Keyboard.CursorKeys;
  private wasd!: Record<string, Phaser.Input.Keyboard.Key>;
  private interactKey!: Phaser.Input.Keyboard.Key;

  private timeSystem!: TimeSystem;
  private dayNightOverlay!: Phaser.GameObjects.Rectangle;

  private nearbyBuilding: BuildingDef | null = null;
  private nearbyDoor: BuildingDef | null = null;
  private interactionHint!: Phaser.GameObjects.Container;
  private interactionHintBg!: Phaser.GameObjects.Rectangle;
  private interactionHintText!: Phaser.GameObjects.Text;
  private transitioning = false;

  constructor() {
    super({ key: 'WorldScene' });
  }

  preload() {
    this.load.spritesheet('urban', '/assets/tiles/rpg-urban.png', {
      frameWidth: 16, frameHeight: 16,
    });
    this.load.spritesheet('terrain', '/assets/tiles/tiny-town.png', {
      frameWidth: 16, frameHeight: 16,
    });
    this.load.spritesheet('indoor', '/assets/tiles/kenney-indoor.png', {
      frameWidth: 16, frameHeight: 16, spacing: 1,
    });

    const punyBase = '/assets/puny-chars/Puny-Characters';
    this.load.spritesheet('char_base',           `${punyBase}/Character-Base.png`,  { frameWidth: 32, frameHeight: 32 });
    this.load.spritesheet('char_warrior_blue',   `${punyBase}/Warrior-Blue.png`,    { frameWidth: 32, frameHeight: 32 });
    this.load.spritesheet('char_warrior_red',    `${punyBase}/Warrior-Red.png`,     { frameWidth: 32, frameHeight: 32 });
    this.load.spritesheet('char_soldier_blue',   `${punyBase}/Soldier-Blue.png`,    { frameWidth: 32, frameHeight: 32 });
    this.load.spritesheet('char_soldier_yellow', `${punyBase}/Soldier-Yellow.png`,  { frameWidth: 32, frameHeight: 32 });
    this.load.spritesheet('char_mage_cyan',      `${punyBase}/Mage-Cyan.png`,       { frameWidth: 32, frameHeight: 32 });

    this.load.image('f_bed',     '/assets/furniture/bed_wooden_s.png');
    this.load.image('f_bath',    '/assets/furniture/bath_full_e.png');
    this.load.image('f_sofa',    '/assets/furniture/sofa_down_1.png');
    this.load.image('f_desk',    '/assets/furniture/desk1.png');
    this.load.image('f_stove',   '/assets/furniture/oven1.png');
    this.load.image('f_fridge',  '/assets/furniture/counter_wooden_red.png');
    this.load.image('f_hifi',    '/assets/furniture/hifi.png');
  }

  create() {
    this.map = buildMap();
    this.renderGround();
    this.renderBuildings();
    this.renderStreetObjects();
    this.renderTrees();
    this.buildCollisionMap();
    this.createPlayer();
    this.createNPCs();
    this.createCamera();
    this.createInput();
    this.createTimeSystem();
    this.createDayNightOverlay();
    this.createInteractionHint();
    this.setupStoreSync();
  }

  receivePlayerReturn(tileX: number, tileY: number) {
    this.player.teleportTo(tileX, tileY);
    this.cameras.main.fadeIn(300, 0, 0, 0);
    this.transitioning = false;
  }

  // ── Ground layer (roads, sidewalk, grass, park, flower) ──────────────────
  private renderGround() {
    for (let y = 0; y < MAP_HEIGHT; y++) {
      for (let x = 0; x < MAP_WIDTH; x++) {
        const t = this.map[y][x];
        const px = x * TILE_SIZE + TILE_SIZE / 2;
        const py = y * TILE_SIZE + TILE_SIZE / 2;

        if (ROAD_TYPES.has(t)) {
          this.renderRoadTile(px, py, t);
          continue;
        }

        // Ground base — hash-based variation avoids diagonal stripe artifacts
        const h = tileHash(x, y);
        const grassFrame = (h % 7 === 0) ? 28 : 1;
        if (t === T.SIDEWALK) {
          this.add.image(px, py, 'urban', 35).setScale(2).setDepth(DEPTH.GROUND);
        } else if (t === T.PARK_GRASS) {
          this.add.image(px, py, 'urban', 1).setScale(2).setDepth(DEPTH.GROUND);
          // Park overlay — slightly darker green tint via tint
          const pg = this.add.image(px, py, 'urban', 1).setScale(2).setDepth(DEPTH.GROUND);
          pg.setTint(0x88cc66);
        } else {
          this.add.image(px, py, 'urban', grassFrame).setScale(2).setDepth(DEPTH.GROUND);
        }

        // Ground details
        if (t === T.FLOWER) {
          this.renderFlowerTile(px, py);
        } else if (t === T.BUSH) {
          this.renderBushTile(px, py);
        }
      }
    }
  }

  private renderRoadTile(px: number, py: number, t: number) {
    // Asphalt base
    const asphalt = this.add.image(px, py, 'urban', 439).setScale(2).setDepth(DEPTH.GROUND);
    asphalt.setTint(0x999999);

    // Road markings
    if (t === T.ROAD_H) {
      const mark = this.add.image(px, py, 'urban', 406).setScale(2).setDepth(DEPTH.ROAD);
      mark.setTint(0xbbbbbb);
    } else if (t === T.ROAD_V) {
      const mark = this.add.image(px, py, 'urban', 406).setScale(2).setRotation(Math.PI / 2).setDepth(DEPTH.ROAD);
      mark.setTint(0xbbbbbb);
    } else if (t === T.ROAD_X) {
      // Plain intersection
      this.add.image(px, py, 'urban', 439).setScale(2).setDepth(DEPTH.ROAD);
    }
  }

  private renderFlowerTile(px: number, py: number) {
    const g = this.add.graphics().setDepth(DEPTH.GROUND_DECOR);
    const colors = [0xFF6688, 0xFFDD44, 0xFF99AA, 0x88DDFF];
    const c = colors[Math.floor(Math.random() * colors.length)];
    g.fillStyle(0x55aa33, 1); g.fillCircle(px, py, 5);
    g.fillStyle(c, 1); g.fillCircle(px - 2, py - 3, 2); g.fillCircle(px + 2, py - 3, 2);
    g.fillStyle(0xFFDD44, 1); g.fillCircle(px, py - 2, 2);
  }

  private renderBushTile(px: number, py: number) {
    const g = this.add.graphics().setDepth(DEPTH.TREE_CROWN);
    g.fillStyle(0x336622, 0.9); g.fillCircle(px, py, 10);
    g.fillStyle(0x448833, 1); g.fillCircle(px - 5, py, 7); g.fillCircle(px + 5, py, 7); g.fillCircle(px, py - 5, 7);
    g.fillStyle(0x55aa44, 0.5); g.fillCircle(px - 3, py - 3, 4);
    // Shadow
    this.add.ellipse(px, py + 4, 16, 6, 0x000000, 0.20).setDepth(DEPTH.OBJ_SHADOW);
  }

  // ── Buildings ─────────────────────────────────────────────────────────────
  private renderBuildings() {
    for (const b of BUILDINGS) {
      this.renderBuildingShadow(b);
      this.drawBuilding(b);
    }
  }

  private renderBuildingShadow(b: BuildingDef) {
    const sw = b.widthTiles * TILE_SIZE;
    const sh = 8;
    const sx = b.tileX * TILE_SIZE + sw / 2 + 6;
    const sy = (b.tileY + b.heightTiles) * TILE_SIZE + sh / 2;
    this.add.rectangle(sx, sy, sw - 4, sh, 0x000000, 0.22).setDepth(DEPTH.BLDG_SHADOW);
  }

  private drawBuilding(b: BuildingDef) {
    const archetype = b.archetype ?? 'shop';
    const rows = BLDG_FRAMES[archetype] ?? BLDG_FRAMES.shop;
    const W = b.widthTiles;
    const H = b.heightTiles;
    const doorCol = b.doorX ?? Math.floor(W / 2);

    for (let ty = 0; ty < H; ty++) {
      const isRoof   = ty === 0;
      const isGround = ty === H - 1;
      const depth = isRoof ? DEPTH.BLDG_ROOF : isGround ? DEPTH.BLDG_LOWER : DEPTH.BLDG_UPPER;

      let rowTemplate: readonly number[];
      if (isRoof) {
        rowTemplate = rows[0];
      } else if (isGround) {
        rowTemplate = rows[rows.length - 1];
      } else {
        const midRows = rows.slice(1, rows.length - 1);
        if (midRows.length === 0) {
          rowTemplate = rows[0];
        } else {
          rowTemplate = midRows[(ty - 1) % midRows.length];
        }
      }

      for (let tx = 0; tx < W; tx++) {
        const px = b.tileX * TILE_SIZE + tx * TILE_SIZE + TILE_SIZE / 2;
        const py = b.tileY * TILE_SIZE + ty * TILE_SIZE + TILE_SIZE / 2;

        const frame = this.pickBuildingFrame(rowTemplate, tx, W);
        const img = this.add.image(px, py, 'urban', frame);
        img.setScale(2).setDepth(depth);

        // Door visualization on ground row center column
        if (isGround && tx === doorCol && b.interiorId) {
          this.add.rectangle(px, py + 4, TILE_SIZE - 8, TILE_SIZE - 4, 0x3a2010, 1).setDepth(depth + 0.5);
          this.add.rectangle(px, py + 4, TILE_SIZE - 10, TILE_SIZE - 6, 0x1a0808, 0.7).setDepth(depth + 0.6);
        }
      }
    }

    // Building name label — at top of roof, small, styled
    const cx = (b.tileX + W / 2) * TILE_SIZE;
    const cy = b.tileY * TILE_SIZE - 6;
    this.add.text(cx, cy, b.label, {
      fontSize: '7px',
      fontFamily: 'monospace',
      color: '#e8d8b8',
      stroke: '#1a0e06',
      strokeThickness: 3,
      align: 'center',
    }).setOrigin(0.5, 1).setDepth(DEPTH.BLDG_LABEL);

    // Facade detail: windows, door, awnings
    this.drawBuildingFacade(b);
  }

  private drawBuildingFacade(b: BuildingDef) {
    const W = b.widthTiles;
    const H = b.heightTiles;
    const doorCol = b.doorX ?? Math.floor(W / 2);
    const archetype = b.archetype ?? 'shop';
    const isCommercial = archetype === 'shop' || archetype === 'office';

    // One Graphics per building to minimize draw calls
    const g = this.add.graphics().setDepth(DEPTH.BLDG_ROOF + 0.5);

    for (let ty = 1; ty < H; ty++) {  // skip roof row
      const isGround = ty === H - 1;

      for (let tx = 0; tx < W; tx++) {
        const px = b.tileX * TILE_SIZE + tx * TILE_SIZE + TILE_SIZE / 2;
        const py = b.tileY * TILE_SIZE + ty * TILE_SIZE + TILE_SIZE / 2;

        if (isGround && tx === doorCol) {
          // Door frame
          g.fillStyle(0x1a0c04, 1);
          g.fillRect(px - 7, py - 9, 14, 18);
          g.fillStyle(0x3a1a08, 1);
          g.fillRect(px - 6, py - 8, 12, 16);
          // Door knob
          g.fillStyle(0xccaa44, 1);
          g.fillCircle(px + 4, py + 1, 2);
          // Door panel divider
          g.fillStyle(0x1a0c04, 0.6);
          g.fillRect(px - 6, py - 1, 12, 1);
        } else if (isGround && isCommercial && H > 2) {
          // Shop vitrine
          g.fillStyle(0x1a0c04, 1);
          g.fillRect(px - 13, py - 9, 26, 13);
          g.fillStyle(0x88ddee, 0.35);
          g.fillRect(px - 12, py - 8, 24, 11);
          // Awning
          g.fillStyle(0xcc3322, 1);
          g.fillRect(px - 15, py - 16, 30, 6);
          // Awning stripe
          g.fillStyle(0x992211, 1);
          for (let i = 0; i < 5; i++) {
            g.fillRect(px - 14 + i * 6, py - 16, 3, 6);
          }
        } else if (!isGround) {
          // Window — two panes with cross dividers
          g.fillStyle(0x1a0c04, 1);
          g.fillRect(px - 11, py - 8, 9, 11);
          g.fillRect(px + 2, py - 8, 9, 11);
          g.fillStyle(0x88ccdd, 0.5);
          g.fillRect(px - 10, py - 7, 7, 9);
          g.fillRect(px + 3, py - 7, 7, 9);
          // Cross dividers
          g.fillStyle(0x1a0c04, 0.85);
          g.fillRect(px - 7, py - 7, 1, 9);
          g.fillRect(px - 10, py - 3, 7, 1);
          g.fillRect(px + 6, py - 7, 1, 9);
          g.fillRect(px + 3, py - 3, 7, 1);
          // Sill
          g.fillStyle(0x2a1408, 1);
          g.fillRect(px - 12, py + 3, 11, 2);
          g.fillRect(px + 1, py + 3, 11, 2);
        }
      }
    }
  }

  private pickBuildingFrame(row: readonly number[], colPos: number, totalWidth: number): number {
    if (totalWidth === 1) return row[3] ?? row[0];
    if (colPos === 0) return row[0];
    if (colPos === totalWidth - 1) return row[6] ?? row[row.length - 1];
    const midIdx = ((colPos - 1) % 5) + 1;
    return row[Math.min(midIdx, row.length - 2)] ?? row[1];
  }

  // ── Street objects ─────────────────────────────────────────────────────────
  private renderStreetObjects() {
    for (const obj of STREET_OBJECTS) {
      this.renderStreetObject(obj);
    }
  }

  private renderStreetObject(obj: StreetObjectDef) {
    const px = obj.tileX * TILE_SIZE + TILE_SIZE / 2;
    const py = obj.tileY * TILE_SIZE + TILE_SIZE / 2;
    const def = STREET_OBJ_DEF[obj.type];
    if (!def) return;

    // Shadow
    this.add.ellipse(px + 3, py + def.h / 2, def.w + 6, 5, 0x000000, 0.20).setDepth(DEPTH.OBJ_SHADOW);

    const g = this.add.graphics().setDepth(DEPTH.STREET_OBJ);
    def.drawFn(g, px, py);
  }

  // ── Trees — split into base (depth 10) and crown (depth 60, above player) ──
  private renderTrees() {
    for (let y = 0; y < MAP_HEIGHT; y++) {
      for (let x = 0; x < MAP_WIDTH; x++) {
        const t = this.map[y][x];
        if (t !== T.TREE && t !== T.TREE_ALT) continue;
        const px = x * TILE_SIZE + TILE_SIZE / 2;
        const py = y * TILE_SIZE + TILE_SIZE / 2;
        this.renderTree(px, py, t === T.TREE_ALT);
      }
    }
  }

  private renderTree(px: number, py: number, alternate: boolean) {
    // Ground shadow
    this.add.ellipse(px + 4, py + 8, 26, 10, 0x000000, 0.22).setDepth(DEPTH.GROUND_DECOR);

    // Trunk (slightly below player layer)
    const trunkFrame = alternate ? 260 : 259;
    const trunk = this.add.image(px, py + 4, 'urban', trunkFrame);
    trunk.setScale(2).setDepth(DEPTH.TREE_BASE);
    // Fallback if trunk frame doesn't exist: draw programmatic trunk
    trunk.on('error', () => {
      trunk.destroy();
      const tg = this.add.graphics().setDepth(DEPTH.TREE_BASE);
      tg.fillStyle(0x6b3a1a, 1);
      tg.fillRect(px - 3, py, 6, 12);
    });

    // Crown (ABOVE player — creates depth illusion)
    const crownFrame = alternate ? 233 : 232;
    const crown = this.add.image(px, py - 6, 'urban', crownFrame);
    crown.setScale(2).setDepth(DEPTH.TREE_CROWN);
  }

  // ── Collision ──────────────────────────────────────────────────────────────
  private buildCollisionMap() {
    this.collisionMap = new CollisionMap(MAP_WIDTH, MAP_HEIGHT);

    for (const b of BUILDINGS) {
      // Block entire building footprint
      this.collisionMap.setRect(b.tileX, b.tileY, b.widthTiles, b.heightTiles, true);
      // Unblock door tile so player can approach from outside
      const door = buildingDoorTile(b);
      this.collisionMap.set(door.x, door.y, false);
    }

    // Trees block movement
    for (let y = 0; y < MAP_HEIGHT; y++) {
      for (let x = 0; x < MAP_WIDTH; x++) {
        const t = this.map[y][x];
        if (t === T.TREE || t === T.TREE_ALT || t === T.BUSH) {
          this.collisionMap.set(x, y, true);
        }
      }
    }
  }

  // ── Player / NPC ───────────────────────────────────────────────────────────
  private createPlayer() {
    const store = useGameStore.getState();
    this.player = new Player({
      scene: this,
      tileX: 6,
      tileY: 5,
      name: store.character?.name ?? 'Você',
    });
  }

  private createNPCs() {
    NPCS.forEach(def => { this.npcs.push(new NPC(this, def)); });
  }

  // ── Camera ────────────────────────────────────────────────────────────────
  private createCamera() {
    const worldW = MAP_WIDTH * TILE_SIZE;
    const worldH = MAP_HEIGHT * TILE_SIZE;
    this.cameras.main.setBounds(0, 0, worldW, worldH);
    this.cameras.main.startFollow(this.player.sprite, true, 0.08, 0.08);
    this.cameras.main.setZoom(this.calcZoom(this.cameras.main.width, this.cameras.main.height));

    // Recompute zoom whenever the renderer is resized (responsive across all resolutions)
    this.scale.on('resize', (gameSize: Phaser.Structs.Size) => {
      this.cameras.main.setZoom(this.calcZoom(gameSize.width, gameSize.height));
    });
  }

  private calcZoom(viewW: number, viewH: number): number {
    const worldW = MAP_WIDTH * TILE_SIZE;
    const worldH = MAP_HEIGHT * TILE_SIZE;
    // Ensure the map always fills the viewport (no black bars on any axis)
    const minToFill = Math.max(viewW / worldW, viewH / worldH);
    // Prefer zoom 2.0 for comfortable tile size; increase only if viewport is larger than map
    return Math.max(2.0, minToFill);
  }

  // ── Input ─────────────────────────────────────────────────────────────────
  private createInput() {
    this.cursors = this.input.keyboard!.createCursorKeys();
    this.wasd = {
      w: this.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.W),
      a: this.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.A),
      s: this.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.S),
      d: this.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.D),
    };
    this.interactKey = this.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.E);

    this.input.on('pointerdown', (ptr: Phaser.Input.Pointer) => {
      const tx = Math.floor(ptr.worldX / TILE_SIZE);
      const ty = Math.floor(ptr.worldY / TILE_SIZE);
      this.player.moveTo(tx, ty);
    });
  }

  // ── Time ──────────────────────────────────────────────────────────────────
  private createTimeSystem() {
    const store = useGameStore.getState();
    const gameMinutes = store.character?.gameAge ?? 0;
    this.timeSystem = new TimeSystem(gameMinutes);
    this.timeSystem.onHourChange = () => {
      this.updateDayNight();
      useGameStore.getState().setGameTime(this.timeSystem.totalGameMinutes);
    };
  }

  private createDayNightOverlay() {
    const worldW = MAP_WIDTH * TILE_SIZE;
    const worldH = MAP_HEIGHT * TILE_SIZE;
    this.dayNightOverlay = this.add.rectangle(worldW / 2, worldH / 2, worldW, worldH, 0x000033, 0);
    this.dayNightOverlay.setDepth(DEPTH.DAY_NIGHT);
    this.updateDayNight();
  }

  private updateDayNight() {
    const alpha = Math.max(0, 1 - this.timeSystem.ambientLight) * 0.6;
    this.dayNightOverlay.setAlpha(alpha);
  }

  // ── Interaction hint ──────────────────────────────────────────────────────
  private createInteractionHint() {
    this.interactionHintBg = this.add.rectangle(0, 0, 120, 24, 0x050b12, 0.85);
    this.interactionHintBg.setStrokeStyle(1, 0x3d5a8a, 0.8);
    this.interactionHintText = this.add.text(0, 0, '', {
      fontSize: '9px', fontFamily: 'monospace', color: '#7aaee8', align: 'center',
    }).setOrigin(0.5);
    this.interactionHint = this.add.container(0, 0, [this.interactionHintBg, this.interactionHintText]);
    this.interactionHint.setDepth(DEPTH.HINT).setVisible(false);
  }

  private setupStoreSync() {
    this.time.addEvent({
      delay: 500, loop: true,
      callback: () => {
        const store = useGameStore.getState();
        store.setGameTime(this.timeSystem.totalGameMinutes);
        store.setNearbyBuilding(this.nearbyBuilding?.id ?? null);
      },
    });
  }

  // ── Update ────────────────────────────────────────────────────────────────
  update(_time: number, delta: number) {
    if (this.transitioning) return;
    this.timeSystem.update(delta);
    this.player.update(delta, this.cursors, this.wasd, this.collisionMap);
    this.checkInteractions();
    this.handleInteractKey();
    this.updateInteractionHint();
    this.highlightNearbyNPCs();
  }

  private checkInteractions() {
    const px = this.player.currentTileX;
    const py = this.player.currentTileY;

    this.nearbyDoor = null;
    for (const b of BUILDINGS) {
      if (!b.interiorId) continue;
      const door = buildingDoorTile(b);
      if (Math.abs(px - door.x) <= 1 && py >= door.y && py <= door.y + 2) {
        this.nearbyDoor = b;
        break;
      }
    }

    this.nearbyBuilding = null;
    if (!this.nearbyDoor) {
      for (const b of BUILDINGS) {
        if (b.interiorId) continue;
        const cx = b.tileX + Math.floor(b.widthTiles / 2);
        const cy = b.tileY + Math.floor(b.heightTiles / 2);
        if (Math.abs(px - cx) <= b.interactionRadius && Math.abs(py - cy) <= b.interactionRadius) {
          this.nearbyBuilding = b;
          break;
        }
      }
    }
  }

  private handleInteractKey() {
    if (!Phaser.Input.Keyboard.JustDown(this.interactKey)) return;
    if (this.nearbyDoor?.interiorId) { this.enterBuilding(this.nearbyDoor); return; }
    if (this.nearbyBuilding) {
      const action = this.nearbyBuilding.actions[0];
      if (action) this.triggerAction(this.nearbyBuilding.id, action);
    }
  }

  private enterBuilding(b: BuildingDef) {
    if (this.transitioning || !b.interiorId) return;
    this.transitioning = true;
    this.cameras.main.fadeOut(300, 0, 0, 0);
    this.cameras.main.once('camerafadeoutcomplete', () => {
      this.scene.sleep('WorldScene');
      this.scene.run('InteriorScene', { interiorId: b.interiorId });
    });
  }

  private triggerAction(buildingId: string, action: string) {
    const store = useGameStore.getState();
    store.triggerAction({ buildingId, action });
    const icon = ACTION_ICONS[action] ?? '?';
    this.player.setAnimation(action as 'work' | 'study' | 'sleep');
    this.player.setActivityIcon(icon);
    this.showFloatingText(this.player.sprite.x, this.player.sprite.y - 30, icon + ' ' + action, 0xFFD700);
  }

  private updateInteractionHint() {
    const px = this.player.sprite.x;
    const py = this.player.sprite.y;

    if (this.nearbyDoor) {
      this.interactionHintText.setText('[E] Entrar');
      this.interactionHintBg.setSize(this.interactionHintText.width + 20, 24);
      this.interactionHint.setPosition(px, py - 40).setVisible(true);
      return;
    }
    if (this.nearbyBuilding) {
      const action = this.nearbyBuilding.actions[0];
      const icon = action ? (ACTION_ICONS[action] ?? '') : '';
      this.interactionHintText.setText(`[E] ${icon}`);
      this.interactionHintBg.setSize(this.interactionHintText.width + 20, 24);
      this.interactionHint.setPosition(px, py - 40).setVisible(true);
      return;
    }
    this.interactionHint.setVisible(false);
  }

  private highlightNearbyNPCs() {
    const px = this.player.currentTileX;
    const py = this.player.currentTileY;
    for (const npc of this.npcs) {
      npc.setHighlight(npc.distanceTo(px, py) <= 3);
    }
  }

  private showFloatingText(x: number, y: number, text: string, color: number) {
    const hex = '#' + color.toString(16).padStart(6, '0');
    const t = this.add.text(x, y, text, {
      fontSize: '11px', fontFamily: 'monospace', color: hex,
      stroke: '#000000', strokeThickness: 2,
    }).setOrigin(0.5).setDepth(400);
    this.tweens.add({ targets: t, y: y - 36, alpha: 0, duration: 1400, ease: 'Cubic.easeOut', onComplete: () => t.destroy() });
  }
}
