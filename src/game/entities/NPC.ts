import Phaser from 'phaser';
import { TILE_SIZE, type NpcDef } from '../world/NeighborhoodMap';

// Uses the same hero.png as the player, differentiated by tint
const NPC_SCALE = 0.65;

const NPC_TINTS = [
  0xffffff, // neutral — same as player
  0xff9999, // reddish
  0x99ff99, // greenish
  0x9999ff, // bluish
  0xffcc77, // orange
];

const ANIM = {
  walk_down:  { start: 0,  end: 4  },
  walk_left:  { start: 5,  end: 9  },
  walk_up:    { start: 10, end: 14 },
  walk_right: { start: 15, end: 19 },
};

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

    this.body = scene.add.sprite(0, -20, 'player', 2);
    this.body.setScale(NPC_SCALE);
    this.body.setTint(NPC_TINTS[npcIndex % NPC_TINTS.length]);

    this.nameLabel = scene.add.text(0, -52, def.name, {
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
    if (scene.anims.exists('player_walk_down')) return;

    for (const [key, frames] of Object.entries(ANIM)) {
      scene.anims.create({
        key: `player_${key}`,
        frames: scene.anims.generateFrameNumbers('player', frames),
        frameRate: 8,
        repeat: -1,
      });
    }
    scene.anims.create({
      key: 'player_idle',
      frames: [{ key: 'player', frame: 2 }],
      frameRate: 1,
    });
  }

  private playWalk(toX: number, toY: number, prevX: number, prevY: number) {
    const dx = toX - prevX;
    const dy = toY - prevY;
    if      (dx < 0) this.body.play('player_walk_left',  true);
    else if (dx > 0) this.body.play('player_walk_right', true);
    else if (dy < 0) this.body.play('player_walk_up',    true);
    else             this.body.play('player_walk_down',  true);
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
