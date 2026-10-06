import Phaser from 'phaser';
import {
  T, TILE_SIZE, MAP_WIDTH, MAP_HEIGHT,
  buildMap, BUILDINGS, NPCS,
  type BuildingDef,
} from '../world/NeighborhoodMap';
import { Player } from '../entities/Player';
import { NPC } from '../entities/NPC';
import { TimeSystem } from '../systems/TimeSystem';
import { useGameStore } from '@/src/store/gameStore';

// Kenney Tiny Town spritesheet: 12 cols × 11 rows, 16×16 per tile
const KENNEY: Partial<Record<number, number>> = {
  [T.GRASS]:      0,
  [T.PARK_GRASS]: 1,
  [T.ROAD_H]:     48,
  [T.ROAD_V]:     48,
  [T.ROAD_X]:     48,
  [T.ROAD_TL]:    48,
  [T.ROAD_TR]:    48,
  [T.ROAD_BL]:    48,
  [T.ROAD_BR]:    48,
  [T.SIDEWALK]:   97,
  [T.DIRT]:       24,
  [T.SAND]:       24,
  [T.WATER]:      8,
  [T.TREE]:       4,
  [T.FLOWER]:     1,
};

const ACTION_ICONS: Record<string, string> = {
  work: '⚒', study: '📖', sleep: '💤', shop: '🛒', visit: '👋', idle: '💬',
};

export class WorldScene extends Phaser.Scene {
  private map!: number[][];
  private buildingGraphics!: Phaser.GameObjects.Graphics;

  private player!: Player;
  private npcs: NPC[] = [];
  private cursors!: Phaser.Types.Input.Keyboard.CursorKeys;
  private wasd!: Record<string, Phaser.Input.Keyboard.Key>;
  private interactKey!: Phaser.Input.Keyboard.Key;

  private timeSystem!: TimeSystem;
  private dayNightOverlay!: Phaser.GameObjects.Rectangle;

  private nearbyBuilding: BuildingDef | null = null;
  private interactionHint!: Phaser.GameObjects.Container;
  private interactionHintBg!: Phaser.GameObjects.Rectangle;
  private interactionHintText!: Phaser.GameObjects.Text;

  private buildingLabels: Phaser.GameObjects.Container[] = [];

  constructor() {
    super({ key: 'WorldScene' });
  }

  preload() {
    this.load.spritesheet('terrain', '/assets/tiles/tiny-town.png', {
      frameWidth: 16,
      frameHeight: 16,
    });
    this.load.spritesheet('player', '/assets/characters/player.png', {
      frameWidth: 32,
      frameHeight: 64,
    });
  }

  create() {
    this.map = buildMap();
    this.renderMap();
    this.renderBuildings();
    this.createPlayer();
    this.createNPCs();
    this.createCamera();
    this.createInput();
    this.createTimeSystem();
    this.createDayNightOverlay();
    this.createInteractionHint();
    this.createBuildingLabels();
    this.setupStoreSync();
  }

  private renderMap() {
    for (let y = 0; y < MAP_HEIGHT; y++) {
      for (let x = 0; x < MAP_WIDTH; x++) {
        const tileType = this.map[y][x];
        const px = x * TILE_SIZE + TILE_SIZE / 2;
        const py = y * TILE_SIZE + TILE_SIZE / 2;

        // Always render a grass base first (so tree/transparent tiles look right)
        const isTree = tileType === T.TREE;
        const baseFrame = isTree ? 0 : (KENNEY[tileType] ?? 0);

        const base = this.add.image(px, py, 'terrain', baseFrame);
        base.setScale(2);
        base.setDepth(0);

        // Vertical road: rotate 90° so stripes run the right way
        if (tileType === T.ROAD_V) base.setAngle(90);

        // Tree overlay on top of grass base
        if (isTree) {
          const tree = this.add.image(px, py, 'terrain', KENNEY[T.TREE]!);
          tree.setScale(2);
          tree.setDepth(1);
        }
      }
    }
  }

  private renderBuildings() {
    this.buildingGraphics = this.add.graphics();
    this.buildingGraphics.setDepth(5);

    for (const building of BUILDINGS) {
      this.drawBuilding(building);
    }
  }

  private drawBuilding(b: BuildingDef) {
    const x = b.tileX * TILE_SIZE;
    const y = b.tileY * TILE_SIZE;
    const w = b.widthTiles * TILE_SIZE;
    const h = b.heightTiles * TILE_SIZE;

    // Drop shadow
    this.buildingGraphics.fillStyle(0x000000, 0.12);
    this.buildingGraphics.fillRect(x + 4, y + 4, w, h);

    // Building body
    this.buildingGraphics.fillStyle(b.color);
    this.buildingGraphics.fillRect(x, y, w, h);

    // Roof (top 30%)
    const roofH = Math.floor(h * 0.30);
    this.buildingGraphics.fillStyle(b.roofColor);
    this.buildingGraphics.fillRect(x, y, w, roofH);

    // Roof ridge/gable accent
    const ridgeColor = Phaser.Display.Color.IntegerToColor(b.roofColor).darken(25).color;
    this.buildingGraphics.lineStyle(2, ridgeColor, 1);
    this.buildingGraphics.lineBetween(x, y + roofH, x + w, y + roofH);

    // Roofline triangle hint (decorative)
    this.buildingGraphics.fillStyle(ridgeColor, 0.3);
    this.buildingGraphics.fillTriangle(
      x + w / 2, y + 2,
      x + 4,     y + roofH,
      x + w - 4, y + roofH,
    );

    // Windows (two rows if tall enough)
    const winW = 6;
    const winH = 7;
    const wallTop = y + roofH + 6;
    const cols = Math.max(1, Math.floor((w - 16) / 16));
    const windowRows = h > 80 ? 2 : 1;

    for (let row = 0; row < windowRows; row++) {
      const wy = wallTop + row * (winH + 8);
      for (let col = 0; col < cols; col++) {
        const wx = x + 8 + col * Math.floor((w - 16) / Math.max(cols, 1));
        if (wx + winW >= x + w - 4) continue;

        // Window frame
        this.buildingGraphics.fillStyle(0x8BB8D4, 0.95);
        this.buildingGraphics.fillRect(wx, wy, winW, winH);

        // Window highlight
        this.buildingGraphics.fillStyle(0xFFFFFF, 0.35);
        this.buildingGraphics.fillRect(wx + 1, wy + 1, 2, 3);

        // Window frame outline
        this.buildingGraphics.lineStyle(1, 0x5A90B8, 0.8);
        this.buildingGraphics.strokeRect(wx, wy, winW, winH);
      }
    }

    // Door (centered at base)
    const doorW = 8;
    const doorH = 12;
    const doorX = x + Math.floor(w / 2) - doorW / 2;
    const doorY = y + h - doorH;

    this.buildingGraphics.fillStyle(b.roofColor);
    this.buildingGraphics.fillRect(doorX, doorY, doorW, doorH);

    // Door arch top
    this.buildingGraphics.fillStyle(ridgeColor, 0.6);
    this.buildingGraphics.fillRect(doorX, doorY, doorW, 3);

    // Door handle
    this.buildingGraphics.fillStyle(0xFFD700, 0.9);
    this.buildingGraphics.fillCircle(doorX + doorW - 2, doorY + doorH / 2, 1.5);

    // Step
    this.buildingGraphics.fillStyle(0xCCCCCC, 0.8);
    this.buildingGraphics.fillRect(doorX - 2, y + h - 3, doorW + 4, 3);

    // Building outline
    this.buildingGraphics.lineStyle(1.5, 0x333333, 0.6);
    this.buildingGraphics.strokeRect(x, y, w, h);
  }

  private createPlayer() {
    const store = useGameStore.getState();
    this.player = new Player({
      scene: this,
      tileX: 3,
      tileY: 3,
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
    this.cameras.main.startFollow(this.player.sprite, true, 0.1, 0.1);
    this.cameras.main.setZoom(1.5);
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
    this.interactionHintBg = this.add.rectangle(0, 0, 140, 28, 0x000000, 0.75);
    this.interactionHintBg.setStrokeStyle(1, 0xFFD700, 0.9);

    this.interactionHintText = this.add.text(0, 0, '', {
      fontSize: '11px',
      fontFamily: 'monospace',
      color: '#FFD700',
      align: 'center',
    }).setOrigin(0.5);

    this.interactionHint = this.add.container(0, 0, [
      this.interactionHintBg, this.interactionHintText,
    ]);
    this.interactionHint.setDepth(300);
    this.interactionHint.setVisible(false);
  }

  private createBuildingLabels() {
    for (const b of BUILDINGS) {
      const cx = (b.tileX + b.widthTiles / 2) * TILE_SIZE;
      const cy = b.tileY * TILE_SIZE - 6;

      const text = this.add.text(cx, cy, b.label, {
        fontSize: '9px',
        fontFamily: 'monospace',
        color: '#FFFFFF',
        stroke: '#000000',
        strokeThickness: 3,
        align: 'center',
      }).setOrigin(0.5, 1).setDepth(10);

      this.buildingLabels.push(this.add.container(0, 0, [text]));
    }
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
    this.timeSystem.update(delta);
    this.player.update(delta, this.cursors, this.wasd);
    this.checkInteractions();
    this.handleInteractKey();
    this.updateInteractionHint();
    this.highlightNearbyNPCs();
  }

  private checkInteractions() {
    const px = this.player.currentTileX;
    const py = this.player.currentTileY;

    this.nearbyBuilding = null;
    for (const b of BUILDINGS) {
      if (Math.abs(px - (b.tileX + Math.floor(b.widthTiles / 2))) <= b.interactionRadius &&
          Math.abs(py - (b.tileY + Math.floor(b.heightTiles / 2))) <= b.interactionRadius) {
        this.nearbyBuilding = b;
        break;
      }
    }
  }

  private handleInteractKey() {
    if (Phaser.Input.Keyboard.JustDown(this.interactKey) && this.nearbyBuilding) {
      const action = this.nearbyBuilding.actions[0];
      if (action) this.triggerAction(this.nearbyBuilding.id, action);
    }
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
    if (!this.nearbyBuilding) {
      this.interactionHint.setVisible(false);
      return;
    }

    const px = this.player.sprite.x;
    const py = this.player.sprite.y;

    const action = this.nearbyBuilding.actions[0];
    const icon = action ? (ACTION_ICONS[action] ?? '') : '';
    this.interactionHintText.setText(`[E] ${this.nearbyBuilding.label} ${icon}`);
    this.interactionHint.setPosition(px, py - 40);
    this.interactionHint.setVisible(true);
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
      fontSize: '13px',
      fontFamily: 'monospace',
      color: colorHex,
      stroke: '#000000',
      strokeThickness: 3,
    }).setOrigin(0.5).setDepth(400);

    this.tweens.add({
      targets: t,
      y: y - 40,
      alpha: 0,
      duration: 1500,
      ease: 'Cubic.easeOut',
      onComplete: () => t.destroy(),
    });
  }
}
