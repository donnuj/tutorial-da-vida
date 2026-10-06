import Phaser from 'phaser';
import { TILE_SIZE, type NpcDef } from '../world/NeighborhoodMap';

// player.png: 512x64, 32x64 per frame, civilian side-view
// Different frame offsets per NPC to give visual variety within the same sheet
const NPC_SCALE = 0.7;

// Tints that work well on the beige/brown civilian sprite
const NPC_TINTS = [
  0xffc8a0, // skin warm
  0xa0d0ff, // blue shirt
  0xffd080, // yellow shirt
  0xc0ffa0, // green shirt
  0xffb0b0, // red/pink
];

// Walk cycle: frames 0-7 (left-facing). Flip for right.
const WALK_FRAMES = { start: 0, end: 7 };
const IDLE_FRAME  = 0;

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

  constructor(scene: Phaser.Scene, def: NpcDef, npcIndex = 0) {
    this.scene    = scene;
    this.id       = def.id;
    this.name     = def.name;
    this.role     = def.role;
    this.schedule = def.schedule;
    this.tileX    = def.startTileX;
    this.tileY    = def.startTileY;

    const wx = this.tileX * TILE_SIZE + TILE_SIZE / 2;
    const wy = this.tileY * TILE_SIZE + TILE_SIZE / 2;

    this.body = scene.add.sprite(0, -16, 'player', IDLE_FRAME);
    this.body.setScale(NPC_SCALE);
    this.body.setTint(NPC_TINTS[npcIndex % NPC_TINTS.length]);

    this.nameLabel = scene.add.text(0, -48, def.name, {
      fontSize: '8px', fontFamily: 'monospace',
      color: '#e8d5b0', stroke: '#000000', strokeThickness: 3, align: 'center',
    }).setOrigin(0.5, 1);

    this.sprite = scene.add.container(wx, wy, [this.body, this.nameLabel]);
    this.sprite.setDepth(40);

    this.ensureAnimations(scene);
    this.body.play('player_idle', true);
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

  private ensureAnimations(scene: Phaser.Scene) {
    if (scene.anims.exists('player_walk')) return;

    scene.anims.create({
      key: 'player_walk',
      frames: scene.anims.generateFrameNumbers('player', WALK_FRAMES),
      frameRate: 8,
      repeat: -1,
    });
    scene.anims.create({
      key: 'player_idle',
      frames: [{ key: 'player', frame: IDLE_FRAME }],
      frameRate: 1,
    });
  }

  private playWalk(toX: number, toY: number, prevX: number, prevY: number) {
    const dx = toX - prevX;
    this.body.setFlipX(dx > 0);
    this.body.play('player_walk', true);
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
        this.body.setFlipX(false);
        this.body.play('player_idle', true);
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
