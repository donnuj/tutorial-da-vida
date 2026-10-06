'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import dynamic from 'next/dynamic';
import { LifeNarrative } from '@/src/components/LifeNarrative';
import { useGameStore } from '@/src/store/gameStore';
import { character as characterApi, simulation, ApiError, type OfflineProgressResult } from '@/src/lib/api';
import { BUILDINGS } from '@/src/game/world/NeighborhoodMap';

const GameCanvas = dynamic(() => import('@/src/components/GameCanvas'), {
  ssr: false,
  loading: () => <div style={{ position: 'absolute', inset: 0, background: '#1a2a0a' }} />,
});

const ACTION_ICONS: Record<string, string>  = { work:'⚒', study:'📖', sleep:'💤', shop:'🛒', visit:'👋', idle:'💬' };
const ACTION_LABELS: Record<string, string> = { work:'Trabalhar', study:'Estudar', sleep:'Dormir', shop:'Comprar', visit:'Visitar', idle:'Descansar' };

// ─── Minimal floating stat bar ────────────────────────────────────────────────

function MiniBar({ value, color }: { value: number; color: string }) {
  return (
    <div style={{
      width: 48, height: 5,
      background: 'rgba(255,255,255,0.08)',
      borderRadius: 3, overflow: 'hidden',
    }}>
      <div style={{
        height: '100%',
        width: `${Math.max(0, Math.min(100, value))}%`,
        background: color,
        borderRadius: 3,
        transition: 'width 0.6s ease',
      }} />
    </div>
  );
}

function FloatingHUD() {
  const character        = useGameStore(s => s.character);
  const getTimeStr       = useGameStore(s => s.getTimeString);
  const getAgeStr        = useGameStore(s => s.getAgeString);
  const nearbyBuildingId = useGameStore(s => s.nearbyBuildingId);
  const triggerAction    = useGameStore(s => s.triggerAction);

  if (!character) return null;

  const nearby = nearbyBuildingId ? BUILDINGS.find(b => b.id === nearbyBuildingId) : null;
  const actIcon = character.currentActivity ? ACTION_ICONS[character.currentActivity] ?? '' : null;

  return (
    <div style={{ position: 'absolute', inset: 0, pointerEvents: 'none', zIndex: 50 }}>

      {/* ── Top-right: clock ── */}
      <div style={{
        position: 'absolute', top: 12, right: 14,
        background: 'rgba(5,10,20,0.82)',
        border: '1px solid rgba(61,90,138,0.5)',
        borderRadius: 5,
        padding: '5px 11px',
        textAlign: 'center',
      }}>
        <div style={{
          fontFamily: 'var(--font-pixel)',
          fontSize: 22, color: '#7aaee8', lineHeight: 1,
        }}>
          {getTimeStr()}
        </div>
        <div style={{ fontSize: 9, color: '#3a4a6a', marginTop: 2 }}>
          {getAgeStr()}
        </div>
      </div>

      {/* ── Top-left: current activity badge (only when active) ── */}
      {actIcon && (
        <div style={{
          position: 'absolute', top: 12, left: 14,
          background: 'rgba(5,10,20,0.82)',
          border: '1px solid rgba(61,90,138,0.5)',
          borderRadius: 5, padding: '5px 10px',
          display: 'flex', alignItems: 'center', gap: 7,
        }}>
          <span style={{ fontSize: 16 }}>{actIcon}</span>
          <span style={{ fontSize: 11, color: '#7aaee8' }}>
            {ACTION_LABELS[character.currentActivity!] ?? character.currentActivity}
          </span>
        </div>
      )}

      {/* ── Bottom strip: stats + quick actions ── */}
      <div style={{
        position: 'absolute', bottom: 0, left: 0, right: 0,
        pointerEvents: 'auto',
        background: 'rgba(5,10,20,0.90)',
        borderTop: '1px solid rgba(42,51,80,0.7)',
        display: 'flex', alignItems: 'center',
        padding: '0 14px', height: 54, gap: 0,
      }}>

        {/* Name + phase */}
        <div style={{
          paddingRight: 14,
          borderRight: '1px solid rgba(42,51,80,0.8)',
          marginRight: 14,
        }}>
          <div style={{ fontSize: 12, fontWeight: 700, color: '#c8d8f0', lineHeight: 1.2 }}>
            {character.name}
          </div>
          <div style={{ fontSize: 9, color: '#3a4a6a', marginTop: 1 }}>
            {character.phase === 'adult' ? 'Adulto' : 'Adolescente'}
          </div>
        </div>

        {/* Stats */}
        <div style={{ display: 'flex', gap: 14, alignItems: 'center', flex: 1 }}>
          <StatMini icon="⚡" label="Energia"    value={character.energy}    color="#60b8ff" />
          <StatMini icon="❤"  label="Saúde"      value={character.health}    color="#ff6868" />
          <StatMini icon="😊" label="Felicidade"  value={character.happiness} color="#ffc840" />
          {character.stress > 50 && (
            <StatMini icon="😰" label="Estresse" value={character.stress}    color="#ff8040" />
          )}
          <MoneyChip money={character.money} />
        </div>

        {/* Nearby building quick-action buttons */}
        {nearby && !character.currentActivity && (
          <div style={{
            display: 'flex', gap: 6,
            paddingLeft: 14,
            borderLeft: '1px solid rgba(42,51,80,0.8)',
          }}>
            {nearby.actions.map(action => (
              <button
                key={action}
                onClick={() => triggerAction({ buildingId: nearby.id, action })}
                style={{
                  display: 'flex', alignItems: 'center', gap: 6,
                  padding: '5px 12px',
                  background: 'rgba(30,80,50,0.35)',
                  border: '1px solid rgba(69,176,117,0.55)',
                  borderRadius: 4,
                  color: '#45b075',
                  fontSize: 11, fontWeight: 700,
                  fontFamily: 'var(--font-ui)',
                  transition: 'background 0.1s, border-color 0.1s',
                  cursor: 'pointer',
                }}
                onMouseEnter={e => {
                  const el = e.currentTarget as HTMLElement;
                  el.style.background = 'rgba(30,80,50,0.6)';
                  el.style.borderColor = 'rgba(69,176,117,0.9)';
                }}
                onMouseLeave={e => {
                  const el = e.currentTarget as HTMLElement;
                  el.style.background = 'rgba(30,80,50,0.35)';
                  el.style.borderColor = 'rgba(69,176,117,0.55)';
                }}
              >
                <span style={{ fontSize: 15 }}>{ACTION_ICONS[action] ?? '?'}</span>
                {ACTION_LABELS[action] ?? action}
              </button>
            ))}
          </div>
        )}

        {/* Controls hint — very faint, far right */}
        <div style={{
          marginLeft: 14,
          fontSize: 9, color: 'rgba(80,100,140,0.5)',
          lineHeight: 1.7, textAlign: 'right',
        }}>
          WASD · E · Click
        </div>
      </div>
    </div>
  );
}

function StatMini({ icon, label, value, color }: {
  icon: string; label: string; value: number; color: string;
}) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 3, alignItems: 'center' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
        <span style={{ fontSize: 12 }}>{icon}</span>
        <span style={{ fontSize: 9, color: 'rgba(180,200,230,0.5)' }}>{label}</span>
      </div>
      <MiniBar value={value} color={color} />
    </div>
  );
}

function MoneyChip({ money }: { money: number }) {
  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 5,
      padding: '3px 9px',
      background: 'rgba(42,51,80,0.4)',
      border: '1px solid rgba(61,90,138,0.4)',
      borderRadius: 4,
    }}>
      <span style={{ fontSize: 12 }}>💰</span>
      <span style={{ fontSize: 12, fontWeight: 700, color: '#7aaee8' }}>
        R$&nbsp;{money.toLocaleString('pt-BR', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
      </span>
    </div>
  );
}

// ─── Offline Report ───────────────────────────────────────────────────────────

function OfflineReport({ result, onClose }: { result: OfflineProgressResult; onClose: () => void }) {
  const hours = Math.floor(result.timeElapsedMinutes / 60);
  const mins  = result.timeElapsedMinutes % 60;
  const timeLabel = hours > 0 ? `${hours}h ${mins}min` : `${mins} min`;

  return (
    <div style={{
      position: 'fixed', inset: 0,
      background: 'rgba(0,0,0,0.75)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      zIndex: 500,
    }}>
      <div style={{
        width: 340,
        background: '#0d1117',
        border: '1px solid #2a3350',
        borderRadius: 6,
        overflow: 'hidden',
      }}>
        <div style={{
          background: '#0a0e18',
          borderBottom: '1px solid #2a3350',
          padding: '10px 16px',
          fontFamily: 'var(--font-pixel)', fontSize: 15,
          color: '#7aaee8',
        }}>
          Você ficou fora por {timeLabel}
        </div>
        <div style={{ padding: '14px 16px' }}>
          <div style={{ color: '#4a5a7a', fontSize: 11, marginBottom: 10 }}>
            Enquanto isso, a vida continuou:
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 5, marginBottom: 16 }}>
            {result.moneyEarned > 0 && (
              <OfflineRow label="Renda recebida" value={`+R$ ${result.moneyEarned.toFixed(2)}`} color="#45b075" />
            )}
            {result.moneySpent > 0 && (
              <OfflineRow label="Despesas" value={`-R$ ${result.moneySpent.toFixed(2)}`} color="#ff6050" />
            )}
            {result.events.map((ev, i) => (
              <div key={i} style={{
                fontSize: 11, color: '#4a5a7a',
                borderTop: '1px solid #1a2030', paddingTop: 5,
              }}>
                {ev.description}
              </div>
            ))}
          </div>
          <button
            onClick={onClose}
            style={{
              width: '100%', padding: '9px',
              background: '#1a3a22',
              border: '1px solid #45b075',
              borderRadius: 4, color: '#45b075',
              fontFamily: 'var(--font-ui)', fontWeight: 700, fontSize: 13,
              cursor: 'pointer',
            }}
          >
            Continuar
          </button>
        </div>
      </div>
    </div>
  );
}

function OfflineRow({ label, value, color }: { label: string; value: string; color: string }) {
  return (
    <div style={{
      display: 'flex', justifyContent: 'space-between',
      padding: '4px 8px',
      background: '#0a0e18',
      border: '1px solid #1a2030',
      borderRadius: 3, fontSize: 11,
    }}>
      <span style={{ color: '#4a5a7a' }}>{label}</span>
      <span style={{ color, fontWeight: 700 }}>{value}</span>
    </div>
  );
}

// ─── Loading ──────────────────────────────────────────────────────────────────

function GameLoading() {
  return (
    <div style={{
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      height: '100vh', background: '#0a0e18',
      flexDirection: 'column', gap: 16,
    }}>
      <div style={{ fontFamily: 'var(--font-pixel)', fontSize: 26, color: '#7aaee8' }}>
        Tutorial da Vida
      </div>
      <div style={{ color: '#3a4a6a', fontSize: 12 }}>Carregando o mundo...</div>
      <div style={{
        width: 160, height: 4,
        background: '#0d1117',
        border: '1px solid #2a3350',
        borderRadius: 2, overflow: 'hidden',
      }}>
        <div style={{
          height: '100%', background: '#4a7fc1', borderRadius: 2,
          animation: 'loadBar 1.5s ease-in-out infinite',
        }} />
      </div>
      <style>{`@keyframes loadBar{0%{width:0%}50%{width:70%}100%{width:100%}}`}</style>
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

const PREVIEW_CHARACTER = {
  id: 1, name: 'João Silva', phase: 'adult' as const, gameAge: 9504000,
  energy: 72, happiness: 61, stress: 28, health: 85, money: 12500,
  monthlyIncome: 3200, monthlyExpenses: 1800, studyProgress: 0,
  currentActivity: null, activityEndsAt: null, locationId: 'player_home', jobTitle: 'Analista',
};

export default function GamePage() {
  const router         = useRouter();
  const setCharacter   = useGameStore(s => s.setCharacter);
  const setAccessToken = useGameStore(s => s.setAccessToken);
  const setLoaded      = useGameStore(s => s.setLoaded);
  const isLoaded       = useGameStore(s => s.isLoaded);
  const character      = useGameStore(s => s.character);

  const [offline, setOffline] = useState<OfflineProgressResult | null>(null);
  const [error,   setError]   = useState('');

  useEffect(() => {
    const preview = new URLSearchParams(window.location.search).get('preview');
    if (preview === '1') {
      setCharacter(PREVIEW_CHARACTER);
      setLoaded(true);
      return;
    }
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
        id: state.id, name: state.name, phase: state.phase, gameAge: state.gameAge,
        energy: state.energy, happiness: state.happiness, stress: state.stress,
        health: state.health, money: state.money, monthlyIncome: state.monthlyIncome,
        currentActivity: state.currentActivity, activityEndsAt: state.activityEndsAt,
        locationId: state.locationId, jobTitle: state.jobTitle,
        monthlyExpenses: state.monthlyExpenses,
        studyProgress: state.studyProgress,
      });
      setLoaded(true);
    } catch (err) {
      if (err instanceof ApiError && err.status === 404) { router.replace('/create-character'); return; }
      if (err instanceof ApiError && err.status === 401) { router.replace('/login'); return; }
      setError(err instanceof Error ? err.message : 'Erro ao carregar');
    }
  }

  if (error) {
    return (
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        height: '100vh', background: '#0a0e18',
        color: '#ff6b6b', fontFamily: 'monospace',
        fontSize: 13, flexDirection: 'column', gap: 12,
      }}>
        <div>Erro ao carregar o jogo</div>
        <div style={{ color: '#3a4a6a', fontSize: 11 }}>{error}</div>
        <button onClick={() => router.replace('/login')} style={{
          marginTop: 8, padding: '7px 18px',
          background: 'transparent',
          border: '1px solid #2a3350', borderRadius: 4,
          color: '#3a4a6a', fontFamily: 'monospace', fontSize: 11,
          cursor: 'pointer',
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
    <div style={{
      width: '100vw', height: '100vh',
      position: 'relative',
      background: '#1a2a0a',
      overflow: 'hidden',
    }}>
      {/* Full-screen canvas — world is the protagonist */}
      <GameCanvas />

      {/* Floating HUD overlay — secondary to the world */}
      <FloatingHUD />

      {offline && <OfflineReport result={offline} onClose={() => setOffline(null)} />}
    </div>
  );
}
