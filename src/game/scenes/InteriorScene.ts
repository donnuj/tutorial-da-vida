import Phaser from 'phaser';
import { Player } from '../entities/Player';
import { CollisionMap } from '../systems/CollisionMap';
import { INTERIORS, type InteriorDef, type FurnitureDef } from '../world/InteriorDefs';

const TILE_SIZE = 32;

// ── Mapping from furniture id → loaded image key ────────────────────────────
const FURNITURE_SPRITE: Record<string, string> = {
  bed:     'f_bed',
  bathtub: 'f_bath',
  sofa:    'f_sofa',
  desk:    'f_desk',
  stove:   'f_stove',
  fridge:  'f_fridge',
  tv:      'f_hifi',
};

// ── Kenney Indoor (roguelikeIndoor) — 26 cols × 19 rows, 16×16, spacing 1
// Frame = row * 26 + col
// Approximate frames (verified via visual inspection of roguelikeIndoor image):
//   Row 12, col 0 = frame 312  — wood plank floor (warm brown)
//   Row 13, col 0 = frame 338  — stone/tile floor (gray)
//   Row 14, col 0 = frame 364  — carpet green
//   Row 15, col 0 = frame 390  — carpet orange/red
//
// For walls: the interior uses solid colored rectangles with depth gradient
// since kenney-indoor wall frames require per-tileset mapping.

const DEPTH = {
  FLOOR:      0,
  FLOOR_DET:  1,   // carpet pattern, baseboard
  SHADOW:     2,   // wall/object shadows
  WALL:       3,
  WALL_DET:   4,   // window, door frame overlay
  EXIT:       5,
  FURNITURE:  6,
  FURN_LABEL: 7,
  PLAYER:     50,
  HINT:       300,
} as const;

// Room color palette — warm residential feel
const ROOM = {
  WALL_DARK:   0x2d1e0e,   // outer wall dark
  WALL_MID:    0x4a2c10,   // inner wall face
  WALL_LIGHT:  0x6b3e18,   // lit wall top
  FLOOR_WARM:  0x8b6420,   // wood floor base
  FLOOR_ALT:   0x7a5a1a,   // wood floor alternate plank
  FLOOR_STONE: 0x7a8090,   // stone tile (bathroom)
  FLOOR_STONE2:0x9098a8,
  CARPET_MAIN: 0x2244aa,   // living room carpet
  CARPET_EDGE: 0x1a3388,
  BASEBOARD:   0x3a2010,
  SKIRTING:    0x2a1808,
} as const;

interface InitData {
  interiorId: string;
}

export class InteriorScene extends Phaser.Scene {
  private def!: InteriorDef;
  private player!: Player;
  private collision!: CollisionMap;
  private cursors!: Phaser.Types.Input.Keyboard.CursorKeys;
  private wasd!: Record<string, Phaser.Input.Keyboard.Key>;
  private interactKey!: Phaser.Input.Keyboard.Key;

  private hintBg!: Phaser.GameObjects.Rectangle;
  private hintText!: Phaser.GameObjects.Text;
  private hintContainer!: Phaser.GameObjects.Container;

  private nearbyAction: string | null = null;
  private furnitureDefs: FurnitureDef[] = [];

  constructor() {
    super({ key: 'InteriorScene' });
  }

  init(data: InitData) {
    this.def = INTERIORS[data.interiorId];
  }

  create() {
    const mapW = this.def.tiles[0].length;
    const mapH = this.def.tiles.length;

    this.cameras.main.setBounds(0, 0, mapW * TILE_SIZE, mapH * TILE_SIZE);
    this.cameras.main.setZoom(2.0);
    this.cameras.main.setBackgroundColor('#1a0e06');

    this.buildCollisionMap(mapW, mapH);
    this.renderFloor(mapW, mapH);
    this.renderWalls(mapW, mapH);
    this.renderFurniture();
    this.renderRoomLabels();

    this.player = new Player({
      scene: this,
      tileX: this.def.spawnX,
      tileY: this.def.spawnY,
      name: '',
    });

    this.cameras.main.startFollow(this.player.sprite, true, 0.1, 0.1);

    this.cursors    = this.input.keyboard!.createCursorKeys();
    this.wasd = {
      w: this.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.W),
      a: this.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.A),
      s: this.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.S),
      d: this.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.D),
    };
    this.interactKey = this.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.E);

    this.createHint();
    this.cameras.main.fadeIn(300, 0, 0, 0);
  }

  // ── Floor rendering ────────────────────────────────────────────────────────
  private renderFloor(mapW: number, mapH: number) {
    for (let y = 0; y < mapH; y++) {
      for (let x = 0; x < mapW; x++) {
        const type = this.def.tiles[y][x];
        if (type === 1) continue; // wall — no floor underneath
        const px = x * TILE_SIZE + TILE_SIZE / 2;
        const py = y * TILE_SIZE + TILE_SIZE / 2;

        const inBathroom = x >= 8 && x <= 12 && y >= 1 && y <= 5;
        const inSala     = x >= 1 && x <= 14 && y >= 7 && y <= 16;
        const inCozinha  = x >= 16 && x <= 22 && y >= 7 && y <= 16;

        if (inBathroom) {
          // Alternating stone tile pattern
          const col = (x + y) % 2 === 0 ? ROOM.FLOOR_STONE : ROOM.FLOOR_STONE2;
          this.add.rectangle(px, py, TILE_SIZE, TILE_SIZE, col).setDepth(DEPTH.FLOOR);
          // Grout lines
          const g = this.add.graphics().setDepth(DEPTH.FLOOR_DET);
          g.lineStyle(1, 0x5a6070, 0.6);
          g.strokeRect(px - TILE_SIZE / 2, py - TILE_SIZE / 2, TILE_SIZE, TILE_SIZE);
        } else if (inSala) {
          // Wood floor with plank direction (horizontal)
          const col = y % 2 === 0 ? ROOM.FLOOR_WARM : ROOM.FLOOR_ALT;
          this.add.rectangle(px, py, TILE_SIZE, TILE_SIZE, col).setDepth(DEPTH.FLOOR);
          // Plank lines
          const g = this.add.graphics().setDepth(DEPTH.FLOOR_DET);
          g.lineStyle(1, 0x5a3a08, 0.4);
          g.lineBetween(px - TILE_SIZE / 2, py, px + TILE_SIZE / 2, py);
          // Knot dots occasionally
          if ((x * 3 + y * 7) % 11 === 0) {
            g.fillStyle(0x4a2a08, 0.3);
            g.fillCircle(px + 4, py - 4, 2);
          }
          // Carpet overlay in living room
          if (x >= 1 && x <= 5 && y >= 9 && y <= 11) {
            this.add.rectangle(px, py, TILE_SIZE, TILE_SIZE, ROOM.CARPET_MAIN, 0.55).setDepth(DEPTH.FLOOR_DET);
          }
        } else if (inCozinha) {
          // Tile floor (kitchen)
          const col = (x + y) % 2 === 0 ? 0xd4b890 : 0xbea070;
          this.add.rectangle(px, py, TILE_SIZE, TILE_SIZE, col).setDepth(DEPTH.FLOOR);
          const g = this.add.graphics().setDepth(DEPTH.FLOOR_DET);
          g.lineStyle(1, 0x8a6040, 0.4);
          g.strokeRect(px - TILE_SIZE / 2, py - TILE_SIZE / 2, TILE_SIZE, TILE_SIZE);
        } else {
          // Default — wood
          const col = y % 2 === 0 ? ROOM.FLOOR_WARM : ROOM.FLOOR_ALT;
          this.add.rectangle(px, py, TILE_SIZE, TILE_SIZE, col).setDepth(DEPTH.FLOOR);
          const g = this.add.graphics().setDepth(DEPTH.FLOOR_DET);
          g.lineStyle(1, 0x5a3a08, 0.35);
          g.lineBetween(px - TILE_SIZE / 2, py, px + TILE_SIZE / 2, py);
        }

        // Exit door tile
        if (type === 2) {
          this.add.rectangle(px, py, TILE_SIZE - 2, TILE_SIZE - 2, 0x3a2010, 0.5).setDepth(DEPTH.EXIT);
          this.add.text(px, py - 2, '🚪', { fontSize: '14px' }).setOrigin(0.5).setDepth(DEPTH.EXIT + 1);
        }
      }
    }
  }

  // ── Wall rendering ─────────────────────────────────────────────────────────
  private renderWalls(mapW: number, mapH: number) {
    for (let y = 0; y < mapH; y++) {
      for (let x = 0; x < mapW; x++) {
        if (this.def.tiles[y][x] !== 1) continue;
        const px = x * TILE_SIZE + TILE_SIZE / 2;
        const py = y * TILE_SIZE + TILE_SIZE / 2;

        // Wall face
        this.add.rectangle(px, py, TILE_SIZE, TILE_SIZE, ROOM.WALL_DARK).setDepth(DEPTH.WALL);

        // Determine which sides are open (adjacent to walkable)
        const openSouth = y + 1 < mapH && this.def.tiles[y + 1][x] !== 1;
        const openNorth = y > 0 && this.def.tiles[y - 1][x] !== 1;
        const openEast  = x + 1 < mapW && this.def.tiles[y][x + 1] !== 1;
        const openWest  = x > 0 && this.def.tiles[y][x - 1] !== 1;

        // Wall face detail (lighter top for the wall facing player, south-open)
        if (openSouth) {
          // This wall has a visible face toward the south
          const face = this.add.rectangle(px, py + 4, TILE_SIZE, TILE_SIZE / 2 - 2, ROOM.WALL_MID);
          face.setDepth(DEPTH.WALL_DET);
          // Wall top edge highlight
          const top = this.add.rectangle(px, py - TILE_SIZE / 2 + 2, TILE_SIZE, 4, ROOM.WALL_LIGHT);
          top.setDepth(DEPTH.WALL_DET);
        } else if (openNorth) {
          // Top-facing wall
          const face = this.add.rectangle(px, py - 4, TILE_SIZE, TILE_SIZE / 2 - 2, ROOM.WALL_LIGHT);
          face.setDepth(DEPTH.WALL_DET);
        }

        if (openEast) {
          const face = this.add.rectangle(px + TILE_SIZE / 4, py, TILE_SIZE / 2, TILE_SIZE, ROOM.WALL_MID);
          face.setDepth(DEPTH.WALL_DET);
        }
        if (openWest) {
          const face = this.add.rectangle(px - TILE_SIZE / 4, py, TILE_SIZE / 2, TILE_SIZE, ROOM.WALL_MID);
          face.setDepth(DEPTH.WALL_DET);
        }

        // Corner accent
        if ((openSouth || openNorth) && (openEast || openWest)) {
          this.add.rectangle(px, py, 4, 4, ROOM.WALL_LIGHT, 0.5).setDepth(DEPTH.WALL_DET);
        }

        // Baseboard on floor-adjacent walls (south-open walls show baseboard)
        if (openSouth) {
          this.add.rectangle(px, py + TILE_SIZE / 2 - 3, TILE_SIZE, 4, ROOM.BASEBOARD).setDepth(DEPTH.WALL_DET);
        }
      }
    }

    // Skirting board along inner room edges
    for (let y = 0; y < mapH; y++) {
      for (let x = 0; x < mapW; x++) {
        if (this.def.tiles[y][x] !== 0) continue;
        // Check if adjacent to wall on north
        if (y > 0 && this.def.tiles[y - 1][x] === 1) {
          const px = x * TILE_SIZE + TILE_SIZE / 2;
          const py = y * TILE_SIZE + TILE_SIZE / 2;
          this.add.rectangle(px, py - TILE_SIZE / 2 + 3, TILE_SIZE, 4, ROOM.SKIRTING).setDepth(DEPTH.FLOOR_DET);
        }
        // Check if adjacent to wall on left
        if (x > 0 && this.def.tiles[y][x - 1] === 1) {
          const px = x * TILE_SIZE + TILE_SIZE / 2;
          const py = y * TILE_SIZE + TILE_SIZE / 2;
          this.add.rectangle(px - TILE_SIZE / 2 + 3, py, 4, TILE_SIZE, ROOM.SKIRTING).setDepth(DEPTH.FLOOR_DET);
        }
        if (x + 1 < mapW && this.def.tiles[y][x + 1] === 1) {
          const px = x * TILE_SIZE + TILE_SIZE / 2;
          const py = y * TILE_SIZE + TILE_SIZE / 2;
          this.add.rectangle(px + TILE_SIZE / 2 - 3, py, 4, TILE_SIZE, ROOM.SKIRTING).setDepth(DEPTH.FLOOR_DET);
        }
      }
    }
  }

  // ── Furniture ─────────────────────────────────────────────────────────────
  private renderFurniture() {
    for (const f of this.def.furniture) {
      const pw = f.widthTiles  * TILE_SIZE;
      const ph = f.heightTiles * TILE_SIZE;
      const cx = f.tileX * TILE_SIZE + pw / 2;
      const cy = f.tileY * TILE_SIZE + ph / 2;

      // Furniture shadow
      this.add.rectangle(cx + 3, cy + 4, pw - 4, ph - 2, 0x000000, 0.20).setDepth(DEPTH.FURNITURE - 1);

      const spriteKey = FURNITURE_SPRITE[f.id];
      if (spriteKey && this.textures.exists(spriteKey)) {
        const img = this.add.image(cx, cy, spriteKey);
        img.setDisplaySize(pw, ph).setDepth(DEPTH.FURNITURE);
      } else {
        // Fallback programmatic furniture
        const g = this.add.graphics().setDepth(DEPTH.FURNITURE);
        g.fillStyle(f.color, 1);
        g.fillRoundedRect(f.tileX * TILE_SIZE + 2, f.tileY * TILE_SIZE + 2, pw - 4, ph - 4, 4);
        // Darker edge/shadow
        g.lineStyle(2, Phaser.Display.Color.IntegerToColor(f.color).darken(30).color, 1);
        g.strokeRoundedRect(f.tileX * TILE_SIZE + 2, f.tileY * TILE_SIZE + 2, pw - 4, ph - 4, 4);

        this.add.text(cx, cy, f.emoji, {
          fontSize: `${Math.min(f.widthTiles, f.heightTiles) * 14}px`,
        }).setOrigin(0.5).setDepth(DEPTH.FURN_LABEL);
      }
    }
  }

  // ── Room labels ───────────────────────────────────────────────────────────
  private renderRoomLabels() {
    const labels = [
      { text: 'QUARTO',   x: 3.5, y: 3   },
      { text: 'BANHEIRO', x: 10,  y: 3   },
      { text: 'ESTUDO',   x: 19,  y: 3   },
      { text: 'SALA',     x: 7,   y: 11  },
      { text: 'COZINHA',  x: 19,  y: 11  },
    ];
    for (const l of labels) {
      this.add.text(l.x * TILE_SIZE, l.y * TILE_SIZE, l.text, {
        fontSize: '6px', fontFamily: 'monospace',
        color: 'rgba(255,240,210,0.15)',
      }).setOrigin(0.5).setDepth(DEPTH.FLOOR_DET);
    }
  }

  // ── Collision ─────────────────────────────────────────────────────────────
  private buildCollisionMap(mapW: number, mapH: number) {
    this.collision = new CollisionMap(mapW, mapH);
    for (let y = 0; y < mapH; y++) {
      for (let x = 0; x < mapW; x++) {
        if (this.def.tiles[y][x] === 1) this.collision.set(x, y, true);
      }
    }
    for (const f of this.def.furniture) {
      if (f.solid) this.collision.setRect(f.tileX, f.tileY, f.widthTiles, f.heightTiles, true);
    }
    this.furnitureDefs = this.def.furniture;
  }

  // ── Hint ──────────────────────────────────────────────────────────────────
  private createHint() {
    this.hintBg   = this.add.rectangle(0, 0, 140, 26, 0x050b12, 0.85);
    this.hintBg.setStrokeStyle(1, 0x3d5a8a, 0.8);
    this.hintText = this.add.text(0, 0, '', {
      fontSize: '9px', fontFamily: 'monospace', color: '#7aaee8', align: 'center',
    }).setOrigin(0.5);
    this.hintContainer = this.add.container(0, 0, [this.hintBg, this.hintText]);
    this.hintContainer.setDepth(DEPTH.HINT).setScrollFactor(0).setVisible(false);
  }

  // ── Update ────────────────────────────────────────────────────────────────
  update(_time: number, delta: number) {
    this.player.update(delta, this.cursors, this.wasd, this.collision);
    this.checkNearby();
    this.updateHint();
    if (Phaser.Input.Keyboard.JustDown(this.interactKey) && this.nearbyAction) {
      this.handleInteract();
    }
  }

  private checkNearby() {
    const px = this.player.currentTileX;
    const py = this.player.currentTileY;
    this.nearbyAction = null;

    const { exitTileX, exitTileY } = this.def;
    if (Math.abs(px - exitTileX) <= 1 && Math.abs(py - exitTileY) <= 1) {
      this.nearbyAction = 'exit';
      return;
    }
    for (const f of this.furnitureDefs) {
      if (!f.action) continue;
      const inX = px >= f.tileX - 1 && px <= f.tileX + f.widthTiles;
      const inY = py >= f.tileY - 1 && py <= f.tileY + f.heightTiles;
      if (inX && inY) { this.nearbyAction = f.id; return; }
    }
  }

  private updateHint() {
    if (!this.nearbyAction) { this.hintContainer.setVisible(false); return; }
    const cam  = this.cameras.main;
    const px   = (this.player.sprite.x - cam.scrollX) * cam.zoom;
    const py   = (this.player.sprite.y - cam.scrollY) * cam.zoom - 50;

    let label = '';
    if (this.nearbyAction === 'exit') {
      label = '[E] Sair';
    } else {
      const f = this.furnitureDefs.find(f => f.id === this.nearbyAction);
      if (f) label = `[E] ${f.emoji} ${f.label}`;
    }
    this.hintText.setText(label);
    this.hintBg.setSize(this.hintText.width + 24, 26);
    this.hintContainer.setPosition(px, py).setVisible(true);
  }

  private handleInteract() {
    if (this.nearbyAction === 'exit') { this.leaveInterior(); return; }
    const f = this.furnitureDefs.find(f => f.id === this.nearbyAction);
    if (f?.action) {
      this.showFloatingText(
        this.player.sprite.x, this.player.sprite.y - 30,
        ({ sleep:'💤 Dormindo', study:'📖 Estudando', idle:'😌 Descansando' }[f.action]) ?? f.action,
        0xFFD700,
      );
    }
  }

  private leaveInterior() {
    this.cameras.main.fadeOut(300, 0, 0, 0);
    this.cameras.main.once('camerafadeoutcomplete', () => {
      const world = this.scene.get('WorldScene') as { receivePlayerReturn?: (x: number, y: number) => void };
      if (world?.receivePlayerReturn) {
        world.receivePlayerReturn(this.def.returnX, this.def.returnY);
      }
      this.scene.stop('InteriorScene');
      this.scene.wake('WorldScene');
    });
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
