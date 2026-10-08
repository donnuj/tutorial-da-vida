import Phaser from 'phaser';
import { TILE_SIZE, type NpcDef } from '../world/NeighborhoodMap';

// Puny Characters (CC0) — each sheet is 768×256, 32×32 per frame, 24 cols × 8 rows
// Row 0 (frames  0-23): facing DOWN  — walk frames: cols 0-3
// Row 1 (frames 24-47): facing LEFT  — walk frames: cols 0-3
// Row 2 (frames 48-71): facing RIGHT — walk frames: cols 0-3
// Row 3 (frames 72-95): facing UP    — walk frames: cols 0-3
const NPC_SCALE = 1.3;

// Map each NPC id to a specific Puny Character variant
const NPC_SPRITE: Record<string, string> = {
  ana:               'char_warrior_blue',
  carlos:            'char_soldier_blue',
  professora_maria:  'char_mage_cyan',
  seu_jose:          'char_soldier_yellow',
  lucia:             'char_warrior_red',
};
const DEFAULT_SPRITE = 'char_base';

export class NPC {
  readonly id: string;
  readonly name: string;
  readonly role: string;
  readonly sprite: Phaser.GameObjects.Container;

  private body: Phaser.GameObjects.Sprite;
  private nameLabel: Phaser.GameObjects.Text;

  private scene: Phaser.Scene;
  private schedule: NpcDef['schedule'];
  private scheduleIndex = 0;
  private tileX: number;
  private tileY: number;
  private isMoving = false;
  private waitTimer: Phaser.Time.TimerEvent | null = null;
  private spriteKey: string;

  constructor(scene: Phaser.Scene, def: NpcDef) {
    this.scene    = scene;
    this.id       = def.id;
    this.name     = def.name;
    this.role     = def.role;
    this.schedule = def.schedule;
    this.tileX    = def.startTileX;
    this.tileY    = def.startTileY;
    this.spriteKey = NPC_SPRITE[def.id] ?? DEFAULT_SPRITE;

    const wx = this.tileX * TILE_SIZE + TILE_SIZE / 2;
    const wy = this.tileY * TILE_SIZE + TILE_SIZE / 2;

    const shadow = scene.add.ellipse(0, 12, 18, 6, 0x000000, 0.22);

    this.body = scene.add.sprite(0, -4, this.spriteKey, 0);
    this.body.setScale(NPC_SCALE);

    this.nameLabel = scene.add.text(0, -32, def.name, {
      fontSize: '8px', fontFamily: 'monospace',
      color: '#e8d5b0', stroke: '#000000', strokeThickness: 3, align: 'center',
    }).setOrigin(0.5, 1);

    this.sprite = scene.add.container(wx, wy, [shadow, this.body, this.nameLabel]);
    this.sprite.setDepth(40);

    this.ensureAnimations(scene, this.spriteKey);
    this.body.play(`${this.spriteKey}_idle`, true);
    this.scheduleNextMove();
  }

  get currentTileX() { return this.tileX; }
  get currentTileY() { return this.tileY; }

  distanceTo(tx: number, ty: number): number {
    return Math.abs(this.tileX - tx) + Math.abs(this.tileY - ty);
  }

  setHighlight(on: boolean) {
    this.nameLabel.setColor(on ? '#FFD700' : '#e8d5b0');
  }

  private ensureAnimations(scene: Phaser.Scene, key: string) {
    if (scene.anims.exists(`${key}_idle`)) return;

    scene.anims.create({ key: `${key}_idle`,       frames: [{ key, frame: 0 }],                         frameRate: 1 });
    scene.anims.create({ key: `${key}_walk_down`,  frames: [0,1,2,3].map(f => ({ key, frame: f })),     frameRate: 8, repeat: -1 });
    scene.anims.create({ key: `${key}_walk_left`,  frames: [24,25,26,27].map(f => ({ key, frame: f })), frameRate: 8, repeat: -1 });
    scene.anims.create({ key: `${key}_walk_right`, frames: [48,49,50,51].map(f => ({ key, frame: f })), frameRate: 8, repeat: -1 });
    scene.anims.create({ key: `${key}_walk_up`,    frames: [72,73,74,75].map(f => ({ key, frame: f })), frameRate: 8, repeat: -1 });
  }

  private playWalk(toX: number, toY: number, prevX: number, prevY: number) {
    const dx = toX - prevX;
    const dy = toY - prevY;
    const key = this.spriteKey;
    if      (dx < 0) this.body.play(`${key}_walk_left`,  true);
    else if (dx > 0) this.body.play(`${key}_walk_right`, true);
    else if (dy < 0) this.body.play(`${key}_walk_up`,    true);
    else             this.body.play(`${key}_walk_down`,  true);
  }

  private scheduleNextMove() {
    if (this.schedule.length === 0) return;
    const point = this.schedule[this.scheduleIndex];
    this.waitTimer = this.scene.time.delayedCall(point.waitMs, () => {
      this.scheduleIndex = (this.scheduleIndex + 1) % this.schedule.length;
      const next = this.schedule[this.scheduleIndex];
      this.walkTo(next.tileX, next.tileY);
    });
  }

  private walkTo(toX: number, toY: number) {
    if (this.isMoving) return;
    if (toX === this.tileX && toY === this.tileY) { this.scheduleNextMove(); return; }

    this.isMoving = true;

    const path: { x: number; y: number }[] = [];
    let cx = this.tileX, cy = this.tileY;
    while (cx !== toX) { cx += cx < toX ? 1 : -1; path.push({ x: cx, y: cy }); }
    while (cy !== toY) { cy += cy < toY ? 1 : -1; path.push({ x: cx, y: cy }); }

    const walkNext = () => {
      const step = path.shift();
      if (!step) {
        this.isMoving = false;
        this.body.play(`${this.spriteKey}_idle`, true);
        this.scheduleNextMove();
        return;
      }

      this.playWalk(step.x, step.y, this.tileX, this.tileY);

      this.scene.tweens.add({
        targets: this.sprite,
        x: step.x * TILE_SIZE + TILE_SIZE / 2,
        y: step.y * TILE_SIZE + TILE_SIZE / 2,
        duration: 300,
        ease: 'Linear',
        onComplete: () => {
          this.tileX = step.x;
          this.tileY = step.y;
          walkNext();
        },
      });
    };

    walkNext();
  }

  destroy() {
    this.waitTimer?.destroy();
    this.sprite.destroy();
  }
}
