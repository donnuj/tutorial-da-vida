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

// Kenney RPG Urban Pack (CC0) — 27×18, 16×16px, sem espaçamento. Frame = row*27+col
// Terrain: 1=grass | 35=sidewalk | 232=tree top
// Buildings — linhas de 7 frames nas colunas 16-22:
//   Residencial (tijolo): roof[16-22] upper[43-49] mid[70-76] ground[97-103]
//   Comercial (laranja):  roof[124-130] upper[151-157] mid[178-184] ground[205-211]
const URBAN_TERRAIN: Partial<Record<number, number>> = {
  [T.GRASS]:      1,
  [T.PARK_GRASS]: 1,
  [T.SIDEWALK]:   35,
  [T.DIRT]:       1,
  [T.SAND]:       1,
  [T.WATER]:      1,
  [T.FLOWER]:     1,
};

const ROAD_TYPES = new Set<number>([
  T.ROAD_H, T.ROAD_V, T.ROAD_X,
  T.ROAD_TL, T.ROAD_TR, T.ROAD_BL, T.ROAD_BR,
]);

type BuildingRowset = readonly (readonly number[])[];
const BUILDING_ROWS: Record<string, BuildingRowset> = {
  residential: [
    [16, 17, 18, 19, 20, 21, 22],
    [43, 44, 45, 46, 47, 48, 49],
    [70, 71, 72, 73, 74, 75, 76],
    [97, 98, 99, 100, 101, 102, 103],
  ],
  commercial: [
    [124, 125, 126, 127, 128, 129, 130],
    [151, 152, 153, 154, 155, 156, 157],
    [178, 179, 180, 181, 182, 183, 184],
    [205, 206, 207, 208, 209, 210, 211],
  ],
};

const BUILDING_TYPE: Record<string, string> = {
  player_home:      'residential',
  neighbor_house_1: 'residential',
  neighbor_house_2: 'residential',
  neighbor_house_3: 'residential',
  market:           'commercial',
  restaurant:       'commercial',
  bank:             'commercial',
  school:           'commercial',
  library:          'commercial',
  office:           'commercial',
  hospital:         'commercial',
  bus_stop:         'commercial',
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
    this.load.spritesheet('urban', '/assets/tiles/rpg-urban.png', {
      frameWidth: 16, frameHeight: 16,
    });
    // 'terrain' kept for InteriorScene walls (Tiny Town frames 60/72)
    this.load.spritesheet('terrain', '/assets/tiles/tiny-town.png', {
      frameWidth: 16, frameHeight: 16,
    });
    this.load.spritesheet('indoor', '/assets/tiles/kenney-indoor.png', {
      frameWidth: 16, frameHeight: 16, spacing: 1,
    });
    // Puny Characters CC0 — 768×256, 32×32 per frame, 24 cols × 8 rows
    const punyBase = '/assets/puny-chars/Puny-Characters';
    this.load.spritesheet('char_base',         `${punyBase}/Character-Base.png`,  { frameWidth: 32, frameHeight: 32 });
    this.load.spritesheet('char_warrior_blue', `${punyBase}/Warrior-Blue.png`,    { frameWidth: 32, frameHeight: 32 });
    this.load.spritesheet('char_warrior_red',  `${punyBase}/Warrior-Red.png`,     { frameWidth: 32, frameHeight: 32 });
    this.load.spritesheet('char_soldier_blue', `${punyBase}/Soldier-Blue.png`,    { frameWidth: 32, frameHeight: 32 });
    this.load.spritesheet('char_soldier_yellow', `${punyBase}/Soldier-Yellow.png`,{ frameWidth: 32, frameHeight: 32 });
    this.load.spritesheet('char_mage_cyan',    `${punyBase}/Mage-Cyan.png`,       { frameWidth: 32, frameHeight: 32 });
    // Furniture sprites (CC0, Crimelike pack — 32×32 top-down)
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
    for (let y = 0; y < MAP_HEIGHT; y++) {
      for (let x = 0; x < MAP_WIDTH; x++) {
        const tileType = this.map[y][x];
        const px = x * TILE_SIZE + TILE_SIZE / 2;
        const py = y * TILE_SIZE + TILE_SIZE / 2;

        if (ROAD_TYPES.has(tileType)) {
          this.add.rectangle(px, py, TILE_SIZE, TILE_SIZE, 0x888c94).setDepth(0);
          continue;
        }

        const base = this.add.image(px, py, 'urban', URBAN_TERRAIN[tileType] ?? 1);
        base.setScale(2);
        base.setDepth(0);

        if (tileType === T.TREE) {
          const tree = this.add.image(px, py, 'urban', 232);
          tree.setScale(2);
          tree.setDepth(1);
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
    const rows = BUILDING_ROWS[BUILDING_TYPE[b.id] ?? 'commercial'];
    const W = b.widthTiles;
    const H = b.heightTiles;

    for (let ty = 0; ty < H; ty++) {
      let rowTemplate: readonly number[];
      if (ty === 0) {
        rowTemplate = rows[0];
      } else if (ty === H - 1) {
        rowTemplate = rows[rows.length - 1];
      } else {
        const midCount = rows.length - 2;
        const midIdx = midCount > 0 ? ((ty - 1) % midCount) + 1 : 1;
        rowTemplate = rows[Math.min(midIdx, rows.length - 2)];
      }

      for (let tx = 0; tx < W; tx++) {
        const px = b.tileX * TILE_SIZE + tx * TILE_SIZE + TILE_SIZE / 2;
        const py = b.tileY * TILE_SIZE + ty * TILE_SIZE + TILE_SIZE / 2;
        const frame = this.pickBuildingFrame(rowTemplate, tx, W);
        const img = this.add.image(px, py, 'urban', frame);
        img.setScale(2);
        img.setDepth(5);
        this.buildingTiles.push(img);
      }
    }

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

  private pickBuildingFrame(row: readonly number[], colPos: number, totalWidth: number): number {
    if (totalWidth === 1) return row[3];
    if (colPos === 0) return row[0];
    if (colPos === totalWidth - 1) return row[6];
    const midIdx = ((colPos - 1) % 5) + 1;
    return row[midIdx];
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
    NPCS.forEach(def => {
      this.npcs.push(new NPC(this, def));
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
