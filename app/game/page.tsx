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

// ── Design tokens ──────────────────────────────────────────────────────────────
const BG      = '#07090f';
const PANEL   = '#0c1220';
const BORDER  = '#182035';
const HEADER  = '#090e1a';
const ACCENT  = '#5b9bd5';
const TEXT    = '#c0cce0';
const MUTED   = '#334055';
const SUCCESS = '#3aa870';
const DANGER  = '#cc4444';
const GOLD    = '#c8a84b';
const WARN    = '#e08030';

// ── Reusable primitives ────────────────────────────────────────────────────────

function PanelSection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div style={{ borderBottom: `1px solid ${BORDER}` }}>
      <div style={{
        padding: '6px 12px',
        background: HEADER,
        borderBottom: `1px solid ${BORDER}`,
        fontSize: 'var(--fs-sm)', letterSpacing: 1,
        fontFamily: 'monospace', color: MUTED,
        textTransform: 'uppercase', fontWeight: 700,
      }}>{title}</div>
      <div style={{ padding: '10px 12px' }}>{children}</div>
    </div>
  );
}

function MiniBar({ value, color, max = 100 }: { value: number; color: string; max?: number }) {
  return (
    <div style={{ height: 4, background: 'rgba(255,255,255,0.06)', borderRadius: 2, overflow: 'hidden', flex: 1 }}>
      <div style={{
        height: '100%', width: `${Math.max(0, Math.min(100, (value / max) * 100))}%`,
        background: color, borderRadius: 2, transition: 'width 1s ease',
      }} />
    </div>
  );
}

function StatRow({ icon, label, value, color }: { icon: string; label: string; value: number; color: string }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
      <span style={{ fontSize: 'var(--icon-sm)', width: 20, textAlign: 'center' }}>{icon}</span>
      <span style={{ fontSize: 'var(--fs-sm)', color: MUTED, width: 76 }}>{label}</span>
      <MiniBar value={value} color={color} />
      <span style={{ fontSize: 'var(--fs-md)', color: ACCENT, width: 34, textAlign: 'right', fontFamily: 'monospace', fontWeight: 700 }}>
        {Math.round(value)}
      </span>
    </div>
  );
}

// ── Top resource bar ───────────────────────────────────────────────────────────

type Character = NonNullable<ReturnType<typeof useGameStore.getState>['character']>;

function TopBar({ char, timeStr, ageStr }: { char: Character; timeStr: string; ageStr: string }) {
  const actIcon = char.currentActivity ? ACTION_ICONS[char.currentActivity] : null;

  return (
    <div style={{
      height: 52, flexShrink: 0,
      background: PANEL,
      borderBottom: `2px solid ${BORDER}`,
      display: 'flex', alignItems: 'stretch',
      overflow: 'hidden',
    }}>
      {/* Avatar + name */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: 10,
        padding: '0 14px',
        borderRight: `1px solid ${BORDER}`,
        minWidth: 160,
      }}>
        <div style={{
          width: 34, height: 34, borderRadius: 4,
          background: `linear-gradient(135deg, ${ACCENT}33, ${ACCENT}11)`,
          border: `1px solid ${ACCENT}44`,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: 'var(--icon-sm)', flexShrink: 0,
        }}>🏙</div>
        <div>
          <div style={{ fontSize: 'var(--fs-lg)', fontWeight: 700, color: TEXT, lineHeight: 1.2 }}>{char.name}</div>
          <div style={{ fontSize: 'var(--fs-xs)', color: MUTED }}>
            {char.phase === 'adult' ? 'Adulto' : 'Adolescente'}
            {char.jobTitle ? ` · ${char.jobTitle}` : ''}
          </div>
        </div>
      </div>

      {/* Resources */}
      <div style={{ display: 'flex', flex: 1, alignItems: 'stretch' }}>
        <ResourceCell icon="💰" label="Saldo" value={`R$ ${char.money.toLocaleString('pt-BR', { minimumFractionDigits: 0 })}`} color={GOLD} />
        <ResourceCell icon="⚡" label="Energia" value={`${Math.round(char.energy)}%`} color="#60b8ff" bar={char.energy} />
        <ResourceCell icon="❤" label="Saúde" value={`${Math.round(char.health)}%`} color={DANGER} bar={char.health} />
        <ResourceCell icon="😊" label="Felicidade" value={`${Math.round(char.happiness)}%`} color={SUCCESS} bar={char.happiness} />
        {char.stress > 35 && (
          <ResourceCell icon="😰" label="Estresse" value={`${Math.round(char.stress)}%`} color={WARN} bar={char.stress} />
        )}
        {actIcon && (
          <ResourceCell icon={actIcon} label="Atividade" value={ACTION_LABELS[char.currentActivity!] ?? ''} color={ACCENT} />
        )}
      </div>

      {/* Time */}
      <div style={{
        display: 'flex', flexDirection: 'column', alignItems: 'flex-end', justifyContent: 'center',
        padding: '0 14px', borderLeft: `1px solid ${BORDER}`, minWidth: 110,
      }}>
        <div style={{ fontFamily: 'var(--font-pixel)', fontSize: 'var(--fs-2xl)', color: ACCENT, lineHeight: 1 }}>{timeStr}</div>
        <div style={{ fontSize: 'var(--fs-xs)', color: MUTED, marginTop: 4 }}>{ageStr}</div>
      </div>
    </div>
  );
}

function ResourceCell({ icon, label, value, color, bar }: { icon: string; label: string; value: string; color: string; bar?: number }) {
  return (
    <div style={{
      display: 'flex', flexDirection: 'column', justifyContent: 'center',
      padding: '0 16px', borderRight: `1px solid ${BORDER}`,
      minWidth: 120,
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 7, marginBottom: bar !== undefined ? 5 : 0 }}>
        <span style={{ fontSize: 'var(--icon-sm)' }}>{icon}</span>
        <span style={{ fontSize: 'var(--fs-lg)', fontWeight: 700, color, fontFamily: 'monospace' }}>{value}</span>
      </div>
      {bar !== undefined && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <span style={{ fontSize: 'var(--fs-xs)', color: MUTED, width: 64 }}>{label}</span>
          <MiniBar value={bar} color={color} />
        </div>
      )}
      {bar === undefined && (
        <div style={{ fontSize: 'var(--fs-xs)', color: MUTED }}>{label}</div>
      )}
    </div>
  );
}

// ── Left panel ─────────────────────────────────────────────────────────────────

function MobileTopBar({ char, timeStr }: { char: Character; timeStr: string }) {
  return (
    <div style={{
      height: 42, flexShrink: 0,
      background: PANEL, borderBottom: `2px solid ${BORDER}`,
      display: 'flex', alignItems: 'center', padding: '0 10px', gap: 10,
    }}>
      <span style={{ fontSize: 'var(--icon-sm)' }}>🏙</span>
      <span style={{ fontSize: 'var(--fs-sm)', fontWeight: 700, color: TEXT }}>{char.name}</span>
      <div style={{ flex: 1 }} />
      <span style={{ fontSize: 'var(--fs-sm)', color: GOLD, fontFamily: 'monospace', fontWeight: 700 }}>
        R$ {char.money.toLocaleString('pt-BR')}
      </span>
      <div style={{ width: 1, height: 20, background: BORDER }} />
      <span style={{ fontFamily: 'var(--font-pixel)', fontSize: 'var(--fs-md)', color: ACCENT }}>{timeStr}</span>
    </div>
  );
}

function LeftPanel({ char, sidebarW }: { char: Character; sidebarW: number }) {
  return (
    <div style={{
      width: sidebarW, flexShrink: 0,
      background: BG,
      borderRight: `2px solid ${BORDER}`,
      display: 'flex', flexDirection: 'column',
      overflow: 'hidden',
    }}>
      <PanelSection title="Objetivos">
        <GoalItem done={false} label="Explorar o bairro" />
        <GoalItem done={false} label="Ir ao trabalho" />
        <GoalItem done={false} label="Estudar na escola" />
        <GoalItem done={false} label="Visitar o parque" />
      </PanelSection>

      <PanelSection title="Missões">
        <MissionItem label="Conhecer 3 vizinhos" progress={0} goal={3} />
        <MissionItem label="Trabalhar 5 dias" progress={0} goal={5} />
        <MissionItem label="Poupar R$ 5.000" progress={char.money} goal={5000} />
      </PanelSection>

      <PanelSection title="Finanças">
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
          <span style={{ fontSize: 'var(--fs-sm)', color: MUTED }}>Renda / mês</span>
          <span style={{ fontSize: 'var(--fs-md)', color: SUCCESS, fontFamily: 'monospace', fontWeight: 700 }}>
            +R$ {char.monthlyIncome.toLocaleString('pt-BR')}
          </span>
        </div>
        {char.monthlyExpenses > 0 && (
          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
            <span style={{ fontSize: 'var(--fs-sm)', color: MUTED }}>Despesas / mês</span>
            <span style={{ fontSize: 'var(--fs-md)', color: DANGER, fontFamily: 'monospace', fontWeight: 700 }}>
              -R$ {char.monthlyExpenses.toLocaleString('pt-BR')}
            </span>
          </div>
        )}
      </PanelSection>

      <div style={{ marginTop: 'auto', padding: '12px', borderTop: `1px solid ${BORDER}` }}>
        <div style={{ fontSize: 'var(--fs-xs)', color: MUTED, lineHeight: 2, fontFamily: 'monospace' }}>
          WASD · Setas — mover<br />
          E — interagir · Click — ir até
        </div>
      </div>
    </div>
  );
}

function GoalItem({ done, label }: { done: boolean; label: string }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 9, fontSize: 'var(--fs-md)' }}>
      <span style={{ color: done ? SUCCESS : MUTED, fontSize: 'var(--fs-sm)' }}>{done ? '✓' : '○'}</span>
      <span style={{ color: done ? SUCCESS : TEXT, textDecoration: done ? 'line-through' : 'none' }}>{label}</span>
    </div>
  );
}

function MissionItem({ label, progress, goal }: { label: string; progress: number; goal: number }) {
  const pct = Math.min(100, (progress / goal) * 100);
  const done = progress >= goal;
  return (
    <div style={{ marginBottom: 12 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 5 }}>
        <span style={{ fontSize: 'var(--fs-sm)', color: done ? SUCCESS : TEXT }}>{label}</span>
        <span style={{ fontSize: 'var(--fs-xs)', color: MUTED, fontFamily: 'monospace' }}>
          {progress.toLocaleString('pt-BR')}/{goal.toLocaleString('pt-BR')}
        </span>
      </div>
      <div style={{ height: 6, background: 'rgba(255,255,255,0.08)', borderRadius: 3, overflow: 'hidden' }}>
        <div style={{ height: '100%', width: `${pct}%`, background: done ? SUCCESS : ACCENT, borderRadius: 3, transition: 'width 1s ease' }} />
      </div>
    </div>
  );
}

// ── Right panel ────────────────────────────────────────────────────────────────

function RightPanel({
  char, nearby, triggerAction, sidebarW,
}: {
  char: Character;
  nearby: (typeof BUILDINGS)[0] | undefined;
  triggerAction: (a: { buildingId: string; action: string }) => void;
  sidebarW: number;
}) {
  return (
    <div style={{
      width: sidebarW, flexShrink: 0,
      background: BG,
      borderLeft: `2px solid ${BORDER}`,
      display: 'flex', flexDirection: 'column',
      overflow: 'hidden',
    }}>
      <PanelSection title="Atributos">
        <StatRow icon="⚡" label="Energia" value={char.energy} color="#60b8ff" />
        <StatRow icon="❤" label="Saúde" value={char.health} color={DANGER} />
        <StatRow icon="😊" label="Felicidade" value={char.happiness} color={SUCCESS} />
        {char.stress > 35 && (
          <StatRow icon="😰" label="Estresse" value={char.stress} color={WARN} />
        )}
      </PanelSection>

      {nearby && !char.currentActivity && (
        <PanelSection title={nearby.label}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            {nearby.actions.map(action => (
              <ActionBtn
                key={action}
                icon={ACTION_ICONS[action] ?? '?'}
                label={ACTION_LABELS[action] ?? action}
                onClick={() => triggerAction({ buildingId: nearby.id, action })}
              />
            ))}
          </div>
        </PanelSection>
      )}

      {!nearby && (
        <PanelSection title="Local">
          <div style={{ fontSize: 'var(--fs-sm)', color: MUTED, lineHeight: 1.9 }}>
            Aproxime-se de<br />um prédio para<br />ver as ações.
          </div>
        </PanelSection>
      )}

      <PanelSection title="Localização">
        <div style={{ fontSize: 'var(--fs-md)', color: TEXT, fontWeight: 600 }}>Bairro Central</div>
        <div style={{ fontSize: 'var(--fs-xs)', color: MUTED, marginTop: 5 }}>
          {char.locationId?.replace('_', ' ') ?? '—'}
        </div>
      </PanelSection>
    </div>
  );
}

function ActionBtn({ icon, label, onClick }: { icon: string; label: string; onClick: () => void }) {
  return (
    <button onClick={onClick} style={{
      display: 'flex', alignItems: 'center', gap: 10,
      padding: '10px 12px',
      background: `${SUCCESS}14`,
      border: `1px solid ${SUCCESS}44`,
      borderRadius: 4, color: SUCCESS,
      fontSize: 'var(--fs-md)', fontWeight: 700,
      fontFamily: 'var(--font-ui)',
      cursor: 'pointer', textAlign: 'left', width: '100%',
    }}
    onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = `${SUCCESS}28`; }}
    onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = `${SUCCESS}14`; }}
    >
      <span style={{ fontSize: 'var(--fs-sm)' }}>{icon}</span>
      {label}
    </button>
  );
}

// ── Bottom navigation ──────────────────────────────────────────────────────────

const NAV_ITEMS = [
  { icon: '🏠', label: 'Casa' },
  { icon: '📚', label: 'Escola' },
  { icon: '💼', label: 'Trabalho' },
  { icon: '🏪', label: 'Mercado' },
  { icon: '🏦', label: 'Banco' },
  { icon: '🏥', label: 'Hospital' },
  { icon: '🌳', label: 'Parque' },
  { icon: '📊', label: 'Status' },
];

function BottomNav({ isMobile }: { isMobile: boolean }) {
  const [active, setActive] = useState(0);

  return (
    <div style={{
      height: isMobile ? 64 : 56, flexShrink: 0,
      background: PANEL,
      borderTop: `2px solid ${BORDER}`,
      display: 'flex', alignItems: 'stretch',
    }}>
      {NAV_ITEMS.map((item, i) => (
        <button
          key={item.label}
          onClick={() => setActive(i)}
          style={{
            flex: 1, display: 'flex', flexDirection: 'column',
            alignItems: 'center', justifyContent: 'center', gap: 2,
            background: active === i ? `${ACCENT}18` : 'transparent',
            border: 'none',
            borderRight: `1px solid ${BORDER}`,
            borderTop: active === i ? `2px solid ${ACCENT}` : '2px solid transparent',
            color: active === i ? ACCENT : MUTED,
            cursor: 'pointer',
            padding: isMobile ? '4px 2px' : '2px 4px',
            transition: 'all 0.15s ease',
          }}
          onMouseEnter={e => {
            if (active !== i) (e.currentTarget as HTMLElement).style.background = `${ACCENT}0c`;
          }}
          onMouseLeave={e => {
            if (active !== i) (e.currentTarget as HTMLElement).style.background = 'transparent';
          }}
        >
          <span style={{ fontSize: isMobile ? 'var(--icon-lg)' : 'var(--icon-md)' }}>{item.icon}</span>
          {!isMobile && (
            <span style={{ fontSize: 'var(--fs-xs)', fontFamily: 'monospace', letterSpacing: 0.5 }}>{item.label}</span>
          )}
        </button>
      ))}
    </div>
  );
}

// ── Loading / Error ────────────────────────────────────────────────────────────

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

// ── Offline Report ─────────────────────────────────────────────────────────────

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
            background: `${SUCCESS}28`,
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

// ── Preview character ──────────────────────────────────────────────────────────

const PREVIEW_CHARACTER = {
  id: 1, name: 'João Silva', phase: 'adult' as const, gameAge: 9504000,
  energy: 72, happiness: 61, stress: 28, health: 85, money: 12500,
  monthlyIncome: 3200, monthlyExpenses: 1800, studyProgress: 0,
  currentActivity: null, activityEndsAt: null, locationId: 'player_home', jobTitle: 'Analista',
};

// ── Page ───────────────────────────────────────────────────────────────────────

function useScreenWidth() {
  const [w, setW] = useState(typeof window !== 'undefined' ? window.innerWidth : 1280);
  useEffect(() => {
    const handler = () => setW(window.innerWidth);
    window.addEventListener('resize', handler);
    return () => window.removeEventListener('resize', handler);
  }, []);
  return w;
}

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

  const screenW = useScreenWidth();
  const isMobile  = screenW < 768;
  const isCompact = screenW < 1100 && screenW >= 768;

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

  const sidebarW = isCompact ? Math.floor(screenW * 0.17) : Math.max(280, Math.floor(screenW * 0.20));

  return (
    <div style={{
      width: '100vw', height: '100vh',
      display: 'flex', flexDirection: 'column',
      background: BG, overflow: 'hidden',
      fontFamily: 'var(--font-ui)',
    }}>
      {/* Responsive font scale */}
      <style>{`
        :root {
          --fs-xs:   clamp(13px, 0.95vw, 17px);
          --fs-sm:   clamp(15px, 1.10vw, 20px);
          --fs-md:   clamp(17px, 1.30vw, 23px);
          --fs-lg:   clamp(19px, 1.50vw, 26px);
          --fs-xl:   clamp(22px, 1.70vw, 30px);
          --fs-2xl:  clamp(26px, 2.00vw, 36px);
          --icon-sm: clamp(16px, 1.25vw, 22px);
          --icon-md: clamp(20px, 1.55vw, 28px);
          --icon-lg: clamp(24px, 1.85vw, 32px);
        }
      `}</style>

      {/* Top bar */}
      {character && !isMobile && (
        <TopBar char={character} timeStr={getTimeStr()} ageStr={getAgeStr()} />
      )}
      {character && isMobile && (
        <MobileTopBar char={character} timeStr={getTimeStr()} />
      )}

      {/* Main area */}
      <div style={{ flex: 1, display: 'flex', overflow: 'hidden', minHeight: 0 }}>
        {/* Left panel — hidden on mobile */}
        {!isMobile && character && (
          <div style={{ width: sidebarW, flexShrink: 0 }}>
            <LeftPanel char={character} sidebarW={sidebarW} />
          </div>
        )}

        {/* Game canvas */}
        <div style={{ flex: 1, position: 'relative', minWidth: 0, overflow: 'hidden' }}>
          <GameCanvas />
        </div>

        {/* Right panel — hidden on mobile */}
        {!isMobile && character && (
          <div style={{ width: sidebarW, flexShrink: 0 }}>
            <RightPanel char={character} nearby={nearby} triggerAction={triggerAction} sidebarW={sidebarW} />
          </div>
        )}
      </div>

      {/* Bottom navigation */}
      <BottomNav isMobile={isMobile} />

      {offline && <OfflineReport result={offline} onClose={() => setOffline(null)} />}
    </div>
  );
}
