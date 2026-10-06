'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import dynamic from 'next/dynamic';
import { GameHUD } from '@/src/components/GameHUD';
import { LifeNarrative } from '@/src/components/LifeNarrative';
import { useGameStore } from '@/src/store/gameStore';
import { character as characterApi, simulation, ApiError, type OfflineProgressResult } from '@/src/lib/api';

const GameCanvas = dynamic(() => import('@/src/components/GameCanvas'), {
  ssr: false,
  loading: () => <GameLoading />,
});

export default function GamePage() {
  const router = useRouter();
  const setCharacter = useGameStore((s) => s.setCharacter);
  const setAccessToken = useGameStore((s) => s.setAccessToken);
  const setLoaded = useGameStore((s) => s.setLoaded);
  const isLoaded = useGameStore((s) => s.isLoaded);
  const character = useGameStore((s) => s.character);

  const [offline, setOffline] = useState<OfflineProgressResult | null>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    const token = localStorage.getItem('tdv_access_token');
    if (!token) { router.replace('/login'); return; }
    setAccessToken(token);
    loadGame();
  }, []);

  async function loadGame() {
    try {
      const state = await characterApi.getState();

      if (state.phase === 'adult') {
        const offlineResult = await simulation.offlineProgress();
        if (offlineResult.timeElapsedMinutes > 60) setOffline(offlineResult);
      }

      setCharacter({
        id: state.id,
        name: state.name,
        phase: state.phase,
        gameAge: state.gameAge,
        energy: state.energy,
        happiness: state.happiness,
        stress: state.stress,
        health: state.health,
        money: state.money,
        monthlyIncome: state.monthlyIncome,
        currentActivity: state.currentActivity,
        activityEndsAt: state.activityEndsAt,
        locationId: state.locationId,
        jobTitle: state.jobTitle,
      });
      setLoaded(true);
    } catch (err) {
      if (err instanceof ApiError && err.status === 404) {
        router.replace('/create-character');
        return;
      }
      if (err instanceof ApiError && err.status === 401) {
        router.replace('/login');
        return;
      }
      setError(err instanceof Error ? err.message : 'Erro ao carregar');
    }
  }

  if (error) {
    return (
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        height: '100vh', background: '#1a1a2e', color: '#FF6B6B',
        fontFamily: 'monospace', fontSize: 14, flexDirection: 'column', gap: 12,
      }}>
        <div>Erro ao carregar o jogo:</div>
        <div style={{ color: '#888' }}>{error}</div>
        <button onClick={() => router.replace('/login')} style={{
          marginTop: 8, padding: '8px 20px', background: 'transparent',
          border: '1px solid #555', borderRadius: 6, color: '#aaa',
          fontFamily: 'monospace', fontSize: 12,
        }}>
          Voltar ao login
        </button>
      </div>
    );
  }

  if (!isLoaded) return <GameLoading />;

  if (character && character.phase !== 'adult') {
    return <LifeNarrative />;
  }

  return (
    <div style={{ position: 'relative', width: '100vw', height: '100vh', overflow: 'hidden' }}>
      <GameCanvas />
      <GameHUD />

      {offline && (
        <OfflineReport result={offline} onClose={() => setOffline(null)} />
      )}
    </div>
  );
}

function GameLoading() {
  return (
    <div style={{
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      height: '100vh', background: '#1a1a2e', color: '#FFD700',
      fontFamily: 'monospace', fontSize: 14, flexDirection: 'column', gap: 12,
    }}>
      <div style={{ fontSize: 36, animation: 'pulse 2s ease infinite' }}>🌍</div>
      <div>Carregando o mundo...</div>
      <style>{`@keyframes pulse { 0%,100%{opacity:1} 50%{opacity:0.5} }`}</style>
    </div>
  );
}

function OfflineReport({ result, onClose }: { result: OfflineProgressResult; onClose: () => void }) {
  const hours = Math.floor(result.timeElapsedMinutes / 60);
  const mins = result.timeElapsedMinutes % 60;
  const timeLabel = hours > 0 ? `${hours}h ${mins}min` : `${mins} min`;

  return (
    <div style={{
      position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.8)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      zIndex: 500, fontFamily: 'monospace',
    }}>
      <div style={{
        background: '#0d1a0d',
        border: '1px solid rgba(76,175,80,0.4)',
        borderRadius: 12, padding: '32px 40px',
        maxWidth: 360, width: '100%', color: '#fff',
        boxShadow: '0 0 60px rgba(76,175,80,0.1)',
      }}>
        <div style={{ color: '#4CAF50', fontSize: 16, fontWeight: 'bold', marginBottom: 20, textAlign: 'center' }}>
          Você esteve fora por {timeLabel}
        </div>
        <div style={{ color: '#888', fontSize: 11, marginBottom: 16, textAlign: 'center' }}>
          Enquanto isso, a vida continuou:
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 24 }}>
          {result.moneyEarned > 0 && (
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13 }}>
              <span style={{ color: '#aaa' }}>Renda recebida</span>
              <span style={{ color: '#4CAF50' }}>+R$ {result.moneyEarned.toFixed(2)}</span>
            </div>
          )}
          {result.moneySpent > 0 && (
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13 }}>
              <span style={{ color: '#aaa' }}>Despesas</span>
              <span style={{ color: '#FF6B6B' }}>-R$ {result.moneySpent.toFixed(2)}</span>
            </div>
          )}
          {result.events.map((ev, i) => (
            <div key={i} style={{ color: '#666', fontSize: 11, borderTop: '1px solid rgba(255,255,255,0.05)', paddingTop: 6 }}>
              {ev.description}
            </div>
          ))}
        </div>

        <button onClick={onClose} style={{
          width: '100%', padding: '11px 0',
          background: 'rgba(76,175,80,0.1)',
          border: '1px solid rgba(76,175,80,0.4)',
          borderRadius: 8, color: '#4CAF50',
          fontFamily: 'monospace', fontSize: 13,
        }}>
          Continuar
        </button>
      </div>
    </div>
  );
}
