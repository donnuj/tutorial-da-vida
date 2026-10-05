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

const TILE_COLORS: Record<number, number> = {
  [T.GRASS]:       0x4A7C59,
  [T.ROAD_H]:      0x606060,
  [T.ROAD_V]:      0x606060,
  [T.ROAD_X]:      0x555555,
  [T.ROAD_TL]:     0x606060,
  [T.ROAD_TR]:     0x606060,
  [T.ROAD_BL]:     0x606060,
  [T.ROAD_BR]:     0x606060,
  [T.SIDEWALK]:    0xA0A070,
  [T.DIRT]:        0x8B6914,
  [T.WATER]:       0x1A6FA8,
  [T.SAND]:        0xD4C47A,
  [T.TREE]:        0x2D6A2D,
  [T.FLOWER]:      0xE8A0D0,
  [T.PARK_GRASS]:  0x5A9B69,
};

const TILE_BORDER_COLORS: Record<number, number> = {
  [T.GRASS]:       0x3D6B49,
  [T.ROAD_H]:      0x484848,
  [T.ROAD_V]:      0x484848,
  [T.ROAD_X]:      0x404040,
  [T.SIDEWALK]:    0x888860,
  [T.PARK_GRASS]:  0x4A8B59,
};

const ACTION_ICONS: Record<string, string> = {
  work: '⚒', study: '📖', sleep: '💤', shop: '🛒', visit: '👋', idle: '💬',
};

export class WorldScene extends Phaser.Scene {
  private map!: number[][];
  private tileGraphics!: Phaser.GameObjects.Graphics;
  private buildingGraphics!: Phaser.GameObjects.Graphics;
  private overlayGraphics!: Phaser.GameObjects.Graphics;

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

  create() {
    this.map = buildMap();
    this.createTileTextures();
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

  private createTileTextures() {
    // Create one texture per tile type using Graphics
    const g = this.add.graphics();

    for (const [tileType, color] of Object.entries(TILE_COLORS)) {
      const t = Number(tileType);
      g.clear();
      g.fillStyle(color);
      g.fillRect(0, 0, TILE_SIZE, TILE_SIZE);

      // Border for certain tiles
      const border = TILE_BORDER_COLORS[t];
      if (border !== undefined) {
        g.lineStyle(1, border, 0.5);
        g.strokeRect(0, 0, TILE_SIZE, TILE_SIZE);
      }

      // Road markings
      if (t === T.ROAD_H) {
        g.lineStyle(1, 0xFFFF00, 0.3);
        g.lineBetween(0, TILE_SIZE / 2, TILE_SIZE, TILE_SIZE / 2);
      }
      if (t === T.ROAD_V) {
        g.lineStyle(1, 0xFFFF00, 0.3);
        g.lineBetween(TILE_SIZE / 2, 0, TILE_SIZE / 2, TILE_SIZE);
      }

      // Tree
      if (t === T.TREE) {
        g.fillStyle(0x1A4D1A);
        g.fillCircle(TILE_SIZE / 2, TILE_SIZE / 2, 13);
        g.fillStyle(0x2D7A2D);
        g.fillCircle(TILE_SIZE / 2 - 4, TILE_SIZE / 2 - 2, 8);
        g.fillStyle(0x3D9A3D);
        g.fillCircle(TILE_SIZE / 2 + 3, TILE_SIZE / 2 - 3, 6);
      }

      // Park grass has a lighter shade + dots
      if (t === T.PARK_GRASS) {
        g.fillStyle(0x6BAA79, 0.4);
        for (let i = 0; i < 3; i++) {
          const px = 5 + i * 9;
          const py = 5 + (i % 2) * 12;
          g.fillCircle(px, py, 2);
        }
      }

      g.generateTexture(`tile_${t}`, TILE_SIZE, TILE_SIZE);
    }

    g.destroy();
  }

  private renderMap() {
    this.tileGraphics = this.add.graphics();

    // Use individual sprites for tiles for better performance with camera culling
    for (let y = 0; y < MAP_HEIGHT; y++) {
      for (let x = 0; x < MAP_WIDTH; x++) {
        const tileType = this.map[y][x];
        const key = `tile_${tileType}`;
        if (this.textures.exists(key)) {
          const img = this.add.image(
            x * TILE_SIZE + TILE_SIZE / 2,
            y * TILE_SIZE + TILE_SIZE / 2,
            key
          );
          img.setDepth(0);
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

    // Foundation/shadow
    this.buildingGraphics.fillStyle(0x000000, 0.15);
    this.buildingGraphics.fillRect(x + 3, y + 3, w, h);

    // Building body
    this.buildingGraphics.fillStyle(b.color);
    this.buildingGraphics.fillRect(x, y, w, h);

    // Roof (top 30% of building)
    const roofH = Math.floor(h * 0.35);
    this.buildingGraphics.fillStyle(b.roofColor);
    this.buildingGraphics.fillRect(x, y, w, roofH);

    // Roof ridge line
    this.buildingGraphics.lineStyle(2, Phaser.Display.Color.IntegerToColor(b.roofColor).darken(30).color);
    this.buildingGraphics.lineBetween(x, y + roofH, x + w, y + roofH);

    // Windows
    this.buildingGraphics.fillStyle(0xC8E8FF, 0.9);
    const winSize = 6;
    const winY = y + roofH + 6;
    const cols = Math.floor(w / 16);
    for (let i = 0; i < cols; i++) {
      const winX = x + 8 + i * 16;
      if (winX + winSize < x + w - 2) {
        this.buildingGraphics.fillRect(winX, winY, winSize, winSize);
        this.buildingGraphics.lineStyle(1, 0x90C8E8);
        this.buildingGraphics.strokeRect(winX, winY, winSize, winSize);
      }
    }

    // Door (center bottom)
    const doorW = 8;
    const doorH = 10;
    const doorX = x + Math.floor(w / 2) - doorW / 2;
    const doorY = y + h - doorH;
    this.buildingGraphics.fillStyle(b.roofColor);
    this.buildingGraphics.fillRect(doorX, doorY, doorW, doorH);
    this.buildingGraphics.fillStyle(0x4A2C0A, 0.6);
    this.buildingGraphics.fillCircle(doorX + doorW - 2, doorY + doorH / 2, 1.5);

    // Outline
    this.buildingGraphics.lineStyle(1.5, 0x333333, 0.7);
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
    for (const def of NPCS) {
      this.npcs.push(new NPC(this, def));
    }
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
      const worldX = ptr.worldX;
      const worldY = ptr.worldY;
      const tx = Math.floor(worldX / TILE_SIZE);
      const ty = Math.floor(worldY / TILE_SIZE);
      this.player.moveTo(tx, ty);
    });
  }

  private createTimeSystem() {
    const store = useGameStore.getState();
    const gameMinutes = store.character?.gameAge ?? 0;
    this.timeSystem = new TimeSystem(gameMinutes);

    this.timeSystem.onHourChange = (_, hour) => {
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
    // Sync HUD data to React store every 500ms
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

  update(time: number, delta: number) {
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
      if (action) {
        this.triggerAction(this.nearbyBuilding.id, action);
      }
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
      const dist = npc.distanceTo(px, py);
      npc.setHighlight(dist <= 3);
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
