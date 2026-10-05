import Phaser from 'phaser';
import { TILE_SIZE } from '../world/NeighborhoodMap';

export type PlayerAnimation = 'idle' | 'walk_down' | 'walk_up' | 'walk_left' | 'walk_right' | 'work' | 'study' | 'sleep';

interface PlayerConfig {
  scene: Phaser.Scene;
  tileX: number;
  tileY: number;
  name: string;
}

export class Player {
  readonly sprite: Phaser.GameObjects.Container;
  private body: Phaser.GameObjects.Rectangle;
  private head: Phaser.GameObjects.Ellipse;
  private nameLabel: Phaser.GameObjects.Text;
  private activityIcon: Phaser.GameObjects.Text;
  private shadow: Phaser.GameObjects.Ellipse;
  private scene: Phaser.Scene;

  private tileX: number;
  private tileY: number;
  private targetTileX: number;
  private targetTileY: number;
  private isMoving = false;
  private moveQueue: { x: number; y: number }[] = [];

  private currentAnim: PlayerAnimation = 'idle';
  private idleTween: Phaser.Tweens.Tween | null = null;
  private workTween: Phaser.Tweens.Tween | null = null;
  private stepAccum = 0;

  readonly speed = 2.5; // tiles per second

  constructor({ scene, tileX, tileY, name }: PlayerConfig) {
    this.scene = scene;
    this.tileX = tileX;
    this.tileY = tileY;
    this.targetTileX = tileX;
    this.targetTileY = tileY;

    const wx = tileX * TILE_SIZE + TILE_SIZE / 2;
    const wy = tileY * TILE_SIZE + TILE_SIZE / 2;

    // Shadow
    this.shadow = scene.add.ellipse(0, 10, 20, 8, 0x000000, 0.2);

    // Body (torso + legs as rectangle)
    this.body = scene.add.rectangle(0, 4, 16, 20, 0x3498DB);
    this.body.setStrokeStyle(1, 0x2471A3);

    // Head
    this.head = scene.add.ellipse(0, -10, 16, 16, 0xF4C2A1);
    this.head.setStrokeStyle(1, 0xD4A574);

    // Name label
    this.nameLabel = scene.add.text(0, -24, name, {
      fontSize: '9px',
      fontFamily: 'monospace',
      color: '#FFFFFF',
      stroke: '#000000',
      strokeThickness: 2,
      align: 'center',
    }).setOrigin(0.5, 1);

    // Activity icon (shows current action)
    this.activityIcon = scene.add.text(12, -18, '', {
      fontSize: '12px',
    }).setOrigin(0.5);

    this.sprite = scene.add.container(wx, wy, [
      this.shadow, this.body, this.head, this.nameLabel, this.activityIcon,
    ]);
    this.sprite.setDepth(50);

    this.playAnimation('idle');
  }

  get worldX() { return this.tileX * TILE_SIZE + TILE_SIZE / 2; }
  get worldY() { return this.tileY * TILE_SIZE + TILE_SIZE / 2; }
  get currentTileX() { return this.tileX; }
  get currentTileY() { return this.tileY; }

  moveTo(targetX: number, targetY: number) {
    this.moveQueue = this.buildPath(this.tileX, this.tileY, targetX, targetY);
    if (this.moveQueue.length > 0 && !this.isMoving) {
      this.stepToNext();
    }
  }

  setAnimation(anim: PlayerAnimation) {
    if (this.currentAnim === anim) return;
    this.currentAnim = anim;
    this.playAnimation(anim);
  }

  setActivityIcon(icon: string) {
    this.activityIcon.setText(icon);
  }

  update(delta: number, cursors: Phaser.Types.Input.Keyboard.CursorKeys | null, wasd: Record<string, Phaser.Input.Keyboard.Key> | null) {
    if (this.isMoving) {
      this.updateMovement(delta);
      return;
    }

    if (!cursors && !wasd) return;

    let dx = 0;
    let dy = 0;

    if (cursors?.left?.isDown || wasd?.a?.isDown) dx = -1;
    else if (cursors?.right?.isDown || wasd?.d?.isDown) dx = 1;
    else if (cursors?.up?.isDown || wasd?.w?.isDown) dy = -1;
    else if (cursors?.down?.isDown || wasd?.s?.isDown) dy = 1;

    if (dx === 0 && dy === 0) {
      if (this.currentAnim.startsWith('walk_')) this.playAnimation('idle');
      return;
    }

    const newX = this.tileX + dx;
    const newY = this.tileY + dy;

    if (newX >= 0 && newX < 60 && newY >= 0 && newY < 50) {
      this.stepTo(newX, newY);

      if (dx < 0) this.playAnimation('walk_left');
      else if (dx > 0) this.playAnimation('walk_right');
      else if (dy < 0) this.playAnimation('walk_up');
      else this.playAnimation('walk_down');
    }
  }

  private stepTo(tx: number, ty: number) {
    this.isMoving = true;
    this.targetTileX = tx;
    this.targetTileY = ty;

    const wx = tx * TILE_SIZE + TILE_SIZE / 2;
    const wy = ty * TILE_SIZE + TILE_SIZE / 2;

    this.scene.tweens.add({
      targets: this.sprite,
      x: wx,
      y: wy,
      duration: 1000 / this.speed / 10,
      ease: 'Linear',
      onComplete: () => {
        this.tileX = tx;
        this.tileY = ty;
        this.isMoving = false;

        if (this.moveQueue.length > 0) {
          this.stepToNext();
        }
      },
    });
  }

  private stepToNext() {
    const next = this.moveQueue.shift();
    if (!next) return;
    this.stepTo(next.x, next.y);
  }

  private updateMovement(_delta: number) {
    // Handled by tweens
  }

  private buildPath(fromX: number, fromY: number, toX: number, toY: number): { x: number; y: number }[] {
    // Simple Manhattan path — straight line via waypoint
    // Good enough for open world navigation
    const path: { x: number; y: number }[] = [];
    let cx = fromX;
    let cy = fromY;

    // First go horizontal
    while (cx !== toX) {
      cx += cx < toX ? 1 : -1;
      path.push({ x: cx, y: cy });
    }
    // Then vertical
    while (cy !== toY) {
      cy += cy < toY ? 1 : -1;
      path.push({ x: cx, y: cy });
    }

    return path;
  }

  private playAnimation(anim: PlayerAnimation) {
    this.idleTween?.destroy();
    this.workTween?.destroy();
    this.idleTween = null;
    this.workTween = null;

    this.body.setFillStyle(0x3498DB);
    this.activityIcon.setText('');

    switch (anim) {
      case 'idle':
        this.idleTween = this.scene.tweens.add({
          targets: this.head,
          y: -10,
          duration: 800,
          yoyo: true,
          repeat: -1,
          ease: 'Sine.easeInOut',
        });
        break;

      case 'walk_down':
      case 'walk_up':
      case 'walk_left':
      case 'walk_right':
        this.idleTween = this.scene.tweens.add({
          targets: [this.body],
          scaleX: [1, 0.9, 1],
          duration: 200,
          repeat: -1,
          ease: 'Sine.easeInOut',
        });
        // Flip body direction
        if (anim === 'walk_left') this.body.setFillStyle(0x2E86C1);
        if (anim === 'walk_right') this.body.setFillStyle(0x2E86C1);
        break;

      case 'work':
        this.body.setFillStyle(0xE67E22);
        this.activityIcon.setText('⚒');
        this.workTween = this.scene.tweens.add({
          targets: this.body,
          angle: [-5, 5],
          duration: 300,
          yoyo: true,
          repeat: -1,
          ease: 'Sine.easeInOut',
        });
        break;

      case 'study':
        this.body.setFillStyle(0x27AE60);
        this.activityIcon.setText('📖');
        this.workTween = this.scene.tweens.add({
          targets: this.head,
          angle: [-10, 0],
          duration: 600,
          yoyo: true,
          repeat: -1,
          ease: 'Sine.easeInOut',
        });
        break;

      case 'sleep':
        this.body.setFillStyle(0x8E44AD);
        this.activityIcon.setText('💤');
        this.workTween = this.scene.tweens.add({
          targets: this.sprite,
          alpha: [1, 0.7, 1],
          duration: 1500,
          repeat: -1,
          ease: 'Sine.easeInOut',
        });
        break;
    }

    this.currentAnim = anim;
  }

  destroy() {
    this.idleTween?.destroy();
    this.workTween?.destroy();
    this.sprite.destroy();
  }
}
