'use client';

import dynamic from 'next/dynamic';
import { GameHUD } from '@/src/components/GameHUD';

const GameCanvas = dynamic(() => import('@/src/components/GameCanvas'), {
  ssr: false,
  loading: () => (
    <div style={{
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      height: '100vh', background: '#1a1a2e', color: '#FFD700',
      fontFamily: 'monospace', fontSize: 16, flexDirection: 'column', gap: 16,
    }}>
      <div style={{ fontSize: 32 }}>🌍</div>
      <div>Carregando o mundo...</div>
    </div>
  ),
});

export default function GamePage() {
  return (
    <div style={{ position: 'relative', width: '100vw', height: '100vh', overflow: 'hidden' }}>
      <GameCanvas />
      <GameHUD />
    </div>
  );
}
