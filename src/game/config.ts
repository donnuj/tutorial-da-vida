import Phaser from 'phaser';

export function createGameConfig(parent: HTMLElement): Phaser.Types.Core.GameConfig {
  return {
    type: Phaser.AUTO,
    parent,
    width: parent.clientWidth || window.innerWidth,
    height: parent.clientHeight || window.innerHeight,
    backgroundColor: '#1a1a2e',
    pixelArt: true,
    roundPixels: true,
    antialias: false,
    physics: {
      default: 'arcade',
      arcade: { gravity: { x: 0, y: 0 }, debug: false },
    },
    scale: {
      mode: 1, // Phaser.Scale.RESIZE
      autoCenter: 1, // Phaser.Scale.CENTER_BOTH
    },
    render: {
      powerPreference: 'high-performance',
    },
  };
}
