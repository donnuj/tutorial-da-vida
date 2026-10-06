import Phaser from 'phaser';
import { TILE_SIZE, type NpcDef } from '../world/NeighborhoodMap';

export class NPC {
  readonly id: string;
  readonly name: string;
  readonly role: string;
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

  private scene: Phaser.Scene;
  private schedule: NpcDef['schedule'];
  private scheduleIndex = 0;
  private tileX: number;
  private tileY: number;
  private isMoving = false;
  private waitTimer: Phaser.Time.TimerEvent | null = null;
  private activeTweens: Phaser.Tweens.Tween[] = [];

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

    const skinColor  = def.headColor;
    const shirtColor = def.color;
    const hairColor  = Phaser.Display.Color.IntegerToColor(def.color).darken(35).color;
    const shoeColor  = 0x1A0A02;
    const pantsColor = Phaser.Display.Color.IntegerToColor(def.color).darken(50).color;

    this.shadow  = scene.add.ellipse(0, 14, 18, 6, 0x000000, 0.12);
    this.shoeL   = scene.add.rectangle(-4, 10, 6, 4, shoeColor);
    this.shoeR   = scene.add.rectangle( 4, 10, 6, 4, shoeColor);
    this.legL    = scene.add.rectangle(-4,  1, 6, 10, pantsColor);
    this.legR    = scene.add.rectangle( 4,  1, 6, 10, pantsColor);
    this.belt    = scene.add.rectangle( 0, -5, 13, 3, 0x2C1A0A);
    this.shirt   = scene.add.rectangle( 0,-11, 13, 9, shirtColor);
    this.armL    = scene.add.rectangle(-9, -9,  4, 9, skinColor);
    this.armR    = scene.add.rectangle( 9, -9,  4, 9, skinColor);
    this.face    = scene.add.ellipse(   0,-19, 13,13, skinColor);
    this.hair    = scene.add.rectangle( 0,-25, 12, 8, hairColor);

    this.nameLabel = scene.add.text(0, -34, def.name, {
      fontSize: '8px', fontFamily: 'monospace',
      color: '#EEEEEE', stroke: '#000000', strokeThickness: 3, align: 'center',
    }).setOrigin(0.5, 1);

    this.sprite = scene.add.container(wx, wy, [
      this.shadow,
      this.shoeL, this.shoeR,
      this.legL, this.legR,
      this.belt, this.shirt,
      this.armL, this.armR,
      this.face, this.hair,
      this.nameLabel,
    ]);
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
      this.shirt.setStrokeStyle(2, 0xFFD700);
    } else {
      this.nameLabel.setColor('#EEEEEE');
      this.shirt.setStrokeStyle(0);
    }
  }

  private clearTweens() {
    for (const t of this.activeTweens) t.destroy();
    this.activeTweens = [];
    this.legL.setPosition(-4,  1);
    this.legR.setPosition( 4,  1);
    this.shoeL.setPosition(-4, 10);
    this.shoeR.setPosition( 4, 10);
    this.shirt.setPosition( 0,-11);
    this.armL.setPosition( -9, -9);
    this.armR.setPosition(  9, -9);
    this.face.setPosition(  0,-19);
    this.hair.setPosition(  0,-25);
  }

  private startIdleAnimation() {
    this.clearTweens();
    this.activeTweens.push(this.scene.tweens.add({
      targets: [this.shirt, this.armL, this.armR, this.face, this.hair, this.belt],
      y: '-=1.5',
      duration: 1200 + Math.random() * 600,
      yoyo: true, repeat: -1,
      ease: 'Sine.easeInOut',
    }));
  }

  private startWalkAnimation(toX: number) {
    this.clearTweens();
    const spd = 200;
    const add = (t: Phaser.Tweens.Tween) => { this.activeTweens.push(t); };

    if (toX < this.tileX) this.sprite.setScaleX(-1);
    else if (toX > this.tileX) this.sprite.setScaleX(1);

    add(this.scene.tweens.add({
      targets: this.legL, y: { from: -2, to: 4 },
      duration: spd, yoyo: true, repeat: -1, ease: 'Sine.easeInOut',
    }));
    add(this.scene.tweens.add({
      targets: this.shoeL, y: { from: 7, to: 13 },
      duration: spd, yoyo: true, repeat: -1, ease: 'Sine.easeInOut',
    }));
    add(this.scene.tweens.add({
      targets: this.legR, y: { from: 4, to: -2 },
      duration: spd, yoyo: true, repeat: -1, ease: 'Sine.easeInOut',
    }));
    add(this.scene.tweens.add({
      targets: this.shoeR, y: { from: 13, to: 7 },
      duration: spd, yoyo: true, repeat: -1, ease: 'Sine.easeInOut',
    }));
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
        this.sprite.setScaleX(1);
        this.startIdleAnimation();
        this.scheduleNextMove();
        return;
      }
      const duration = 360 + Math.random() * 80;
      this.scene.tweens.add({
        targets: this.sprite,
        x: step.x * TILE_SIZE + TILE_SIZE / 2,
        y: step.y * TILE_SIZE + TILE_SIZE / 2,
        duration, ease: 'Linear',
        onComplete: () => { this.tileX = step.x; this.tileY = step.y; walkNext(); },
      });
    };
    walkNext();
  }

  destroy() {
    this.clearTweens();
    this.waitTimer?.destroy();
    this.sprite.destroy();
  }
}
