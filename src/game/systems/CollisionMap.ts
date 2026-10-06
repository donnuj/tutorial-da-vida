export class CollisionMap {
  private grid: Uint8Array;
  readonly width: number;
  readonly height: number;

  constructor(width: number, height: number) {
    this.width  = width;
    this.height = height;
    this.grid   = new Uint8Array(width * height);
  }

  set(x: number, y: number, blocked: boolean) {
    if (x >= 0 && x < this.width && y >= 0 && y < this.height)
      this.grid[y * this.width + x] = blocked ? 1 : 0;
  }

  setRect(x: number, y: number, w: number, h: number, blocked: boolean) {
    for (let ty = y; ty < y + h; ty++)
      for (let tx = x; tx < x + w; tx++)
        this.set(tx, ty, blocked);
  }

  isBlocked(x: number, y: number): boolean {
    if (x < 0 || x >= this.width || y < 0 || y >= this.height) return true;
    return this.grid[y * this.width + x] === 1;
  }
}
