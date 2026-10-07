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
  loading: () => <div style={{ width: '100%', height: '100%', background: '#0a0f1a' }} />,
});

const ACTION_ICONS:  Record<string, string> = { work:'⚒', study:'📖', sleep:'💤', shop:'🛒', visit:'👋', idle:'💬' };
const ACTION_LABELS: Record<string, string> = { work:'Trabalhar', study:'Estudar', sleep:'Dormir', shop:'Comprar', visit:'Visitar', idle:'Descansar' };

// ─── Design tokens ────────────────────────────────────────────────────────────
const BG      = '#080c14';
const PANEL   = '#0d1421';
const BORDER  = '#1a253d';
const HEADER  = '#0a1020';
const ACCENT  = '#7aaee8';
const TEXT    = '#c8d8f0';
const MUTED   = '#3d4e6a';
const SUCCESS = '#45b075';
const DANGER  = '#e05555';

// ─── Helpers ─────────────────────────────────────────────────────────────────

function Pane({ children, style }: { children: React.ReactNode; style?: React.CSSProperties }) {
  return (
    <div style={{ background: PANEL, border: `1px solid ${BORDER}`, borderRadius: 3, overflow: 'hidden', ...style }}>
      {children}
    </div>
  );
}

function SectionHead({ title }: { title: string }) {
  return (
    <div style={{
      padding: '4px 9px',
      background: HEADER,
      borderBottom: `1px solid ${BORDER}`,
      fontSize: 8, letterSpacing: 1.2,
      fontFamily: 'monospace', color: MUTED,
      textTransform: 'uppercase',
    }}>{title}</div>
  );
}

function StatBar({ icon, label, value, color }: { icon: string; label: string; value: number; color: string }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '4px 9px' }}>
      <span style={{ fontSize: 11, width: 13, textAlign: 'center', lineHeight: 1 }}>{icon}</span>
      <div style={{ flex: 1 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 3 }}>
          <span style={{ fontSize: 9, color: MUTED }}>{label}</span>
          <span style={{ fontSize: 9, color: ACCENT }}>{Math.round(value)}</span>
        </div>
        <div style={{ height: 3, background: 'rgba(255,255,255,0.05)', borderRadius: 2, overflow: 'hidden' }}>
          <div style={{
            height: '100%', width: `${Math.max(0, Math.min(100, value))}%`,
            background: color, borderRadius: 2, transition: 'width 0.8s ease',
          }} />
        </div>
      </div>
    </div>
  );
}

// ─── Left sidebar ─────────────────────────────────────────────────────────────

type Character = NonNullable<ReturnType<typeof useGameStore.getState>['character']>;

function LeftSidebar({ char }: { char: Character }) {
  const actIcon = char.currentActivity ? ACTION_ICONS[char.currentActivity] : null;

  return (
    <div style={{
      width: 252, flexShrink: 0,
      background: BG,
      borderRight: `1px solid ${BORDER}`,
      display: 'flex', flexDirection: 'column',
      padding: 6, gap: 5,
      overflow: 'hidden',
    }}>
      <Pane>
        <SectionHead title="Personagem" />
        <div style={{ padding: '8px 9px' }}>
          <div style={{ fontSize: 14, fontWeight: 700, color: TEXT, lineHeight: 1.2 }}>{char.name}</div>
          <div style={{ fontSize: 9, color: MUTED, marginTop: 2 }}>
            {char.phase === 'adult' ? 'Adulto' : 'Adolescente'}
            {char.jobTitle ? ` · ${char.jobTitle}` : ''}
          </div>
        </div>
      </Pane>

      <Pane>
        <SectionHead title="Atributos" />
        <div style={{ paddingTop: 2, paddingBottom: 4 }}>
          <StatBar icon="⚡" label="Energia"    value={char.energy}    color="#60b8ff" />
          <StatBar icon="❤" label="Saúde"      value={char.health}    color="#e05555" />
          <StatBar icon="😊" label="Felicidade" value={char.happiness} color="#ffc840" />
          {char.stress > 40 && (
            <StatBar icon="😰" label="Estresse" value={char.stress}   color="#ff8040" />
          )}
        </div>
      </Pane>

      {actIcon && (
        <Pane>
          <SectionHead title="Atividade" />
          <div style={{ padding: '7px 9px', display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ fontSize: 18 }}>{actIcon}</span>
            <span style={{ fontSize: 11, color: ACCENT }}>
              {ACTION_LABELS[char.currentActivity!] ?? char.currentActivity}
            </span>
          </div>
        </Pane>
      )}

      <div style={{ marginTop: 'auto', fontSize: 9, color: MUTED, lineHeight: 2, padding: '0 2px' }}>
        WASD / Setas — mover<br />
        E — interagir<br />
        Click — caminhar até
      </div>
    </div>
  );
}

// ─── Right sidebar ────────────────────────────────────────────────────────────

function RightSidebar({
  char, nearby, triggerAction,
}: {
  char: Character;
  nearby: (typeof BUILDINGS)[0] | undefined;
  triggerAction: (a: { buildingId: string; action: string }) => void;
}) {
  return (
    <div style={{
      width: 252, flexShrink: 0,
      background: BG,
      borderLeft: `1px solid ${BORDER}`,
      display: 'flex', flexDirection: 'column',
      padding: 6, gap: 5,
      overflow: 'hidden',
    }}>
      <Pane>
        <SectionHead title="Finanças" />
        <div style={{ padding: '8px 9px' }}>
          <div style={{ fontSize: 22, fontWeight: 700, color: ACCENT, lineHeight: 1 }}>
            R$&nbsp;{char.money.toLocaleString('pt-BR', { minimumFractionDigits: 0 })}
          </div>
          <div style={{ marginTop: 6, display: 'flex', flexDirection: 'column', gap: 3 }}>
            {char.monthlyIncome > 0 && (
              <Row label="Renda / mês" value={`+R$ ${char.monthlyIncome.toLocaleString('pt-BR')}`} color={SUCCESS} />
            )}
            {char.monthlyExpenses > 0 && (
              <Row label="Despesas / mês" value={`-R$ ${char.monthlyExpenses.toLocaleString('pt-BR')}`} color={DANGER} />
            )}
          </div>
        </div>
      </Pane>

      {nearby && !char.currentActivity && (
        <Pane>
          <SectionHead title={`Ações · ${nearby.label}`} />
          <div style={{ padding: '6px 9px', display: 'flex', flexDirection: 'column', gap: 4 }}>
            {nearby.actions.map(action => (
              <ActionBtn
                key={action}
                icon={ACTION_ICONS[action] ?? '?'}
                label={ACTION_LABELS[action] ?? action}
                onClick={() => triggerAction({ buildingId: nearby.id, action })}
              />
            ))}
          </div>
        </Pane>
      )}

      <Pane>
        <SectionHead title="Objetivos" />
        <div style={{ padding: '7px 9px', display: 'flex', flexDirection: 'column', gap: 5 }}>
          <Goal label="Explorar o bairro" done={false} />
          <Goal label="Ir ao trabalho" done={false} />
          <Goal label="Estudar na escola" done={false} />
          <Goal label="Visitar o parque" done={false} />
        </div>
      </Pane>
    </div>
  );
}

function Row({ label, value, color }: { label: string; value: string; color: string }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 9 }}>
      <span style={{ color: MUTED }}>{label}</span>
      <span style={{ color, fontWeight: 700 }}>{value}</span>
    </div>
  );
}

function ActionBtn({ icon, label, onClick }: { icon: string; label: string; onClick: () => void }) {
  return (
    <button onClick={onClick} style={{
      display: 'flex', alignItems: 'center', gap: 8,
      padding: '7px 10px',
      background: 'rgba(69,176,117,0.12)',
      border: `1px solid rgba(69,176,117,0.35)`,
      borderRadius: 3, color: SUCCESS,
      fontSize: 11, fontWeight: 700,
      fontFamily: 'var(--font-ui)',
      cursor: 'pointer', textAlign: 'left', width: '100%',
    }}
    onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = 'rgba(69,176,117,0.24)'; }}
    onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = 'rgba(69,176,117,0.12)'; }}
    >
      <span style={{ fontSize: 14 }}>{icon}</span>
      {label}
    </button>
  );
}

function Goal({ label, done }: { label: string; done: boolean }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 10, color: done ? SUCCESS : MUTED }}>
      <span>{done ? '✓' : '○'}</span>
      <span style={{ textDecoration: done ? 'line-through' : 'none' }}>{label}</span>
    </div>
  );
}

// ─── Top bar ─────────────────────────────────────────────────────────────────

function TopBar({ timeStr, ageStr }: { timeStr: string; ageStr: string }) {
  return (
    <div style={{
      height: 42, flexShrink: 0,
      background: PANEL,
      borderBottom: `1px solid ${BORDER}`,
      display: 'flex', alignItems: 'center',
      padding: '0 14px',
    }}>
      <span style={{ fontFamily: 'var(--font-pixel)', fontSize: 14, color: ACCENT }}>
        Tutorial da Vida
      </span>
      <div style={{ flex: 1 }} />
      <div style={{ textAlign: 'right' }}>
        <div style={{ fontFamily: 'var(--font-pixel)', fontSize: 20, color: ACCENT, lineHeight: 1 }}>
          {timeStr}
        </div>
        <div style={{ fontSize: 9, color: MUTED, marginTop: 1 }}>{ageStr}</div>
      </div>
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
        width: 340, background: PANEL,
        border: `1px solid ${BORDER}`, borderRadius: 6, overflow: 'hidden',
      }}>
        <div style={{
          background: HEADER, borderBottom: `1px solid ${BORDER}`,
          padding: '10px 16px',
          fontFamily: 'var(--font-pixel)', fontSize: 15, color: ACCENT,
        }}>
          Você ficou fora por {timeLabel}
        </div>
        <div style={{ padding: '14px 16px' }}>
          <div style={{ color: MUTED, fontSize: 11, marginBottom: 10 }}>Enquanto isso, a vida continuou:</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 5, marginBottom: 16 }}>
            {result.moneyEarned > 0 && (
              <OffRow label="Renda recebida" value={`+R$ ${result.moneyEarned.toFixed(2)}`} color={SUCCESS} />
            )}
            {result.moneySpent > 0 && (
              <OffRow label="Despesas" value={`-R$ ${result.moneySpent.toFixed(2)}`} color={DANGER} />
            )}
            {result.events.map((ev, i) => (
              <div key={i} style={{ fontSize: 11, color: MUTED, borderTop: `1px solid ${BORDER}`, paddingTop: 5 }}>
                {ev.description}
              </div>
            ))}
          </div>
          <button onClick={onClose} style={{
            width: '100%', padding: '9px',
            background: 'rgba(69,176,117,0.15)',
            border: `1px solid ${SUCCESS}`,
            borderRadius: 4, color: SUCCESS,
            fontFamily: 'var(--font-ui)', fontWeight: 700, fontSize: 13,
            cursor: 'pointer',
          }}>
            Continuar
          </button>
        </div>
      </div>
    </div>
  );
}

function OffRow({ label, value, color }: { label: string; value: string; color: string }) {
  return (
    <div style={{
      display: 'flex', justifyContent: 'space-between',
      padding: '4px 8px', background: HEADER,
      border: `1px solid ${BORDER}`, borderRadius: 3, fontSize: 11,
    }}>
      <span style={{ color: MUTED }}>{label}</span>
      <span style={{ color, fontWeight: 700 }}>{value}</span>
    </div>
  );
}

// ─── Loading / Error ──────────────────────────────────────────────────────────

function GameLoading() {
  return (
    <div style={{
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      height: '100vh', background: BG,
      flexDirection: 'column', gap: 16,
    }}>
      <div style={{ fontFamily: 'var(--font-pixel)', fontSize: 26, color: ACCENT }}>Tutorial da Vida</div>
      <div style={{ color: MUTED, fontSize: 12 }}>Carregando o mundo...</div>
      <div style={{ width: 160, height: 4, background: HEADER, border: `1px solid ${BORDER}`, borderRadius: 2, overflow: 'hidden' }}>
        <div style={{ height: '100%', background: ACCENT, borderRadius: 2, animation: 'loadBar 1.5s ease-in-out infinite' }} />
      </div>
      <style>{`@keyframes loadBar{0%{width:0%}50%{width:70%}100%{width:100%}}`}</style>
    </div>
  );
}

// ─── Preview character ────────────────────────────────────────────────────────

const PREVIEW_CHARACTER = {
  id: 1, name: 'João Silva', phase: 'adult' as const, gameAge: 9504000,
  energy: 72, happiness: 61, stress: 28, health: 85, money: 12500,
  monthlyIncome: 3200, monthlyExpenses: 1800, studyProgress: 0,
  currentActivity: null, activityEndsAt: null, locationId: 'player_home', jobTitle: 'Analista',
};

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function GamePage() {
  const router         = useRouter();
  const setCharacter   = useGameStore(s => s.setCharacter);
  const setAccessToken = useGameStore(s => s.setAccessToken);
  const setLoaded      = useGameStore(s => s.setLoaded);
  const isLoaded       = useGameStore(s => s.isLoaded);
  const character      = useGameStore(s => s.character);
  const getTimeStr     = useGameStore(s => s.getTimeString);
  const getAgeStr      = useGameStore(s => s.getAgeString);
  const nearbyId       = useGameStore(s => s.nearbyBuildingId);
  const triggerAction  = useGameStore(s => s.triggerAction);

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
        height: '100vh', background: BG, color: DANGER,
        fontFamily: 'monospace', fontSize: 13, flexDirection: 'column', gap: 12,
      }}>
        <div>Erro ao carregar o jogo</div>
        <div style={{ color: MUTED, fontSize: 11 }}>{error}</div>
        <button onClick={() => router.replace('/login')} style={{
          marginTop: 8, padding: '7px 18px',
          background: 'transparent', border: `1px solid ${BORDER}`,
          borderRadius: 4, color: MUTED, fontFamily: 'monospace', fontSize: 11, cursor: 'pointer',
        }}>Voltar ao login</button>
      </div>
    );
  }

  if (!isLoaded) return <GameLoading />;
  if (character && character.phase !== 'adult') return <LifeNarrative />;

  const nearby = nearbyId ? BUILDINGS.find(b => b.id === nearbyId) : undefined;

  return (
    <div style={{
      width: '100vw', height: '100vh',
      display: 'flex', flexDirection: 'column',
      background: BG, overflow: 'hidden',
      fontFamily: 'var(--font-ui)',
    }}>
      <TopBar timeStr={getTimeStr()} ageStr={getAgeStr()} />

      <div style={{ flex: 1, display: 'flex', overflow: 'hidden', minHeight: 0 }}>
        {character && <LeftSidebar char={character} />}

        {/* ── CENTER: game canvas ── */}
        <div style={{ flex: 1, position: 'relative', minWidth: 0, overflow: 'hidden' }}>
          <GameCanvas />
        </div>

        {character && (
          <RightSidebar char={character} nearby={nearby} triggerAction={triggerAction} />
        )}
      </div>
    </div>
  );
}
