import Phaser from 'phaser';
import { TILE_SIZE, type NpcDef } from '../world/NeighborhoodMap';

// Tiny-town tileset character frames (row 10-11 of the 12x11 grid)
const NPC_FRAMES = [127, 128, 129, 130, 131];

export class NPC {
  readonly id: string;
  readonly name: string;
  readonly role: string;
  readonly sprite: Phaser.GameObjects.Container;

  private body: Phaser.GameObjects.Image;
  private shadow: Phaser.GameObjects.Ellipse;
  private nameLabel: Phaser.GameObjects.Text;

  private scene: Phaser.Scene;
  private schedule: NpcDef['schedule'];
  private scheduleIndex = 0;
  private tileX: number;
  private tileY: number;
  private isMoving = false;
  private waitTimer: Phaser.Time.TimerEvent | null = null;
  private bodyBobTween: Phaser.Tweens.Tween | null = null;
  private npcIndex: number;

  constructor(scene: Phaser.Scene, def: NpcDef, npcIndex = 0) {
    this.scene = scene;
    this.id = def.id;
    this.name = def.name;
    this.role = def.role;
    this.schedule = def.schedule;
    this.tileX = def.startTileX;
    this.tileY = def.startTileY;
    this.npcIndex = npcIndex;

    const wx = this.tileX * TILE_SIZE + TILE_SIZE / 2;
    const wy = this.tileY * TILE_SIZE + TILE_SIZE / 2;

    const frame = NPC_FRAMES[npcIndex % NPC_FRAMES.length];

    this.shadow = scene.add.ellipse(0, 12, 20, 7, 0x000000, 0.15);

    this.body = scene.add.image(0, -8, 'terrain', frame);
    this.body.setScale(2);

    this.nameLabel = scene.add.text(0, -28, def.name, {
      fontSize: '8px', fontFamily: 'monospace',
      color: '#EEEEEE', stroke: '#000000', strokeThickness: 3, align: 'center',
    }).setOrigin(0.5, 1);

    this.sprite = scene.add.container(wx, wy, [this.shadow, this.body, this.nameLabel]);
    this.sprite.setDepth(40);

    this.startIdleAnimation();
    this.scheduleNextMove();
  }

  get currentTileX() { return this.tileX; }
  get currentTileY() { return this.tileY; }

  distanceTo(tx: number, ty: number): number {
    return Math.abs(this.tileX - tx) + Math.abs(this.tileY - ty);
  }

  setHighlight(on: boolean) {
    if (on) {
      this.nameLabel.setColor('#FFD700');
      this.body.setTint(0xFFEE88);
    } else {
      this.nameLabel.setColor('#EEEEEE');
      this.body.clearTint();
    }
  }

  private startIdleAnimation() {
    this.bodyBobTween?.destroy();
    this.bodyBobTween = this.scene.tweens.add({
      targets: this.body,
      y: { from: -8, to: -10 },
      duration: 1100 + Math.random() * 500,
      yoyo: true,
      repeat: -1,
      ease: 'Sine.easeInOut',
    });
  }

  private startWalkAnimation(toX: number) {
    this.bodyBobTween?.destroy();

    if (toX < this.tileX) this.body.setFlipX(true);
    else if (toX > this.tileX) this.body.setFlipX(false);

    this.bodyBobTween = this.scene.tweens.add({
      targets: this.body,
      y: { from: -6, to: -10 },
      duration: 180,
      yoyo: true,
      repeat: -1,
      ease: 'Sine.easeInOut',
    });
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
    this.startWalkAnimation(toX);

    const path: { x: number; y: number }[] = [];
    let cx = this.tileX, cy = this.tileY;
    while (cx !== toX) { cx += cx < toX ? 1 : -1; path.push({ x: cx, y: cy }); }
    while (cy !== toY) { cy += cy < toY ? 1 : -1; path.push({ x: cx, y: cy }); }

    const walkNext = () => {
      const step = path.shift();
      if (!step) {
        this.isMoving = false;
        this.body.setFlipX(false);
        this.startIdleAnimation();
        this.scheduleNextMove();
        return;
      }
      const duration = 340 + Math.random() * 80;
      this.scene.tweens.add({
        targets: this.sprite,
        x: step.x * TILE_SIZE + TILE_SIZE / 2,
        y: step.y * TILE_SIZE + TILE_SIZE / 2,
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

  destroy() {
    this.bodyBobTween?.destroy();
    this.waitTimer?.destroy();
    this.sprite.destroy();
  }
}
