import Phaser from 'phaser';
import { TILE_SIZE } from '../world/NeighborhoodMap';

export type PlayerAnimation = 'idle' | 'walk_down' | 'walk_up' | 'walk_left' | 'walk_right' | 'work' | 'study' | 'sleep';

interface PlayerConfig {
  scene: Phaser.Scene;
  tileX: number;
  tileY: number;
  name: string;
  shirtColor?: number;
  hairColor?: number;
  skinColor?: number;
}

export class Player {
  readonly sprite: Phaser.GameObjects.Container;

  private shadow: Phaser.GameObjects.Ellipse;
  private shoeL: Phaser.GameObjects.Rectangle;
  private shoeR: Phaser.GameObjects.Rectangle;
  private legL: Phaser.GameObjects.Rectangle;
  private legR: Phaser.GameObjects.Rectangle;
  private belt: Phaser.GameObjects.Rectangle;
  private shirt: Phaser.GameObjects.Rectangle;
  private armL: Phaser.GameObjects.Rectangle;
  private armR: Phaser.GameObjects.Rectangle;
  private face: Phaser.GameObjects.Ellipse;
  private hair: Phaser.GameObjects.Rectangle;
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
  private activeTweens: Phaser.Tweens.Tween[] = [];

  private readonly shirtColor: number;

  readonly speed = 2.5;

  constructor({ scene, tileX, tileY, name, shirtColor = 0x2471A3, hairColor = 0x3D1C02, skinColor = 0xC8956C }: PlayerConfig) {
    this.scene = scene;
    this.shirtColor = shirtColor;
    this.tileX = tileX;
    this.tileY = tileY;
    this.targetTileX = tileX;
    this.targetTileY = tileY;

    const wx = tileX * TILE_SIZE + TILE_SIZE / 2;
    const wy = tileY * TILE_SIZE + TILE_SIZE / 2;

    this.shadow  = scene.add.ellipse(0, 14, 20, 7, 0x000000, 0.15);
    this.shoeL   = scene.add.rectangle(-4, 10, 7, 4, 0x1A0A02);
    this.shoeR   = scene.add.rectangle( 4, 10, 7, 4, 0x1A0A02);
    this.legL    = scene.add.rectangle(-4,  1, 6, 10, 0x1E2B44);
    this.legR    = scene.add.rectangle( 4,  1, 6, 10, 0x1E2B44);
    this.belt    = scene.add.rectangle( 0, -5, 14, 3, 0x2C1A0A);
    this.shirt   = scene.add.rectangle( 0,-11, 14, 9, shirtColor);
    this.armL    = scene.add.rectangle(-9, -9,  4, 9, skinColor);
    this.armR    = scene.add.rectangle( 9, -9,  4, 9, skinColor);
    this.face    = scene.add.ellipse(   0,-19, 14,14, skinColor);
    this.hair    = scene.add.rectangle( 0,-25, 13, 8, hairColor);

    this.nameLabel = scene.add.text(0, -34, name, {
      fontSize: '8px', fontFamily: 'monospace',
      color: '#FFFFFF', stroke: '#000000', strokeThickness: 3, align: 'center',
    }).setOrigin(0.5, 1);

    this.activityIcon = scene.add.text(14, -18, '', { fontSize: '12px' }).setOrigin(0.5);

    this.sprite = scene.add.container(wx, wy, [
      this.shadow,
      this.shoeL, this.shoeR,
      this.legL, this.legR,
      this.belt, this.shirt,
      this.armL, this.armR,
      this.face, this.hair,
      this.nameLabel, this.activityIcon,
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
    if (this.moveQueue.length > 0 && !this.isMoving) this.stepToNext();
  }

  setAnimation(anim: PlayerAnimation) {
    if (this.currentAnim === anim) return;
    this.playAnimation(anim);
  }

  setActivityIcon(icon: string) { this.activityIcon.setText(icon); }

  update(_delta: number, cursors: Phaser.Types.Input.Keyboard.CursorKeys | null, wasd: Record<string, Phaser.Input.Keyboard.Key> | null) {
    if (this.isMoving) return;
    if (!cursors && !wasd) return;

    let dx = 0, dy = 0;
    if (cursors?.left?.isDown  || wasd?.a?.isDown) dx = -1;
    else if (cursors?.right?.isDown || wasd?.d?.isDown) dx =  1;
    else if (cursors?.up?.isDown   || wasd?.w?.isDown) dy = -1;
    else if (cursors?.down?.isDown  || wasd?.s?.isDown) dy =  1;

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
      targets: this.sprite, x: wx, y: wy,
      duration: 1000 / this.speed / 10,
      ease: 'Linear',
      onComplete: () => {
        this.tileX = tx; this.tileY = ty;
        this.isMoving = false;
        if (this.moveQueue.length > 0) this.stepToNext();
      },
    });
  }

  private stepToNext() {
    const next = this.moveQueue.shift();
    if (next) this.stepTo(next.x, next.y);
  }

  private buildPath(fromX: number, fromY: number, toX: number, toY: number) {
    const path: { x: number; y: number }[] = [];
    let cx = fromX, cy = fromY;
    while (cx !== toX) { cx += cx < toX ? 1 : -1; path.push({ x: cx, y: cy }); }
    while (cy !== toY) { cy += cy < toY ? 1 : -1; path.push({ x: cx, y: cy }); }
    return path;
  }

  private clearTweens() {
    for (const t of this.activeTweens) t.destroy();
    this.activeTweens = [];
    // Reset all part positions
    this.legL.setPosition(-4,  1);
    this.legR.setPosition( 4,  1);
    this.shoeL.setPosition(-4, 10);
    this.shoeR.setPosition( 4, 10);
    this.shirt.setPosition( 0,-11);
    this.armL.setPosition( -9, -9);
    this.armR.setPosition(  9, -9);
    this.face.setPosition(  0,-19);
    this.hair.setPosition(  0,-25);
    this.belt.setPosition(  0, -5);
    this.sprite.setScaleX(1);
    this.sprite.setAlpha(1);
    this.nameLabel.setScaleX(1);
  }

  private playAnimation(anim: PlayerAnimation) {
    this.clearTweens();
    this.activityIcon.setText('');
    this.shirt.setFillStyle(this.shirtColor);

    const add = (t: Phaser.Tweens.Tween) => { this.activeTweens.push(t); return t; };

    switch (anim) {
      case 'idle':
        add(this.scene.tweens.add({
          targets: [this.shirt, this.armL, this.armR, this.face, this.hair, this.belt],
          y: '-=1.5',
          duration: 1000, yoyo: true, repeat: -1,
          ease: 'Sine.easeInOut',
        }));
        break;

      case 'walk_left':
        this.sprite.setScaleX(-1);
        this.nameLabel.setScaleX(-1);
        this._walkLegs();
        break;

      case 'walk_right':
      case 'walk_down':
      case 'walk_up':
        this.sprite.setScaleX(1);
        this._walkLegs();
        break;

      case 'work':
        this.shirt.setFillStyle(0xE67E22);
        this.activityIcon.setText('⚒');
        add(this.scene.tweens.add({
          targets: this.armR,
          y: { from: -9, to: -3 },
          duration: 350, yoyo: true, repeat: -1,
          ease: 'Sine.easeInOut',
        }));
        break;

      case 'study':
        this.shirt.setFillStyle(0x27AE60);
        this.activityIcon.setText('📖');
        add(this.scene.tweens.add({
          targets: this.face,
          y: { from: -19, to: -17 },
          duration: 700, yoyo: true, repeat: -1,
          ease: 'Sine.easeInOut',
        }));
        break;

      case 'sleep':
        this.shirt.setFillStyle(0x8E44AD);
        this.activityIcon.setText('💤');
        add(this.scene.tweens.add({
          targets: this.sprite,
          alpha: [1, 0.65, 1],
          duration: 1500, repeat: -1,
          ease: 'Sine.easeInOut',
        }));
        break;
    }

    this.currentAnim = anim;
  }

  private _walkLegs() {
    const spd = 210;
    const add = (t: Phaser.Tweens.Tween) => { this.activeTweens.push(t); };

    add(this.scene.tweens.add({
      targets: this.legL,
      y: { from: -2, to: 4 },
      duration: spd, yoyo: true, repeat: -1, ease: 'Sine.easeInOut',
    }));
    add(this.scene.tweens.add({
      targets: this.shoeL,
      y: { from: 7, to: 13 },
      duration: spd, yoyo: true, repeat: -1, ease: 'Sine.easeInOut',
    }));
    add(this.scene.tweens.add({
      targets: this.legR,
      y: { from: 4, to: -2 },
      duration: spd, yoyo: true, repeat: -1, ease: 'Sine.easeInOut',
    }));
    add(this.scene.tweens.add({
      targets: this.shoeR,
      y: { from: 13, to: 7 },
      duration: spd, yoyo: true, repeat: -1, ease: 'Sine.easeInOut',
    }));
    // Subtle body bob
    add(this.scene.tweens.add({
      targets: [this.shirt, this.armL, this.armR, this.face, this.hair, this.belt],
      y: '-=1',
      duration: spd * 2, yoyo: true, repeat: -1, ease: 'Sine.easeInOut',
    }));
  }

  destroy() {
    this.clearTweens();
    this.sprite.destroy();
  }
}
