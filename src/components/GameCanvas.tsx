'use client';

import { useEffect, useRef } from 'react';
import Phaser from 'phaser';
import { WorldScene } from '@/src/game/scenes/WorldScene';
import { createGameConfig } from '@/src/game/config';

export default function GameCanvas() {
  const containerRef = useRef<HTMLDivElement>(null);
  const gameRef      = useRef<Phaser.Game | null>(null);

  useEffect(() => {
    if (!containerRef.current || gameRef.current) return;
    const container = containerRef.current;

    const ro = new ResizeObserver(entries => {
      const { width, height } = entries[0].contentRect;
      if (width <= 0 || height <= 0) return;

      if (!gameRef.current) {
        // Initialize only when we know the real dimensions
        const config = createGameConfig(container, width, height);
        config.scene = [WorldScene];
        gameRef.current = new Phaser.Game(config);
      } else {
        gameRef.current.scale.resize(width, height);
      }
    });

    ro.observe(container);

    return () => {
      ro.disconnect();
      gameRef.current?.destroy(true);
      gameRef.current = null;
    };
  }, []);

  return (
    <div
      ref={containerRef}
      style={{ position: 'absolute', inset: 0, background: '#1e3010' }}
    />
  );
}
