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
  loading: () => <div style={{ width: '100%', height: '100%', background: '#1e3010' }} />,
});

// ─── Design tokens ──────────────────────────────────────────────────────────
const C = {
  bg:          '#0d1117',
  panel:       '#161b27',
  panelLite:   '#1e2535',
  panelDark:   '#0a0e18',
  border:      '#2a3350',
  borderAccent:'#3d5a8a',
  accent:      '#4a7fc1',
  accentLight: '#7aaee8',
  text:        '#dde4f0',
  textDim:     '#7a8aaa',
  textDark:    '#3a4a6a',
  green:       '#2a7a50',
  greenLite:   '#45b075',
  red:         '#9a2535',
  yellow:      '#c8a020',
  yellowLite:  '#e8c040',
};

// ─── Helpers ─────────────────────────────────────────────────────────────────

function statColor(v: number) {
  if (v > 60) return '#4a9a35';
  if (v > 30) return '#c07020';
  return '#9a2020';
}

function StatBar({ label, value, color }: { label: string; value: number; color?: string }) {
  const c = color ?? statColor(value);
  return (
    <div className="stat-bar-wrap">
      <span className="stat-bar-label">{label}</span>
      <div className="stat-bar-track">
        <div className="stat-bar-fill" style={{ width: `${Math.max(0, Math.min(100, value))}%`, background: c }} />
      </div>
      <span className="stat-bar-val">{Math.round(value)}</span>
    </div>
  );
}

function SectionTitle({ icon, label }: { icon: string; label: string }) {
  return (
    <div className="section-title">
      <span>{icon}</span>
      <span>{label}</span>
    </div>
  );
}

// ─── Top Bar ─────────────────────────────────────────────────────────────────

function TopBar() {
  const character   = useGameStore(s => s.character);
  const getTimeStr  = useGameStore(s => s.getTimeString);
  const getAgeStr   = useGameStore(s => s.getAgeString);

  if (!character) return null;

  return (
    <div style={{
      height: 48, background: C.panelDark,
      borderBottom: `2px solid ${C.borderAccent}`,
      display: 'flex', alignItems: 'center', gap: 8,
      padding: '0 10px', flexShrink: 0,
    }}>
      {/* Avatar + name */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: 8,
        padding: '4px 10px', background: C.panel,
        border: `1px solid ${C.borderAccent}`, borderRadius: 4,
        minWidth: 150,
      }}>
        <span style={{ fontSize: 22 }}>🌍</span>
        <div>
          <div style={{ fontWeight: 700, fontSize: 13, color: C.accentLight, lineHeight: 1.2 }}>
            {character.name}
          </div>
          <div style={{ fontSize: 10, color: C.textDim }}>
            {character.phase === 'adult' ? 'Adulto' : character.phase === 'adolescence' ? 'Adolescente' : 'Jovem'}
          </div>
        </div>
      </div>

      <div style={{ width: 1, height: 30, background: C.border }} />

      {/* Resources */}
      <div style={{ display: 'flex', gap: 6, flex: 1 }}>
        <ResourceChip icon="💰" label="Dinheiro"
          value={`R$ ${character.money.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`}
          color={C.accentLight} />
        <ResourceChip icon="⚡" label="Energia"   value={`${Math.round(character.energy)}%`}     color="#60c0ff" />
        <ResourceChip icon="❤" label="Saúde"      value={`${Math.round(character.health)}%`}     color="#ff6060" />
        <ResourceChip icon="😊" label="Felicid."  value={`${Math.round(character.happiness)}%`}  color="#ffd060" />
        {character.stress > 40 && (
          <ResourceChip icon="😰" label="Estresse" value={`${Math.round(character.stress)}%`}    color="#ff8040" />
        )}
      </div>

      {/* Time */}
      <div style={{
        padding: '4px 12px', background: C.panel,
        border: `1px solid ${C.border}`, borderRadius: 4,
        textAlign: 'center',
      }}>
        <div style={{ fontFamily: 'var(--font-pixel)', fontSize: 18, color: C.accentLight, lineHeight: 1 }}>
          {getTimeStr()}
        </div>
        <div style={{ fontSize: 9, color: C.textDim, marginTop: 2 }}>{getAgeStr()}</div>
      </div>
    </div>
  );
}

function ResourceChip({ icon, label, value, color }: { icon: string; label: string; value: string; color: string }) {
  return (
    <div className="resource-chip">
      <span className="icon">{icon}</span>
      <div>
        <div style={{ fontSize: 9, color: C.textDim, lineHeight: 1 }}>{label}</div>
        <div style={{ fontSize: 13, color, fontWeight: 700, lineHeight: 1.3 }}>{value}</div>
      </div>
    </div>
  );
}

// ─── Left Panel ──────────────────────────────────────────────────────────────

const ACTION_ICONS: Record<string, string>   = { work:'⚒', study:'📖', sleep:'💤', shop:'🛒', visit:'👋', idle:'💬' };
const ACTION_LABELS: Record<string, string>  = { work:'Trabalhando', study:'Estudando', sleep:'Dormindo', shop:'Comprando', visit:'Visitando', idle:'Descansando' };

function LeftPanel() {
  const character         = useGameStore(s => s.character);
  const nearbyBuildingId  = useGameStore(s => s.nearbyBuildingId);
  const triggerAction     = useGameStore(s => s.triggerAction);

  if (!character) return null;

  const nearbyBuilding = nearbyBuildingId
    ? BUILDINGS.find(b => b.id === nearbyBuildingId)
    : null;

  const actIcon  = character.currentActivity ? ACTION_ICONS[character.currentActivity]  ?? '?' : null;
  const actLabel = character.currentActivity ? ACTION_LABELS[character.currentActivity] ?? character.currentActivity : null;

  return (
    <div style={{
      width: 264, flexShrink: 0, background: C.panel,
      borderRight: `1px solid ${C.border}`,
      display: 'flex', flexDirection: 'column',
      overflowY: 'auto', overflowX: 'hidden',
    }}>
      {/* Activity */}
      <div className="panel-section">
        <SectionTitle icon="⚡" label="Atividade" />
        {actIcon ? (
          <div style={{
            display: 'flex', alignItems: 'center', gap: 8,
            padding: '8px 10px', background: C.panelDark,
            border: `1px solid ${C.borderAccent}`, borderRadius: 4,
          }}>
            <span style={{ fontSize: 22 }}>{actIcon}</span>
            <div>
              <div style={{ color: C.accentLight, fontWeight: 600, fontSize: 13 }}>{actLabel}</div>
              {character.activityEndsAt && (
                <div style={{ color: C.textDim, fontSize: 10, marginTop: 2 }}>
                  Em andamento
                </div>
              )}
            </div>
          </div>
        ) : (
          <div style={{
            padding: '8px 10px', background: C.panelDark,
            border: `1px solid ${C.border}`, borderRadius: 4,
            color: C.textDim, fontSize: 12, fontStyle: 'italic',
          }}>
            Sem atividade
          </div>
        )}
      </div>

      {/* Nearby building quick actions */}
      {nearbyBuilding && !character.currentActivity && (
        <div className="panel-section">
          <SectionTitle icon="🏠" label={nearbyBuilding.label} />
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            {nearbyBuilding.actions.map(action => (
              <button
                key={action}
                onClick={() => triggerAction({ buildingId: nearbyBuilding.id, action })}
                style={{
                  display: 'flex', alignItems: 'center', gap: 8,
                  padding: '7px 10px', background: C.panelDark,
                  border: `1px solid ${C.green}`, borderRadius: 4,
                  color: C.greenLite, fontSize: 12, fontWeight: 600,
                  transition: 'all 0.15s', textAlign: 'left',
                }}
                onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = '#1a3010'; }}
                onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = C.panelDark; }}
              >
                <span style={{ fontSize: 16 }}>{ACTION_ICONS[action] ?? '?'}</span>
                {ACTION_LABELS[action] ?? action}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Attributes */}
      <div className="panel-section">
        <SectionTitle icon="📊" label="Atributos" />
        <StatBar label="Energia"    value={character.energy}    />
        <StatBar label="Saúde"      value={character.health}     />
        <StatBar label="Felicidade" value={character.happiness}  />
        <StatBar label="Estresse"   value={character.stress}
          color={character.stress > 60 ? '#9a2020' : character.stress > 30 ? '#c07020' : '#4a9a35'} />
      </div>

      {/* Job */}
      <div className="panel-section">
        <SectionTitle icon="💼" label="Emprego" />
        {character.jobTitle ? (
          <div style={{
            padding: '7px 10px', background: C.panelDark,
            border: `1px solid ${C.border}`, borderRadius: 4,
          }}>
            <div style={{ color: C.text, fontWeight: 600, fontSize: 12 }}>{character.jobTitle}</div>
            <div style={{ color: C.textDim, fontSize: 10, marginTop: 2 }}>
              Renda: R$ {character.monthlyIncome.toLocaleString('pt-BR', { minimumFractionDigits: 0 })}/mês
            </div>
          </div>
        ) : (
          <div style={{ color: C.textDim, fontSize: 11, fontStyle: 'italic' }}>Sem emprego</div>
        )}
      </div>

      {/* Controls hint */}
      <div style={{ padding: '10px', marginTop: 'auto', borderTop: `1px solid ${C.border}` }}>
        <div style={{ color: C.textDim, fontSize: 10, lineHeight: 1.8 }}>
          <div>WASD / Setas — mover</div>
          <div>E — interagir</div>
          <div>Click — andar até</div>
        </div>
      </div>
    </div>
  );
}

// ─── Right Panel ─────────────────────────────────────────────────────────────

function RightPanel() {
  const character = useGameStore(s => s.character);

  if (!character) return null;

  const balance = character.monthlyIncome - (character.monthlyExpenses ?? 0);

  return (
    <div style={{
      width: 220, flexShrink: 0, background: C.panel,
      borderLeft: `1px solid ${C.border}`,
      display: 'flex', flexDirection: 'column',
      overflowY: 'auto', overflowX: 'hidden',
    }}>
      {/* Finances */}
      <div className="panel-section">
        <SectionTitle icon="💰" label="Finanças" />
        <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
          <FinRow label="Patrimônio"
            value={`R$ ${character.money.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`}
            color={C.accentLight} />
          <FinRow label="Renda/mês"
            value={`+R$ ${character.monthlyIncome.toLocaleString('pt-BR', { minimumFractionDigits: 0 })}`}
            color={C.greenLite} />
          {(character.monthlyExpenses ?? 0) > 0 && (
            <FinRow label="Despesas/mês"
              value={`-R$ ${(character.monthlyExpenses ?? 0).toLocaleString('pt-BR', { minimumFractionDigits: 0 })}`}
              color="#ff6050" />
          )}
          <FinRow label="Saldo"
            value={`R$ ${balance.toLocaleString('pt-BR', { minimumFractionDigits: 0 })}`}
            color={balance >= 0 ? C.greenLite : '#ff6050'} />
        </div>
      </div>

      {/* Objetivos */}
      <div className="panel-section">
        <SectionTitle icon="🎯" label="Objetivos" />
        <GoalItem icon="🏠" label="Ter casa própria"   done={character.money > 50000} />
        <GoalItem icon="🚗" label="Comprar um carro"   done={character.money > 30000} />
        <GoalItem icon="📚" label="Completar educação" done={(character.studyProgress ?? 0) >= 100} />
        <GoalItem icon="💍" label="Ter família"        done={false} />
      </div>

      {/* Phase */}
      <div className="panel-section">
        <SectionTitle icon="🌱" label="Fase de Vida" />
        <div style={{
          display: 'flex', flexDirection: 'column', gap: 3,
        }}>
          {['childhood', 'adolescence', 'adult', 'senior'].map((p, i) => {
            const labels = ['Infância', 'Adolescência', 'Adulto', 'Idoso'];
            const isCurrent = character.phase === p;
            const isPast = ['childhood', 'adolescence', 'adult', 'senior'].indexOf(character.phase) > i;
            return (
              <div key={p} style={{
                display: 'flex', alignItems: 'center', gap: 6,
                padding: '4px 6px', borderRadius: 3,
                background: isCurrent ? C.panelDark : 'transparent',
                border: isCurrent ? `1px solid ${C.borderAccent}` : '1px solid transparent',
              }}>
                <span style={{ fontSize: 12, opacity: isPast || isCurrent ? 1 : 0.3 }}>
                  {isPast ? '✓' : isCurrent ? '▶' : '○'}
                </span>
                <span style={{
                  fontSize: 11,
                  color: isCurrent ? C.accentLight : isPast ? C.textDim : C.textDark,
                  fontWeight: isCurrent ? 700 : 400,
                }}>
                  {labels[i]}
                </span>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

function FinRow({ label, value, color }: { label: string; value: string; color: string }) {
  return (
    <div style={{
      display: 'flex', justifyContent: 'space-between', alignItems: 'center',
      padding: '4px 8px', background: C.panelDark,
      border: `1px solid ${C.border}`, borderRadius: 3,
      fontSize: 11,
    }}>
      <span style={{ color: C.textDim }}>{label}</span>
      <span style={{ color, fontWeight: 700 }}>{value}</span>
    </div>
  );
}

function GoalItem({ icon, label, done }: { icon: string; label: string; done: boolean }) {
  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 6,
      padding: '4px 2px', fontSize: 11,
      opacity: done ? 1 : 0.6,
    }}>
      <span style={{ fontSize: 13 }}>{icon}</span>
      <span style={{
        color: done ? C.accentLight : C.textDim,
        textDecoration: done ? 'line-through' : 'none',
        flex: 1,
      }}>
        {label}
      </span>
      {done && <span style={{ color: C.accentLight, fontSize: 12 }}>✓</span>}
    </div>
  );
}

// ─── Bottom Nav ──────────────────────────────────────────────────────────────

function BottomNav() {
  const [activeView, setActiveView] = useState('mundo');

  const tabs = [
    { id: 'mundo',    icon: '🗺',  label: 'Mundo' },
    { id: 'trabalho', icon: '⚒',  label: 'Trabalhar', action: true },
    { id: 'estudo',   icon: '📖', label: 'Estudar',   action: true },
    { id: 'dormir',   icon: '💤', label: 'Dormir',    action: true },
    { id: 'lazer',    icon: '🎮', label: 'Lazer',     action: true },
    { id: 'conquistas', icon: '🏆', label: 'Conquistas' },
    { id: 'config',   icon: '⚙',  label: 'Config' },
  ];

  return (
    <div style={{
      height: 68, background: C.panelDark,
      borderTop: `2px solid ${C.borderAccent}`,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      gap: 6, padding: '0 12px', flexShrink: 0,
    }}>
      {tabs.map(t => (
        <button
          key={t.id}
          onClick={() => setActiveView(t.id)}
          className={`nav-btn ${t.action ? 'action-btn' : ''} ${activeView === t.id ? 'active' : ''}`}
        >
          <span className="nav-btn-icon">{t.icon}</span>
          {t.label}
        </button>
      ))}
    </div>
  );
}

// ─── Offline Report ──────────────────────────────────────────────────────────

function OfflineReport({ result, onClose }: { result: OfflineProgressResult; onClose: () => void }) {
  const hours = Math.floor(result.timeElapsedMinutes / 60);
  const mins  = result.timeElapsedMinutes % 60;
  const timeLabel = hours > 0 ? `${hours}h ${mins}min` : `${mins} min`;

  return (
    <div style={{
      position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.75)',
      display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 500,
    }}>
      <div className="wood-card" style={{ width: 360 }}>
        <div className="wood-card-header">
          ⏰ Você esteve fora por {timeLabel}
        </div>
        <div style={{ padding: '16px' }}>
          <div style={{ color: C.textDim, fontSize: 11, marginBottom: 12 }}>
            Enquanto isso, a vida continuou:
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginBottom: 16 }}>
            {result.moneyEarned > 0 && <FinRow label="Renda recebida" value={`+R$ ${result.moneyEarned.toFixed(2)}`} color={C.greenLite} />}
            {result.moneySpent  > 0 && <FinRow label="Despesas"       value={`-R$ ${result.moneySpent.toFixed(2)}`}  color="#ff6050" />}
            {result.events.map((ev, i) => (
              <div key={i} style={{ fontSize: 11, color: C.textDim, borderTop: `1px solid ${C.border}`, paddingTop: 4 }}>
                {ev.description}
              </div>
            ))}
          </div>
          <button
            onClick={onClose}
            style={{
              width: '100%', padding: '10px',
              background: C.green, border: `1px solid ${C.greenLite}`,
              borderRadius: 4, color: '#ffffff',
              fontFamily: 'var(--font-ui)', fontWeight: 700, fontSize: 13,
            }}
          >
            Continuar
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Loading ─────────────────────────────────────────────────────────────────

function GameLoading() {
  return (
    <div style={{
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      height: '100vh', background: C.bg,
      flexDirection: 'column', gap: 16,
    }}>
      <div style={{ fontFamily: 'var(--font-pixel)', fontSize: 24, color: C.accentLight }}>
        🌍 Tutorial da Vida
      </div>
      <div style={{ color: C.textDim, fontSize: 13 }}>Carregando o mundo...</div>
      <div style={{
        width: 180, height: 6, background: C.panelDark,
        border: `1px solid ${C.border}`, borderRadius: 3, overflow: 'hidden',
      }}>
        <div style={{
          height: '100%', background: C.accentLight, borderRadius: 3,
          animation: 'loadingBar 1.5s ease-in-out infinite',
        }} />
      </div>
      <style>{`
        @keyframes loadingBar {
          0%   { width: 0%; }
          50%  { width: 70%; }
          100% { width: 100%; }
        }
      `}</style>
    </div>
  );
}

// ─── Main Page ───────────────────────────────────────────────────────────────

export default function GamePage() {
  const router       = useRouter();
  const setCharacter = useGameStore(s => s.setCharacter);
  const setAccessToken = useGameStore(s => s.setAccessToken);
  const setLoaded    = useGameStore(s => s.setLoaded);
  const isLoaded     = useGameStore(s => s.isLoaded);
  const character    = useGameStore(s => s.character);

  const [offline, setOffline] = useState<OfflineProgressResult | null>(null);
  const [error,   setError]   = useState('');

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
        height: '100vh', background: C.bg, color: '#ff6b6b',
        fontFamily: 'monospace', fontSize: 14, flexDirection: 'column', gap: 12,
      }}>
        <div>Erro ao carregar o jogo:</div>
        <div style={{ color: C.textDim }}>{error}</div>
        <button onClick={() => router.replace('/login')} style={{
          marginTop: 8, padding: '8px 20px', background: 'transparent',
          border: `1px solid ${C.border}`, borderRadius: 4, color: C.textDim,
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
    <div style={{
      width: '100vw', height: '100vh',
      display: 'flex', flexDirection: 'column',
      background: C.bg, overflow: 'hidden',
    }}>
      <TopBar />

      <div style={{ flex: 1, display: 'flex', overflow: 'hidden', minHeight: 0 }}>
        <LeftPanel />

        {/* Game viewport */}
        <div style={{
          flex: 1, position: 'relative', overflow: 'hidden',
          borderLeft: `1px solid ${C.border}`,
          borderRight: `1px solid ${C.border}`,
        }}>
          <GameCanvas />

          {/* Viewport label */}
          <div style={{
            position: 'absolute', top: 8, left: 10, zIndex: 10,
            padding: '3px 8px', background: 'rgba(15,8,0,0.75)',
            border: `1px solid ${C.borderAccent}`, borderRadius: 3,
            fontFamily: 'var(--font-pixel)', fontSize: 11, color: C.accentLight,
            pointerEvents: 'none',
          }}>
            Tutorial da Vida
          </div>

          {/* Controls overlay on canvas */}
          <div style={{
            position: 'absolute', bottom: 8, right: 10, zIndex: 10,
            pointerEvents: 'none',
            fontSize: 10, color: 'rgba(200,200,170,0.4)',
            textAlign: 'right', lineHeight: 1.8,
          }}>
            WASD/Setas — mover · E — interagir · Click — andar
          </div>
        </div>

        <RightPanel />
      </div>

      <BottomNav />

      {offline && <OfflineReport result={offline} onClose={() => setOffline(null)} />}
    </div>
  );
}
