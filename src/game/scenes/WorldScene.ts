import Phaser from 'phaser';
import {
  T, TILE_SIZE, MAP_WIDTH, MAP_HEIGHT,
  buildMap, BUILDINGS, NPCS, buildingDoorTile,
  type BuildingDef,
} from '../world/NeighborhoodMap';
import { Player } from '../entities/Player';
import { NPC } from '../entities/NPC';
import { TimeSystem } from '../systems/TimeSystem';
import { CollisionMap } from '../systems/CollisionMap';
import { useGameStore } from '@/src/store/gameStore';

// Kenney Tiny Town spritesheet: 12 cols × 11 rows, 16×16 per tile
// Frame 0=grass, 96=stone pavement (road), 97=lighter stone (sidewalk)
// Frame 52=red brick roof, 62=grey roof, 63=grey-purple roof, 64=orange roof
// Frame 60-61=stone wall/window, 72-73=wood wall/window, 84-85=brick wall/window
const KENNEY: Partial<Record<number, number>> = {
  [T.GRASS]:      0,    // green grass
  [T.PARK_GRASS]: 43,   // lighter green (park)
  [T.ROAD_H]:     96,   // grey cobblestone (horizontal) — stone joints match road direction
  [T.ROAD_V]:     96,   // not used (drawVerticalRoads handles this as solid rect)
  [T.ROAD_X]:     96,
  [T.ROAD_TL]:    96,
  [T.ROAD_TR]:    96,
  [T.ROAD_BL]:    96,
  [T.ROAD_BR]:    96,
  [T.SIDEWALK]:   97,   // lighter grey — calçada/sidewalk
  [T.DIRT]:       24,   // sandy dirt
  [T.SAND]:       25,
  [T.WATER]:      8,
  [T.TREE]:       4,    // dark tree canopy
  [T.FLOWER]:     5,    // light bush/shrub
};

// Distinct visual style per building — no tinting, natural Kenney colors
const BUILDING_STYLES: Record<string, {
  wall: number; win: number; roof: number; floor: number;
}> = {
  player_home:      { wall: 72, win: 73, roof: 52, floor: 96 },
  neighbor_house_1: { wall: 84, win: 85, roof: 64, floor: 96 },
  neighbor_house_2: { wall: 72, win: 73, roof: 64, floor: 96 },
  neighbor_house_3: { wall: 84, win: 85, roof: 52, floor: 96 },
  market:           { wall: 60, win: 61, roof: 52, floor: 97 },
  restaurant:       { wall: 72, win: 73, roof: 64, floor: 96 },
  bank:             { wall: 60, win: 61, roof: 63, floor: 97 },
  school:           { wall: 60, win: 61, roof: 64, floor: 97 },
  library:          { wall: 84, win: 85, roof: 52, floor: 96 },
  office:           { wall: 60, win: 61, roof: 63, floor: 97 },
  hospital:         { wall: 60, win: 61, roof: 52, floor: 97 },
  bus_stop:         { wall: 60, win: 60, roof: 63, floor: 97 },
};

const ACTION_ICONS: Record<string, string> = {
  work: '⚒', study: '📖', sleep: '💤', shop: '🛒', visit: '👋', idle: '💬',
};

export class WorldScene extends Phaser.Scene {
  private map!: number[][];
  private buildingTiles: Phaser.GameObjects.Image[] = [];
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
    this.load.spritesheet('terrain', '/assets/tiles/tiny-town.png', {
      frameWidth: 16, frameHeight: 16,
    });
    this.load.spritesheet('indoor', '/assets/tiles/kenney-indoor.png', {
      frameWidth: 16, frameHeight: 16, spacing: 1,
    });
    this.load.spritesheet('player', '/assets/characters/player.png', {
      frameWidth: 32, frameHeight: 64,
    });
    // Furniture sprites (CC0, from OpenGameArt Crimelike pack — 32×32 top-down)
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
    this.renderMap();
    this.renderBuildings();
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

  /** Called by InteriorScene when the player exits back to the world */
  receivePlayerReturn(tileX: number, tileY: number) {
    this.player.teleportTo(tileX, tileY);
    this.cameras.main.fadeIn(300, 0, 0, 0);
    this.transitioning = false;
  }

  private renderMap() {
    // Draw vertical roads as seamless solid rectangles — tile-based approach creates
    // visible horizontal seams (tile shadow edges) that look like railroad tracks
    this.drawVerticalRoads();

    for (let y = 0; y < MAP_HEIGHT; y++) {
      for (let x = 0; x < MAP_WIDTH; x++) {
        const tileType = this.map[y][x];
        if (tileType === T.ROAD_V) continue; // handled by drawVerticalRoads()

        const px = x * TILE_SIZE + TILE_SIZE / 2;
        const py = y * TILE_SIZE + TILE_SIZE / 2;

        const isTree = tileType === T.TREE;
        const frame = isTree ? 0 : (KENNEY[tileType] ?? 0);

        const base = this.add.image(px, py, 'terrain', frame);
        base.setScale(2);
        base.setDepth(0);

        if (isTree) {
          const tree = this.add.image(px, py, 'terrain', 4);
          tree.setScale(2);
          tree.setDepth(1);
        }
      }
    }
  }

  private drawVerticalRoads() {
    // Group consecutive ROAD_V tiles in the same column into single rectangles
    for (let x = 0; x < MAP_WIDTH; x++) {
      let startY = -1;
      for (let y = 0; y <= MAP_HEIGHT; y++) {
        const isRoad = y < MAP_HEIGHT && this.map[y][x] === T.ROAD_V;
        if (isRoad && startY === -1) {
          startY = y;
        } else if (!isRoad && startY !== -1) {
          const px = x * TILE_SIZE;
          const py = startY * TILE_SIZE;
          const w  = TILE_SIZE;
          const h  = (y - startY) * TILE_SIZE;
          // Match the average colour of frame 96 (cobblestone), drawn solid — no seams
          const rect = this.add.rectangle(px + w / 2, py + h / 2, w, h, 0x888898);
          rect.setDepth(0);
          startY = -1;
        }
      }
    }
  }

  private buildCollisionMap() {
    this.collisionMap = new CollisionMap(MAP_WIDTH, MAP_HEIGHT);
    for (const b of BUILDINGS) {
      // Entire building footprint is solid
      this.collisionMap.setRect(b.tileX, b.tileY, b.widthTiles, b.heightTiles, true);
    }
    // Trees are solid
    for (let y = 0; y < MAP_HEIGHT; y++) {
      for (let x = 0; x < MAP_WIDTH; x++) {
        if (this.map[y][x] === T.TREE) this.collisionMap.set(x, y, true);
      }
    }
  }

  private renderBuildings() {
    for (const building of BUILDINGS) {
      this.drawBuilding(building);
    }
  }

  private drawBuilding(b: BuildingDef) {
    const style = BUILDING_STYLES[b.id] ?? BUILDING_STYLES['player_home'];
    const W = b.widthTiles;
    const H = b.heightTiles;
    const doorCol = Math.floor(W / 2);

    // Ground floor (stone pavement under the building)
    for (let tx = 0; tx < W; tx++) {
      const px = b.tileX * TILE_SIZE + tx * TILE_SIZE + TILE_SIZE / 2;
      const py = b.tileY * TILE_SIZE + (H - 1) * TILE_SIZE + TILE_SIZE / 2;
      const floor = this.add.image(px, py, 'terrain', style.floor);
      floor.setScale(2);
      floor.setDepth(4);
    }

    for (let ty = 0; ty < H; ty++) {
      for (let tx = 0; tx < W; tx++) {
        const px = b.tileX * TILE_SIZE + tx * TILE_SIZE + TILE_SIZE / 2;
        const py = b.tileY * TILE_SIZE + ty * TILE_SIZE + TILE_SIZE / 2;

        let frame: number;

        if (ty === 0) {
          // Top roof row — alternate tiles for a ridge texture
          frame = tx % 2 === 0 ? style.roof : style.roof + 1;
        } else if (ty === H - 1 && tx === doorCol) {
          // Door at front center
          frame = 87;
        } else {
          // Wall rows: windows every other column on mid rows
          const showWin = (tx % 2 === 0) && ty > 0 && ty < H - 1;
          frame = showWin ? style.win : style.wall;
        }

        const img = this.add.image(px, py, 'terrain', frame);
        img.setScale(2);
        img.setDepth(5);
        // No heavy tinting — let the Kenney pixel art show naturally
        this.buildingTiles.push(img);
      }
    }

    // Building label — clean and minimal
    const cx = (b.tileX + W / 2) * TILE_SIZE;
    const cy = b.tileY * TILE_SIZE - 4;
    this.add.text(cx, cy, b.label, {
      fontSize: '9px',
      fontFamily: 'monospace',
      color: '#f0e8d0',
      stroke: '#000000',
      strokeThickness: 3,
      align: 'center',
    }).setOrigin(0.5, 1).setDepth(10);
  }

  private createPlayer() {
    const store = useGameStore.getState();
    this.player = new Player({
      scene: this,
      tileX: 3,
      tileY: 6,  // just outside the front door of player_home
      name: store.character?.name ?? 'Você',
    });
  }

  private createNPCs() {
    NPCS.forEach((def, i) => {
      this.npcs.push(new NPC(this, def, i));
    });
  }

  private createCamera() {
    const worldW = MAP_WIDTH * TILE_SIZE;
    const worldH = MAP_HEIGHT * TILE_SIZE;

    this.cameras.main.setBounds(0, 0, worldW, worldH);
    this.cameras.main.startFollow(this.player.sprite, true, 0.08, 0.08);
    // Zoom 2.0x — tiles appear at 64px, character feels right-sized
    this.cameras.main.setZoom(2.0);
  }

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

    this.dayNightOverlay = this.add.rectangle(
      worldW / 2, worldH / 2, worldW, worldH, 0x000033, 0
    );
    this.dayNightOverlay.setDepth(200);
    this.updateDayNight();
  }

  private updateDayNight() {
    const light = this.timeSystem.ambientLight;
    const alpha = Math.max(0, 1 - light) * 0.6;
    this.dayNightOverlay.setAlpha(alpha);
  }

  private createInteractionHint() {
    this.interactionHintBg = this.add.rectangle(0, 0, 120, 24, 0x050b12, 0.85);
    this.interactionHintBg.setStrokeStyle(1, 0x3d5a8a, 0.8);

    this.interactionHintText = this.add.text(0, 0, '', {
      fontSize: '9px',
      fontFamily: 'monospace',
      color: '#7aaee8',
      align: 'center',
    }).setOrigin(0.5);

    this.interactionHint = this.add.container(0, 0, [
      this.interactionHintBg, this.interactionHintText,
    ]);
    this.interactionHint.setDepth(300);
    this.interactionHint.setVisible(false);
  }

  private setupStoreSync() {
    this.time.addEvent({
      delay: 500,
      loop: true,
      callback: () => {
        const store = useGameStore.getState();
        store.setGameTime(this.timeSystem.totalGameMinutes);
        store.setNearbyBuilding(this.nearbyBuilding?.id ?? null);
      },
    });
  }

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

    // Door proximity check (tight — player must be just outside the door)
    this.nearbyDoor = null;
    for (const b of BUILDINGS) {
      if (!b.interiorId) continue;
      const door = buildingDoorTile(b);
      if (Math.abs(px - door.x) <= 1 && py >= door.y && py <= door.y + 2) {
        this.nearbyDoor = b;
        break;
      }
    }

    // General building radius for action menu (skip buildings that use door-enter)
    this.nearbyBuilding = null;
    if (!this.nearbyDoor) {
      for (const b of BUILDINGS) {
        if (b.interiorId) continue; // these use nearbyDoor instead
        const cx = b.tileX + Math.floor(b.widthTiles / 2);
        const cy = b.tileY + Math.floor(b.heightTiles / 2);
        if (Math.abs(px - cx) <= b.interactionRadius &&
            Math.abs(py - cy) <= b.interactionRadius) {
          this.nearbyBuilding = b;
          break;
        }
      }
    }
  }

  private handleInteractKey() {
    if (!Phaser.Input.Keyboard.JustDown(this.interactKey)) return;

    if (this.nearbyDoor?.interiorId) {
      this.enterBuilding(this.nearbyDoor);
      return;
    }
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

    this.showFloatingText(
      this.player.sprite.x,
      this.player.sprite.y - 30,
      icon + ' ' + action,
      0xFFD700,
    );
  }

  private updateInteractionHint() {
    const px = this.player.sprite.x;
    const py = this.player.sprite.y;

    if (this.nearbyDoor) {
      this.interactionHintText.setText(`[E] 🚪 Entrar`);
      this.interactionHint.setPosition(px, py - 36);
      this.interactionHint.setVisible(true);
      return;
    }

    if (this.nearbyBuilding) {
      const action = this.nearbyBuilding.actions[0];
      const icon = action ? (ACTION_ICONS[action] ?? '') : '';
      this.interactionHintText.setText(`[E] ${icon}`);
      this.interactionHint.setPosition(px, py - 36);
      this.interactionHint.setVisible(true);
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
    const colorHex = '#' + color.toString(16).padStart(6, '0');
    const t = this.add.text(x, y, text, {
      fontSize: '11px',
      fontFamily: 'monospace',
      color: colorHex,
      stroke: '#000000',
      strokeThickness: 2,
    }).setOrigin(0.5).setDepth(400);

    this.tweens.add({
      targets: t,
      y: y - 36,
      alpha: 0,
      duration: 1400,
      ease: 'Cubic.easeOut',
      onComplete: () => t.destroy(),
    });
  }
}
