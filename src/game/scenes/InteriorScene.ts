import Phaser from 'phaser';
import { Player } from '../entities/Player';
import { CollisionMap } from '../systems/CollisionMap';
import { INTERIORS, type InteriorDef, type FurnitureDef } from '../world/InteriorDefs';

const TILE_SIZE = 32;

// Tiny-Town (terrain) frames — 12 cols × 11 rows, 16×16, sem spacing
// Floor: 25 = piso warm/creme, 96 = pedra cinza limpa (banheiro)
// Wall:  72 = madeira, 60 = pedra
const WALL_FRAME  = 72;
const WALL_FRAME2 = 60;
const FLOOR_WOOD  = 25;
const FLOOR_STONE = 96;

// Mapping from furniture id → loaded image key (CC0 crimelike sprites, 32×32)
const FURNITURE_SPRITE: Record<string, string> = {
  bed:     'f_bed',
  bathtub: 'f_bath',
  sofa:    'f_sofa',
  desk:    'f_desk',
  stove:   'f_stove',
  fridge:  'f_fridge',
  tv:      'f_hifi',
};

interface InitData {
  interiorId: string;
  returnX: number;
  returnY: number;
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

  private nearbyAction: string | null = null; // 'exit' | furniture action id
  private furnitureDefs: FurnitureDef[] = [];

  constructor() {
    super({ key: 'InteriorScene' });
  }

  init(data: InitData) {
    this.def = INTERIORS[data.interiorId];
  }

  // Assets are already loaded by WorldScene — reuse from Phaser cache
  create() {
    const mapW = this.def.tiles[0].length;
    const mapH = this.def.tiles.length;

    this.buildCollisionMap(mapW, mapH);
    this.renderTiles(mapW, mapH);
    this.renderFurniture();
    this.renderLabels(mapW, mapH);

    this.player = new Player({
      scene: this,
      tileX: this.def.spawnX,
      tileY: this.def.spawnY,
      name: '',
    });

    this.cameras.main.setBounds(0, 0, mapW * TILE_SIZE, mapH * TILE_SIZE);
    this.cameras.main.startFollow(this.player.sprite, true, 0.1, 0.1);
    this.cameras.main.setZoom(2.5);
    this.cameras.main.setBackgroundColor('#c4a882');

    this.cursors    = this.input.keyboard!.createCursorKeys();
    this.wasd = {
      w: this.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.W),
      a: this.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.A),
      s: this.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.S),
      d: this.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.D),
    };
    this.interactKey = this.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.E);

    this.createHint();

    // Fade in
    this.cameras.main.fadeIn(300, 0, 0, 0);
  }

  private buildCollisionMap(mapW: number, mapH: number) {
    this.collision = new CollisionMap(mapW, mapH);
    for (let y = 0; y < mapH; y++) {
      for (let x = 0; x < mapW; x++) {
        // 1 = wall (blocked). 0 and 2 (exit) are walkable.
        if (this.def.tiles[y][x] === 1) this.collision.set(x, y, true);
      }
    }
    // Furniture solid tiles
    for (const f of this.def.furniture) {
      if (f.solid) this.collision.setRect(f.tileX, f.tileY, f.widthTiles, f.heightTiles, true);
    }
    this.furnitureDefs = this.def.furniture;
  }

  private renderTiles(mapW: number, mapH: number) {
    for (let y = 0; y < mapH; y++) {
      for (let x = 0; x < mapW; x++) {
        const type = this.def.tiles[y][x];
        const px = x * TILE_SIZE + TILE_SIZE / 2;
        const py = y * TILE_SIZE + TILE_SIZE / 2;
        const isBathroom = x >= 8 && y <= 5;

        if (type === 1) {
          // Parede sólida — tom escuro diferenciando área
          this.add.rectangle(px, py, TILE_SIZE, TILE_SIZE, 0x4a3020).setDepth(2);
        } else {
          // Chão: warm tan para salas, cinza azulado para banheiro
          const floorFrame = isBathroom ? FLOOR_STONE : FLOOR_WOOD;
          const floor = this.add.image(px, py, 'terrain', floorFrame);
          floor.setScale(2).setDepth(0);

          if (type === 2) {
            // Porta de saída — marcador visual sutil
            this.add.rectangle(px, py, TILE_SIZE - 4, TILE_SIZE - 4, 0x6a4830, 0.6).setDepth(1);
            this.add.text(px, py, '🚪', { fontSize: '14px' })
              .setOrigin(0.5).setDepth(3);
          }
        }
      }
    }
  }

  private renderFurniture() {
    for (const f of this.def.furniture) {
      const pw = f.widthTiles  * TILE_SIZE;
      const ph = f.heightTiles * TILE_SIZE;
      const cx = f.tileX * TILE_SIZE + pw / 2;
      const cy = f.tileY * TILE_SIZE + ph / 2;

      const spriteKey = FURNITURE_SPRITE[f.id];
      if (spriteKey && this.textures.exists(spriteKey)) {
        const img = this.add.image(cx, cy, spriteKey);
        img.setDisplaySize(pw, ph).setDepth(4);
      } else {
        // Fallback: colored rectangle for items without a sprite yet
        const g = this.add.graphics().setDepth(4);
        g.fillStyle(f.color, 1);
        g.fillRoundedRect(
          f.tileX * TILE_SIZE + 2, f.tileY * TILE_SIZE + 2,
          pw - 4, ph - 4, 4,
        );
        this.add.text(cx, cy, f.emoji, {
          fontSize: `${Math.min(f.widthTiles, f.heightTiles) * 14}px`,
        }).setOrigin(0.5).setDepth(5);
      }
    }
  }

  private renderLabels(mapW: number, mapH: number) {
    // Room labels in muted text
    const labels = [
      { text: 'QUARTO',   x: 3,   y: 3   },
      { text: 'BANHEIRO', x: 11,  y: 3   },
      { text: 'SALA',     x: 4,   y: 9.5 },
      { text: 'COZINHA',  x: 11,  y: 9.5 },
    ];
    for (const l of labels) {
      this.add.text(l.x * TILE_SIZE, l.y * TILE_SIZE, l.text, {
        fontSize: '7px', fontFamily: 'monospace',
        color: 'rgba(0,0,0,0.2)',
      }).setOrigin(0.5).setDepth(1);
    }
    void mapW; void mapH;
  }

  private createHint() {
    this.hintBg   = this.add.rectangle(0, 0, 140, 26, 0x050b12, 0.85);
    this.hintBg.setStrokeStyle(1, 0x3d5a8a, 0.8);
    this.hintText = this.add.text(0, 0, '', {
      fontSize: '9px', fontFamily: 'monospace', color: '#7aaee8', align: 'center',
    }).setOrigin(0.5);
    this.hintContainer = this.add.container(0, 0, [this.hintBg, this.hintText]);
    this.hintContainer.setDepth(300).setScrollFactor(0).setVisible(false);
  }

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

    // Exit door
    const { exitTileX, exitTileY } = this.def;
    if (Math.abs(px - exitTileX) <= 1 && Math.abs(py - exitTileY) <= 1) {
      this.nearbyAction = 'exit';
      return;
    }

    // Furniture
    for (const f of this.furnitureDefs) {
      if (!f.action) continue;
      const inX = px >= f.tileX - 1 && px <= f.tileX + f.widthTiles;
      const inY = py >= f.tileY - 1 && py <= f.tileY + f.heightTiles;
      if (inX && inY) {
        this.nearbyAction = f.id;
        return;
      }
    }
  }

  private updateHint() {
    if (!this.nearbyAction) {
      this.hintContainer.setVisible(false);
      return;
    }

    const cam   = this.cameras.main;
    const px    = (this.player.sprite.x - cam.scrollX) * cam.zoom;
    const py    = (this.player.sprite.y - cam.scrollY) * cam.zoom - 50;

    let label = '';
    if (this.nearbyAction === 'exit') {
      label = '[E] Sair';
    } else {
      const f = this.furnitureDefs.find(f => f.id === this.nearbyAction);
      if (f) label = `[E] ${f.emoji} ${f.label}`;
    }

    this.hintText.setText(label);
    this.hintBg.setSize(this.hintText.width + 24, 26);
    this.hintContainer.setPosition(px, py);
    this.hintContainer.setVisible(true);
  }

  private handleInteract() {
    if (this.nearbyAction === 'exit') {
      this.leaveInterior();
      return;
    }
    const f = this.furnitureDefs.find(f => f.id === this.nearbyAction);
    if (f?.action) {
      // Trigger action (extend later: sleep, study, etc.)
      this.showFloatingText(
        this.player.sprite.x,
        this.player.sprite.y - 30,
        ({ sleep:'💤 Dormindo', study:'📖 Estudando', idle:'😌 Descansando' }[f.action]) ?? f.action,
        0xFFD700,
      );
    }
  }

  private leaveInterior() {
    this.cameras.main.fadeOut(300, 0, 0, 0);
    this.cameras.main.once('camerafadeoutcomplete', () => {
      // Wake up the world scene and set player return position
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
