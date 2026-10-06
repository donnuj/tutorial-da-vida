import Phaser from 'phaser';
import { TILE_SIZE } from '../world/NeighborhoodMap';
import type { CollisionMap } from '../systems/CollisionMap';

export type PlayerAnimation = 'idle' | 'walk_down' | 'walk_up' | 'walk_left' | 'walk_right' | 'work' | 'study' | 'sleep';

interface PlayerConfig {
  scene: Phaser.Scene;
  tileX: number;
  tileY: number;
  name: string;
}

// player.png: 512x64, 32x64 per frame, 16 frames — civilian side-view walk cycle
// Frames 0-7: walking cycle (left-facing). Flip X for right-facing.
const WALK_FRAMES  = { start: 0, end: 7 };
const IDLE_FRAME   = 0;
const PLAYER_SCALE = 0.7;

export class Player {
  readonly sprite: Phaser.GameObjects.Container;

  private body: Phaser.GameObjects.Sprite;
  private nameLabel: Phaser.GameObjects.Text;
  private activityIcon: Phaser.GameObjects.Text;

  private scene: Phaser.Scene;
  private tileX: number;
  private tileY: number;
  private targetTileX: number;
  private targetTileY: number;
  private isMoving = false;
  private moveQueue: { x: number; y: number }[] = [];
  private currentAnim: PlayerAnimation = 'idle';

  readonly speed = 2.5;

  constructor({ scene, tileX, tileY, name }: PlayerConfig) {
    this.scene = scene;
    this.tileX = tileX;
    this.tileY = tileY;
    this.targetTileX = tileX;
    this.targetTileY = tileY;

    const wx = tileX * TILE_SIZE + TILE_SIZE / 2;
    const wy = tileY * TILE_SIZE + TILE_SIZE / 2;

    this.body = scene.add.sprite(0, -16, 'player', IDLE_FRAME);
    this.body.setScale(PLAYER_SCALE);

    this.nameLabel = scene.add.text(0, -48, name, {
      fontSize: '8px', fontFamily: 'monospace',
      color: '#FFD700', stroke: '#000000', strokeThickness: 3, align: 'center',
    }).setOrigin(0.5, 1);

    this.activityIcon = scene.add.text(18, -24, '', { fontSize: '12px' }).setOrigin(0.5);

    this.sprite = scene.add.container(wx, wy, [this.body, this.nameLabel, this.activityIcon]);
    this.sprite.setDepth(50);

    this.registerAnimations();
    this.playAnimation('idle');
  }

  private registerAnimations() {
    if (this.scene.anims.exists('player_walk')) return;

    this.scene.anims.create({
      key: 'player_walk',
      frames: this.scene.anims.generateFrameNumbers('player', WALK_FRAMES),
      frameRate: 8,
      repeat: -1,
    });
    this.scene.anims.create({
      key: 'player_idle',
      frames: [{ key: 'player', frame: IDLE_FRAME }],
      frameRate: 1,
    });
  }

  get worldX() { return this.tileX * TILE_SIZE + TILE_SIZE / 2; }
  get worldY() { return this.tileY * TILE_SIZE + TILE_SIZE / 2; }
  get currentTileX() { return this.tileX; }
  get currentTileY() { return this.tileY; }

  teleportTo(tileX: number, tileY: number) {
    this.tileX = tileX;
    this.tileY = tileY;
    this.targetTileX = tileX;
    this.targetTileY = tileY;
    this.moveQueue = [];
    this.isMoving = false;
    this.sprite.setPosition(
      tileX * TILE_SIZE + TILE_SIZE / 2,
      tileY * TILE_SIZE + TILE_SIZE / 2,
    );
    this.playAnimation('idle');
  }

  moveTo(targetX: number, targetY: number) {
    this.moveQueue = this.buildPath(this.tileX, this.tileY, targetX, targetY);
    if (this.moveQueue.length > 0 && !this.isMoving) this.stepToNext();
  }

  setAnimation(anim: PlayerAnimation) {
    if (this.currentAnim === anim) return;
    this.playAnimation(anim);
  }

  setActivityIcon(icon: string) { this.activityIcon.setText(icon); }

  update(
    _delta: number,
    cursors: Phaser.Types.Input.Keyboard.CursorKeys | null,
    wasd: Record<string, Phaser.Input.Keyboard.Key> | null,
    collision?: CollisionMap,
  ) {
    if (this.isMoving) return;
    if (!cursors && !wasd) return;

    let dx = 0, dy = 0;
    if      (cursors?.left?.isDown  || wasd?.a?.isDown) dx = -1;
    else if (cursors?.right?.isDown || wasd?.d?.isDown) dx =  1;
    else if (cursors?.up?.isDown    || wasd?.w?.isDown) dy = -1;
    else if (cursors?.down?.isDown  || wasd?.s?.isDown) dy =  1;

    if (dx === 0 && dy === 0) {
      if (this.currentAnim.startsWith('walk_')) this.playAnimation('idle');
      return;
    }

    const newX = this.tileX + dx;
    const newY = this.tileY + dy;
    if (collision?.isBlocked(newX, newY)) return;
    if (newX >= 0 && newX < 200 && newY >= 0 && newY < 200) {
      if      (dx < 0) this.playAnimation('walk_left');
      else if (dx > 0) this.playAnimation('walk_right');
      else if (dy < 0) this.playAnimation('walk_up');
      else             this.playAnimation('walk_down');
      this.stepTo(newX, newY);
    }
  }

  private stepTo(tx: number, ty: number) {
    this.isMoving = true;
    this.targetTileX = tx;
    this.targetTileY = ty;
    const wx = tx * TILE_SIZE + TILE_SIZE / 2;
    const wy = ty * TILE_SIZE + TILE_SIZE / 2;
    this.scene.tweens.add({
      targets: this.sprite, x: wx, y: wy,
      duration: 1000 / this.speed / 10,
      ease: 'Linear',
      onComplete: () => {
        this.tileX = tx;
        this.tileY = ty;
        this.isMoving = false;
        if (this.moveQueue.length > 0) this.stepToNext();
        else if (this.currentAnim.startsWith('walk_')) this.playAnimation('idle');
      },
    });
  }

  private stepToNext() {
    const next = this.moveQueue.shift();
    if (next) {
      const dx = next.x - this.tileX;
      const dy = next.y - this.tileY;
      if      (dx < 0) this.playAnimation('walk_left');
      else if (dx > 0) this.playAnimation('walk_right');
      else if (dy < 0) this.playAnimation('walk_up');
      else             this.playAnimation('walk_down');
      this.stepTo(next.x, next.y);
    }
  }

  private buildPath(fromX: number, fromY: number, toX: number, toY: number) {
    const path: { x: number; y: number }[] = [];
    let cx = fromX, cy = fromY;
    while (cx !== toX) { cx += cx < toX ? 1 : -1; path.push({ x: cx, y: cy }); }
    while (cy !== toY) { cy += cy < toY ? 1 : -1; path.push({ x: cx, y: cy }); }
    return path;
  }

  private playAnimation(anim: PlayerAnimation) {
    this.currentAnim = anim;
    this.activityIcon.setText('');

    switch (anim) {
      case 'walk_left':
        this.body.setFlipX(false);
        this.body.play('player_walk', true);
        break;
      case 'walk_right':
        this.body.setFlipX(true);
        this.body.play('player_walk', true);
        break;
      case 'walk_up':
      case 'walk_down':
        // Side-view sprite has no front/back — use walk animation to keep movement feel
        this.body.play('player_walk', true);
        break;
      case 'work':
        this.body.setFlipX(false);
        this.body.play('player_idle', true);
        this.activityIcon.setText('⚒');
        break;
      case 'study':
        this.body.setFlipX(false);
        this.body.play('player_idle', true);
        this.activityIcon.setText('📖');
        break;
      case 'sleep':
        this.body.setFlipX(false);
        this.body.play('player_idle', true);
        this.activityIcon.setText('💤');
        break;
      default:
        this.body.setFlipX(false);
        this.body.play('player_idle', true);
        break;
    }
  }

  destroy() {
    this.sprite.destroy();
  }
}
