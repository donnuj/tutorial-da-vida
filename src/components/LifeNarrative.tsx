'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { simulation, character as characterApi } from '@/src/lib/api';
import { useGameStore } from '@/src/store/gameStore';

// ─── Events ───────────────────────────────────────────────────────────────────

interface LifeEvent {
  age: number;
  text: string;
  sub?: string;
  type: 'narrative' | 'choice';
  choices?: Array<{ text: string; traits: Record<string, number> }>;
}

const EVENTS: LifeEvent[] = [
  { age: 0,    type: 'narrative', text: 'Você nasce numa família de classe média baixa.', sub: 'São Paulo, Brasil.' },
  { age: 0.6,  type: 'narrative', text: 'Calor de mãe. Cheiro de casa.' },
  { age: 1,    type: 'narrative', text: 'Primeiras palavras.', sub: '"Mamãe."' },
  { age: 2,    type: 'narrative', text: 'Primeiros passos. O chão é enorme.' },
  { age: 3.5,  type: 'narrative', text: 'Você brinca na calçada com as crianças do bairro.', sub: 'O verão cheira a asfalto quente.' },
  { age: 5,    type: 'narrative', text: 'Pré-escola. Você não quer ir.', sub: 'Mas vai.' },
  { age: 6,    type: 'narrative', text: 'Primeiro dia de escola.' },
  { age: 8,    type: 'narrative', text: 'Você aprende a ler.', sub: 'Um mundo novo se abre.' },
  { age: 9,    type: 'narrative', text: 'A família não tem muito dinheiro.', sub: 'Você começa a perceber isso.' },
  { age: 10,   type: 'narrative', text: 'Seu pai trabalha o dia todo. Sua mãe também.' },
  { age: 11,   type: 'narrative', text: 'Você descobre que gosta de algumas coisas mais do que outras.' },
  { age: 12,   type: 'narrative', text: 'Adolescência.', sub: 'O mundo não faz mais sentido.' },
  {
    age: 13.5,
    type: 'choice',
    text: 'Um colega mais velho te oferece dinheiro fácil.',
    sub: 'O que você faz?',
    choices: [
      { text: 'Recusar. Isso não é certo.', traits: { discipline: 6, reputation: 4 } },
      { text: 'Aceitar. Dinheiro é dinheiro.', traits: { financialKnowledge: 6, stress: 8 } },
    ],
  },
  { age: 14,   type: 'narrative', text: 'Você começa a pensar em quem quer ser.' },
  { age: 15,   type: 'narrative', text: 'Seus pais falam em fazer uma viagem.', sub: 'Uma conquista deles.' },
  {
    age: 16,
    type: 'choice',
    text: 'Você tem tempo livre. O que faz?',
    choices: [
      { text: 'Estudar mais. O futuro não vem sozinho.', traits: { intelligence: 6, education: 4 } },
      { text: 'Trabalhar meio período. Ajudar em casa.', traits: { discipline: 6, money: 300 } },
      { text: 'Desenvolver um hobby.', traits: { creativity: 8, happiness: 5 } },
    ],
  },
  { age: 17.2, type: 'narrative', text: 'A viagem está marcada.', sub: 'Você fica em casa.' },
  { age: 17.7, type: 'narrative', text: 'Eles partem.' },
];

// ─── Time constants ────────────────────────────────────────────────────────────

function msPerYear(age: number): number {
  if (age < 2) return 7_000;
  if (age < 12) return 11_000;
  return 16_000;
}

// ─── Main component ────────────────────────────────────────────────────────────

type Phase = 'running' | 'choice' | 'rupture';

export function LifeNarrative() {
  const character      = useGameStore(s => s.character);
  const setCharacter   = useGameStore(s => s.setCharacter);

  const [ageYears,    setAgeYears]    = useState(0);
  const [phase,       setPhase]       = useState<Phase>('running');
  const [activeEvent, setActiveEvent] = useState<LifeEvent | null>(EVENTS[0]);
  const [choiceEvent, setChoiceEvent] = useState<LifeEvent | null>(null);
  const [traitDeltas, setTraitDeltas] = useState<Record<string, number>>({});
  const [ruptureStep, setRuptureStep] = useState(0);
  const [completing,  setCompleting]  = useState(false);

  const ageRef      = useRef(0);
  const pausedRef   = useRef(false);
  const firedRef    = useRef<Set<number>>(new Set());
  const rafRef      = useRef<number>(0);
  const lastTRef    = useRef<number>(0);

  // ── Age clock ──────────────────────────────────────────────────────────────
  useEffect(() => {
    if (phase !== 'running') return;
    pausedRef.current = false;

    const tick = (now: number) => {
      if (pausedRef.current) return;
      if (lastTRef.current === 0) lastTRef.current = now;

      const dt = now - lastTRef.current;
      lastTRef.current = now;

      ageRef.current = Math.min(18, ageRef.current + dt / msPerYear(ageRef.current));
      setAgeYears(ageRef.current);

      if (ageRef.current >= 18) {
        setPhase('rupture');
        return;
      }

      for (const ev of EVENTS) {
        if (!firedRef.current.has(ev.age) && ageRef.current >= ev.age) {
          firedRef.current.add(ev.age);
          if (ev.type === 'choice') {
            pausedRef.current = true;
            setPhase('choice');
            setChoiceEvent(ev);
            return;
          }
          setActiveEvent(ev);
        }
      }

      rafRef.current = requestAnimationFrame(tick);
    };

    rafRef.current = requestAnimationFrame(tick);
    return () => {
      cancelAnimationFrame(rafRef.current);
      lastTRef.current = 0;
    };
  }, [phase]);

  // ── Choice handler ─────────────────────────────────────────────────────────
  const handleChoice = useCallback((choice: { text: string; traits: Record<string, number> }) => {
    setTraitDeltas(prev => {
      const next = { ...prev };
      for (const [k, v] of Object.entries(choice.traits)) next[k] = (next[k] ?? 0) + v;
      return next;
    });
    setChoiceEvent(null);
    setPhase('running');
  }, []);

  // ── Advance to adult ───────────────────────────────────────────────────────
  const handleComplete = useCallback(async () => {
    if (completing) return;
    setCompleting(true);
    try {
      await simulation.advanceToAdult(traitDeltas);
      const state = await characterApi.getState();
      setCharacter({
        id: state.id, name: state.name, phase: state.phase, gameAge: state.gameAge,
        energy: state.energy, happiness: state.happiness, stress: state.stress,
        health: state.health, money: state.money, monthlyIncome: state.monthlyIncome,
        currentActivity: state.currentActivity, activityEndsAt: state.activityEndsAt,
        locationId: state.locationId, jobTitle: state.jobTitle,
      });
    } catch {
      setCompleting(false);
    }
  }, [completing, traitDeltas, setCharacter]);

  const name     = character?.name ?? 'Você';
  const ageLabel = (() => {
    const y = Math.floor(ageYears);
    if (y < 1) return 'recém-nascido';
    return `${y} ano${y !== 1 ? 's' : ''}`;
  })();

  // ── Background color by age ────────────────────────────────────────────────
  const bg = phase === 'rupture' ? '#0a0303'
    : ageYears >= 12 ? '#060710'
    : ageYears >= 2  ? '#060a0d'
    : '#040810';

  if (phase === 'choice' && choiceEvent) {
    return <ChoiceScreen event={choiceEvent} name={name} onChoice={handleChoice} />;
  }

  if (phase === 'rupture') {
    return (
      <RuptureScreen
        name={name}
        step={ruptureStep}
        onAdvance={() => ruptureStep < 3 ? setRuptureStep(s => s + 1) : handleComplete()}
        completing={completing}
      />
    );
  }

  return (
    <div style={{
      width: '100vw', height: '100vh', background: bg,
      display: 'flex', flexDirection: 'column',
      alignItems: 'center', justifyContent: 'center',
      fontFamily: 'Georgia, serif',
      transition: 'background 4s ease',
      position: 'relative', overflow: 'hidden',
    }}>
      {/* Grain overlay */}
      <div style={{
        position: 'absolute', inset: 0, pointerEvents: 'none',
        backgroundImage: 'url("data:image/svg+xml,%3Csvg viewBox=\'0 0 200 200\' xmlns=\'http://www.w3.org/2000/svg\'%3E%3Cfilter id=\'n\'%3E%3CfeTurbulence type=\'fractalNoise\' baseFrequency=\'0.9\' numOctaves=\'4\' stitchTiles=\'stitch\'/%3E%3C/filter%3E%3Crect width=\'100%25\' height=\'100%25\' filter=\'url(%23n)\' opacity=\'0.04\'/%3E%3C/svg%3E")',
        opacity: 0.6,
      }} />

      {/* Event text */}
      {activeEvent && (
        <div
          key={activeEvent.age}
          style={{
            textAlign: 'center', maxWidth: 500, padding: '0 32px',
            animation: 'narrativeFade 1.4s ease forwards',
          }}
        >
          <p style={{
            color: 'rgba(255,255,255,0.85)', fontSize: 21,
            lineHeight: 1.7, fontWeight: 400, marginBottom: 10,
            letterSpacing: 0.2,
          }}>
            {activeEvent.text}
          </p>
          {activeEvent.sub && (
            <p style={{
              color: 'rgba(255,255,255,0.32)', fontSize: 13,
              fontStyle: 'italic', letterSpacing: 0.5,
            }}>
              {activeEvent.sub}
            </p>
          )}
        </div>
      )}

      {/* Age progress */}
      <div style={{
        position: 'fixed', bottom: 44,
        display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10,
      }}>
        <div style={{
          width: 200, height: 1,
          background: 'rgba(255,255,255,0.06)', borderRadius: 1, overflow: 'hidden',
        }}>
          <div style={{
            height: '100%',
            width: `${(ageYears / 18) * 100}%`,
            background: 'rgba(255,215,0,0.4)',
            transition: 'width 0.8s linear',
          }} />
        </div>
        <p style={{
          color: 'rgba(255,255,255,0.18)', fontSize: 10,
          fontFamily: 'monospace', letterSpacing: 3,
          textTransform: 'uppercase',
        }}>
          {name} · {ageLabel}
        </p>
      </div>

      <style>{`
        @keyframes narrativeFade {
          0%  { opacity: 0; transform: translateY(10px); }
          20% { opacity: 1; transform: translateY(0); }
          80% { opacity: 1; }
          100%{ opacity: 0.85; }
        }
      `}</style>
    </div>
  );
}

// ─── Choice screen ─────────────────────────────────────────────────────────────

function ChoiceScreen({ event, name, onChoice }: {
  event: LifeEvent;
  name: string;
  onChoice: (c: { text: string; traits: Record<string, number> }) => void;
}) {
  const [chosen, setChosen] = useState<number | null>(null);

  const pick = (i: number) => {
    if (chosen !== null || !event.choices) return;
    setChosen(i);
    setTimeout(() => onChoice(event.choices![i]), 900);
  };

  return (
    <div style={{
      width: '100vw', height: '100vh', background: '#06060e',
      display: 'flex', flexDirection: 'column',
      alignItems: 'center', justifyContent: 'center',
      fontFamily: 'Georgia, serif', padding: 32,
    }}>
      <div style={{
        maxWidth: 460, width: '100%',
        animation: 'choiceFade 0.9s ease forwards',
      }}>
        <p style={{
          color: 'rgba(255,215,0,0.5)', fontSize: 10,
          fontFamily: 'monospace', letterSpacing: 4,
          textTransform: 'uppercase', textAlign: 'center',
          marginBottom: 28,
        }}>
          {Math.floor(event.age)} anos · {name}
        </p>

        <p style={{
          color: 'rgba(255,255,255,0.88)', fontSize: 19,
          lineHeight: 1.65, textAlign: 'center', marginBottom: event.sub ? 8 : 36,
        }}>
          {event.text}
        </p>

        {event.sub && (
          <p style={{
            color: 'rgba(255,255,255,0.35)', fontSize: 13,
            fontStyle: 'italic', textAlign: 'center', marginBottom: 36,
          }}>
            {event.sub}
          </p>
        )}

        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {event.choices?.map((c, i) => (
            <button
              key={i}
              onClick={() => pick(i)}
              disabled={chosen !== null}
              style={{
                background: chosen === i ? 'rgba(255,215,0,0.06)' : 'transparent',
                border: `1px solid ${chosen === i ? 'rgba(255,215,0,0.3)' : 'rgba(255,255,255,0.12)'}`,
                borderRadius: 8,
                padding: '15px 22px',
                color: chosen === i
                  ? 'rgba(255,215,0,0.7)'
                  : chosen !== null
                  ? 'rgba(255,255,255,0.2)'
                  : 'rgba(255,255,255,0.72)',
                fontSize: 15, fontFamily: 'Georgia, serif',
                textAlign: 'left', cursor: chosen === null ? 'pointer' : 'default',
                transition: 'all 0.25s',
              }}
            >
              {c.text}
            </button>
          ))}
        </div>
      </div>

      <style>{`
        @keyframes choiceFade {
          from { opacity: 0; transform: translateY(14px); }
          to   { opacity: 1; transform: translateY(0); }
        }
      `}</style>
    </div>
  );
}

// ─── Rupture screen ────────────────────────────────────────────────────────────

const RUPTURE_STEPS = [
  ({ name }: { name: string }) => (
    <div style={{ textAlign: 'center', maxWidth: 420 }}>
      <p style={{ color: 'rgba(220,50,50,0.6)', fontSize: 9, fontFamily: 'monospace', letterSpacing: 5, marginBottom: 20 }}>
        ÚLTIMO MOMENTO
      </p>
      <div style={{ width: 40, height: 1, background: 'rgba(220,50,50,0.25)', margin: '0 auto 22px' }} />
      <p style={{ color: 'rgba(255,255,255,0.82)', fontSize: 20, lineHeight: 1.65, marginBottom: 14 }}>
        Queda de avião sobre o Atlântico.
      </p>
      <p style={{ color: 'rgba(255,255,255,0.3)', fontSize: 13, fontStyle: 'italic' }}>
        Voo 1247 · São Paulo → Lisboa
      </p>
    </div>
  ),
  ({ name }: { name: string }) => (
    <div style={{ textAlign: 'center', maxWidth: 420 }}>
      <p style={{ color: 'rgba(255,255,255,0.4)', fontSize: 13, fontFamily: 'monospace', letterSpacing: 1, marginBottom: 22 }}>
        dois passageiros identificados
      </p>
      <p style={{ color: 'rgba(255,255,255,0.72)', fontSize: 18, lineHeight: 1.8 }}>
        Os pais de {name}.
      </p>
    </div>
  ),
  ({ name }: { name: string }) => (
    <div style={{ textAlign: 'center', maxWidth: 420 }}>
      <p style={{ color: 'rgba(255,255,255,0.85)', fontSize: 22, lineHeight: 1.65, marginBottom: 14 }}>
        {name} ficou sozinho.
      </p>
      <p style={{ color: 'rgba(255,255,255,0.28)', fontSize: 15, fontStyle: 'italic' }}>
        18 anos. Sem manual. Sem garantias.
      </p>
    </div>
  ),
  ({ name, onAdvance, completing }: { name: string; onAdvance: () => void; completing: boolean }) => (
    <div style={{ textAlign: 'center', maxWidth: 420 }}>
      <p style={{ color: 'rgba(255,215,0,0.55)', fontSize: 10, fontFamily: 'monospace', letterSpacing: 4, marginBottom: 36, textTransform: 'uppercase' }}>
        Mas a vida não para.
      </p>
      <button
        onClick={onAdvance}
        disabled={completing}
        style={{
          background: 'transparent',
          border: `1px solid rgba(255,215,0,${completing ? 0.15 : 0.3})`,
          borderRadius: 6, padding: '12px 36px',
          color: completing ? 'rgba(255,215,0,0.25)' : '#FFD700',
          fontSize: 14, fontFamily: 'Georgia, serif',
          letterSpacing: 2, cursor: completing ? 'default' : 'pointer',
          transition: 'all 0.2s',
        }}
      >
        {completing ? 'aguarde...' : 'Começar'}
      </button>
    </div>
  ),
];

function RuptureScreen({ name, step, onAdvance, completing }: {
  name: string; step: number; onAdvance: () => void; completing: boolean;
}) {
  const [visible, setVisible] = useState(true);

  useEffect(() => {
    if (step >= 3) return;
    const delays = [4500, 3500, 3000];
    const t = setTimeout(() => {
      setVisible(false);
      setTimeout(() => { setVisible(true); onAdvance(); }, 700);
    }, delays[step]);
    return () => clearTimeout(t);
  }, [step, onAdvance]);

  const StepContent = RUPTURE_STEPS[step];

  return (
    <div style={{
      width: '100vw', height: '100vh', background: '#09030a',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      fontFamily: 'Georgia, serif',
      transition: 'opacity 0.7s ease',
      opacity: visible ? 1 : 0,
    }}>
      <div style={{ animation: 'ruptFade 1.4s ease forwards' }}>
        <StepContent name={name} onAdvance={onAdvance} completing={completing} />
      </div>
      <style>{`@keyframes ruptFade { from{opacity:0}to{opacity:1} }`}</style>
    </div>
  );
}
