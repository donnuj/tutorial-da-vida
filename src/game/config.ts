import Phaser from 'phaser';

export function createGameConfig(parent: HTMLElement, width?: number, height?: number): Phaser.Types.Core.GameConfig {
  const w = width  ?? (parent.clientWidth  || window.innerWidth);
  const h = height ?? (parent.clientHeight || window.innerHeight);

  return {
    type: Phaser.AUTO,
    parent,
    width: w,
    height: h,
    backgroundColor: '#1e3010',
    pixelArt: true,
    roundPixels: true,
    antialias: false,
    physics: {
      default: 'arcade',
      arcade: { gravity: { x: 0, y: 0 }, debug: false },
    },
    scale: {
      mode: Phaser.Scale.NONE, // ResizeObserver handles all resizing
    },
    render: {
      powerPreference: 'high-performance',
    },
  };
}
