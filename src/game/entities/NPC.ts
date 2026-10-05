import Phaser from 'phaser';
import { TILE_SIZE, type NpcDef } from '../world/NeighborhoodMap';

export class NPC {
  readonly id: string;
  readonly name: string;
  readonly role: string;
  readonly sprite: Phaser.GameObjects.Container;

  private body: Phaser.GameObjects.Rectangle;
  private head: Phaser.GameObjects.Ellipse;
  private nameLabel: Phaser.GameObjects.Text;
  private shadow: Phaser.GameObjects.Ellipse;

  private scene: Phaser.Scene;
  private schedule: NpcDef['schedule'];
  private scheduleIndex = 0;
  private tileX: number;
  private tileY: number;
  private isMoving = false;
  private waitTimer: Phaser.Time.TimerEvent | null = null;
  private idleTween: Phaser.Tweens.Tween | null = null;

  constructor(scene: Phaser.Scene, def: NpcDef) {
    this.scene = scene;
    this.id = def.id;
    this.name = def.name;
    this.role = def.role;
    this.schedule = def.schedule;
    this.tileX = def.startTileX;
    this.tileY = def.startTileY;

    const wx = this.tileX * TILE_SIZE + TILE_SIZE / 2;
    const wy = this.tileY * TILE_SIZE + TILE_SIZE / 2;

    this.shadow = scene.add.ellipse(0, 10, 18, 7, 0x000000, 0.15);

    this.body = scene.add.rectangle(0, 4, 14, 18, def.color);
    this.body.setStrokeStyle(1, Phaser.Display.Color.IntegerToColor(def.color).darken(20).color);

    this.head = scene.add.ellipse(0, -9, 14, 14, def.headColor);
    this.head.setStrokeStyle(1, 0xC68642);

    this.nameLabel = scene.add.text(0, -21, def.name, {
      fontSize: '8px',
      fontFamily: 'monospace',
      color: '#FFFFFF',
      stroke: '#000000',
      strokeThickness: 2,
      align: 'center',
    }).setOrigin(0.5, 1);

    this.sprite = scene.add.container(wx, wy, [
      this.shadow, this.body, this.head, this.nameLabel,
    ]);
    this.sprite.setDepth(40);

    this.startIdleAnimation();
    this.scheduleNextMove();
  }

  get worldX() { return this.tileX * TILE_SIZE + TILE_SIZE / 2; }
  get worldY() { return this.tileY * TILE_SIZE + TILE_SIZE / 2; }
  get currentTileX() { return this.tileX; }
  get currentTileY() { return this.tileY; }

  distanceTo(tx: number, ty: number): number {
    return Math.abs(this.tileX - tx) + Math.abs(this.tileY - ty);
  }

  setHighlight(on: boolean) {
    if (on) {
      this.nameLabel.setColor('#FFD700');
      this.body.setStrokeStyle(2, 0xFFD700);
    } else {
      this.nameLabel.setColor('#FFFFFF');
      this.body.setStrokeStyle(1, Phaser.Display.Color.IntegerToColor(this.body.fillColor).darken(20).color);
    }
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
    const dx = toX - this.tileX;
    const dy = toY - this.tileY;
    if (dx === 0 && dy === 0) {
      this.scheduleNextMove();
      return;
    }

    this.isMoving = true;
    this.idleTween?.destroy();

    // Walk step by step along Manhattan path
    const path: { x: number; y: number }[] = [];
    let cx = this.tileX;
    let cy = this.tileY;
    while (cx !== toX) { cx += cx < toX ? 1 : -1; path.push({ x: cx, y: cy }); }
    while (cy !== toY) { cy += cy < toY ? 1 : -1; path.push({ x: cx, y: cy }); }

    const walkNext = () => {
      const step = path.shift();
      if (!step) {
        this.isMoving = false;
        this.startIdleAnimation();
        this.scheduleNextMove();
        return;
      }

      const wx = step.x * TILE_SIZE + TILE_SIZE / 2;
      const wy = step.y * TILE_SIZE + TILE_SIZE / 2;
      const duration = 380 + Math.random() * 80;

      this.scene.tweens.add({
        targets: this.sprite,
        x: wx,
        y: wy,
        duration,
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

  private startIdleAnimation() {
    this.idleTween = this.scene.tweens.add({
      targets: this.head,
      y: [-9, -12, -9],
      duration: 1200 + Math.random() * 600,
      repeat: -1,
      ease: 'Sine.easeInOut',
    });
  }

  destroy() {
    this.idleTween?.destroy();
    this.waitTimer?.destroy();
    this.sprite.destroy();
  }
}
