'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { simulation, character as characterApi } from '@/src/lib/api';
import { useGameStore } from '@/src/store/gameStore';

// ─── Types ────────────────────────────────────────────────────────────────────

type SceneType = 'hospital' | 'nursery' | 'street' | 'school' | 'home' | 'teen' | 'departure';

interface LifeEvent {
  age: number;
  text: string;
  sub?: string;
  type: 'narrative' | 'choice';
  scene?: SceneType;
  choices?: Array<{ text: string; traits: Record<string, number> }>;
}

// ─── Events ───────────────────────────────────────────────────────────────────

const EVENTS: LifeEvent[] = [
  { age: 0,    type: 'narrative', scene: 'hospital',  text: 'Você nasce numa família de classe média baixa.', sub: 'São Paulo, Brasil.' },
  { age: 0.6,  type: 'narrative', scene: 'nursery',   text: 'Calor de mãe. Cheiro de casa.' },
  { age: 1,    type: 'narrative', scene: 'nursery',   text: 'Primeiras palavras.', sub: '"Mamãe."' },
  { age: 2,    type: 'narrative', scene: 'nursery',   text: 'Primeiros passos. O chão é enorme.' },
  { age: 3.5,  type: 'narrative', scene: 'street',    text: 'Você brinca na calçada com as crianças do bairro.', sub: 'O verão cheira a asfalto quente.' },
  { age: 5,    type: 'narrative', scene: 'school',    text: 'Pré-escola. Você não quer ir.', sub: 'Mas vai.' },
  { age: 6,    type: 'narrative', scene: 'school',    text: 'Primeiro dia de escola.' },
  { age: 8,    type: 'narrative', scene: 'school',    text: 'Você aprende a ler.', sub: 'Um mundo novo se abre.' },
  { age: 9,    type: 'narrative', scene: 'home',      text: 'A família não tem muito dinheiro.', sub: 'Você começa a perceber isso.' },
  { age: 10,   type: 'narrative', scene: 'home',      text: 'Seu pai trabalha o dia todo. Sua mãe também.' },
  { age: 11,   type: 'narrative', scene: 'home',      text: 'Você descobre que gosta de algumas coisas mais do que outras.' },
  { age: 12,   type: 'narrative', scene: 'teen',      text: 'Adolescência.', sub: 'O mundo não faz mais sentido.' },
  {
    age: 13.5,
    type: 'choice', scene: 'street',
    text: 'Um colega mais velho te oferece dinheiro fácil.',
    sub: 'O que você faz?',
    choices: [
      { text: 'Recusar. Isso não é certo.',    traits: { discipline: 6, reputation: 4 } },
      { text: 'Aceitar. Dinheiro é dinheiro.', traits: { financialKnowledge: 6, stress: 8 } },
    ],
  },
  { age: 14,   type: 'narrative', scene: 'teen',      text: 'Você começa a pensar em quem quer ser.' },
  { age: 15,   type: 'narrative', scene: 'home',      text: 'Seus pais falam em fazer uma viagem.', sub: 'Uma conquista deles.' },
  {
    age: 16,
    type: 'choice', scene: 'teen',
    text: 'Você tem tempo livre. O que faz?',
    choices: [
      { text: 'Estudar mais. O futuro não vem sozinho.', traits: { intelligence: 6, education: 4 } },
      { text: 'Trabalhar meio período. Ajudar em casa.',  traits: { discipline: 6, money: 300 } },
      { text: 'Desenvolver um hobby.',                    traits: { creativity: 8, happiness: 5 } },
    ],
  },
  { age: 17.2, type: 'narrative', scene: 'home',      text: 'A viagem está marcada.', sub: 'Você fica em casa.' },
  { age: 17.7, type: 'narrative', scene: 'departure', text: 'Eles partem.' },
];

// ─── Speed ────────────────────────────────────────────────────────────────────

function msPerYear(age: number): number {
  if (age < 2)  return 3_500;
  if (age < 12) return 5_500;
  return 8_000;
}

// ─── Scene illustrations (SVG) ────────────────────────────────────────────────

function SceneHospital() {
  return (
    <svg viewBox="0 0 800 500" style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', opacity: 0.35 }} preserveAspectRatio="xMidYMid slice">
      <defs>
        <radialGradient id="lampGlow" cx="50%" cy="60%" r="55%">
          <stop offset="0%" stopColor="#fff8e0" stopOpacity="0.45"/>
          <stop offset="100%" stopColor="#0a1428" stopOpacity="0"/>
        </radialGradient>
      </defs>
      <rect width="800" height="500" fill="#0a1428"/>
      {/* Ceiling light */}
      <rect x="340" y="0" width="120" height="8" rx="2" fill="#fffce8"/>
      <ellipse cx="400" cy="40" rx="90" ry="30" fill="#fffce8" opacity="0.12"/>
      <rect fill="url(#lampGlow)" width="800" height="500"/>
      {/* Hospital walls */}
      <rect x="80" y="60" width="640" height="380" rx="4" fill="#10203a" stroke="#1e3560" strokeWidth="2"/>
      {/* Window */}
      <rect x="580" y="100" width="100" height="140" rx="3" fill="#0d2240" stroke="#2a5080" strokeWidth="2"/>
      <line x1="630" y1="100" x2="630" y2="240" stroke="#2a5080" strokeWidth="1"/>
      <line x1="580" y1="170" x2="680" y2="170" stroke="#2a5080" strokeWidth="1"/>
      <ellipse cx="630" cy="130" rx="18" ry="18" fill="#f0e8c0" opacity="0.25"/>
      {/* Crib */}
      <rect x="270" y="260" width="260" height="160" rx="8" fill="none" stroke="#2a4870" strokeWidth="3"/>
      <rect x="280" y="260" width="12" height="160" rx="2" fill="#1e3a60"/>
      <rect x="310" y="260" width="10" height="160" rx="2" fill="#1e3a60"/>
      <rect x="340" y="260" width="10" height="160" rx="2" fill="#1e3a60"/>
      <rect x="370" y="260" width="10" height="160" rx="2" fill="#1e3a60"/>
      <rect x="400" y="260" width="10" height="160" rx="2" fill="#1e3a60"/>
      <rect x="430" y="260" width="10" height="160" rx="2" fill="#1e3a60"/>
      <rect x="460" y="260" width="10" height="160" rx="2" fill="#1e3a60"/>
      <rect x="490" y="260" width="10" height="160" rx="2" fill="#1e3a60"/>
      {/* Blanket */}
      <rect x="285" y="350" width="230" height="65" rx="6" fill="#1a3a5e"/>
      {/* Baby */}
      <ellipse cx="400" cy="330" rx="28" ry="24" fill="#c8956c"/>
    </svg>
  );
}

function SceneNursery() {
  return (
    <svg viewBox="0 0 800 500" style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', opacity: 0.35 }} preserveAspectRatio="xMidYMid slice">
      <defs>
        <radialGradient id="warmGlow" cx="25%" cy="35%" r="40%">
          <stop offset="0%" stopColor="#ffcc70" stopOpacity="0.4"/>
          <stop offset="100%" stopColor="#0a0810" stopOpacity="0"/>
        </radialGradient>
      </defs>
      <rect width="800" height="500" fill="#0a0810"/>
      <rect fill="url(#warmGlow)" width="800" height="500"/>
      {/* Lamp */}
      <rect x="100" y="80" width="16" height="120" rx="2" fill="#8a6a40"/>
      <ellipse cx="108" cy="80" rx="50" ry="24" fill="#e8c060"/>
      <ellipse cx="108" cy="80" rx="50" ry="24" fill="#ffee90" opacity="0.5"/>
      {/* Stars on wall */}
      {[
        [600, 80], [650, 130], [580, 160], [700, 90], [560, 200],
        [720, 170], [640, 55], [530, 120],
      ].map(([x, y], i) => (
        <circle key={i} cx={x} cy={y} r="2" fill="#fffce0" opacity={0.4 + Math.random() * 0.4}/>
      ))}
      {/* Moon */}
      <circle cx="660" cy="100" r="36" fill="#f0e8a0" opacity="0.2"/>
      <circle cx="676" cy="90" r="30" fill="#0a0810" opacity="0.7"/>
      {/* Crib */}
      <rect x="290" y="290" width="220" height="170" rx="6" fill="none" stroke="#5a3a20" strokeWidth="3"/>
      <rect x="298" y="292" width="10" height="168" rx="2" fill="#4a2e16"/>
      <rect x="324" y="292" width="8" height="168" rx="2" fill="#4a2e16"/>
      <rect x="350" y="292" width="8" height="168" rx="2" fill="#4a2e16"/>
      <rect x="376" y="292" width="8" height="168" rx="2" fill="#4a2e16"/>
      <rect x="402" y="292" width="8" height="168" rx="2" fill="#4a2e16"/>
      <rect x="428" y="292" width="8" height="168" rx="2" fill="#4a2e16"/>
      <rect x="454" y="292" width="8" height="168" rx="2" fill="#4a2e16"/>
      {/* Baby */}
      <ellipse cx="400" cy="360" rx="30" ry="26" fill="#c8906a"/>
      <rect x="350" y="380" width="100" height="60" rx="8" fill="#3a5888"/>
    </svg>
  );
}

function SceneStreet() {
  return (
    <svg viewBox="0 0 800 500" style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', opacity: 0.3 }} preserveAspectRatio="xMidYMid slice">
      <defs>
        <linearGradient id="sky" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#87CEEB"/>
          <stop offset="100%" stopColor="#d0eeff"/>
        </linearGradient>
      </defs>
      <rect width="800" height="500" fill="url(#sky)"/>
      {/* Sun */}
      <circle cx="680" cy="80" r="50" fill="#FFD700" opacity="0.7"/>
      {/* Ground */}
      <rect x="0" y="340" width="800" height="160" fill="#5a8a4f"/>
      {/* Sidewalk */}
      <rect x="0" y="330" width="800" height="30" fill="#b0a090"/>
      {/* Road */}
      <rect x="0" y="360" width="800" height="140" fill="#666070"/>
      <rect x="0" y="420" width="800" height="8" fill="#ffff00" opacity="0.4"/>
      {/* House 1 */}
      <rect x="80" y="180" width="160" height="155" fill="#e8c88a"/>
      <polygon points="80,180 160,100 240,180" fill="#c0392b"/>
      <rect x="140" y="250" width="40" height="85" fill="#8a6040"/>
      <rect x="100" y="210" width="44" height="40" rx="2" fill="#aad4f0"/>
      <rect x="180" y="210" width="44" height="40" rx="2" fill="#aad4f0"/>
      {/* House 2 */}
      <rect x="560" y="200" width="180" height="140" fill="#d5e8c0"/>
      <polygon points="560,200 650,120 740,200" fill="#2980b9"/>
      <rect x="625" y="255" width="50" height="85" fill="#6a4020"/>
      <rect x="575" y="225" width="50" height="44" rx="2" fill="#aad4f0"/>
      <rect x="660" y="225" width="50" height="44" rx="2" fill="#aad4f0"/>
      {/* Tree */}
      <rect x="390" y="280" width="10" height="60" fill="#5a3a10"/>
      <circle cx="395" cy="250" r="50" fill="#3a7a3a"/>
      <circle cx="365" cy="270" r="30" fill="#2d6a2d"/>
      <circle cx="420" cy="265" r="28" fill="#458a45"/>
    </svg>
  );
}

function SceneSchool() {
  return (
    <svg viewBox="0 0 800 500" style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', opacity: 0.3 }} preserveAspectRatio="xMidYMid slice">
      <defs>
        <linearGradient id="hallway" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#d4e8d4"/>
          <stop offset="100%" stopColor="#a8c8a8"/>
        </linearGradient>
      </defs>
      <rect width="800" height="500" fill="url(#hallway)"/>
      {/* Floor */}
      <rect x="0" y="380" width="800" height="120" fill="#c8b890"/>
      {/* Tiles on floor */}
      {Array.from({length: 8}).map((_, i) => (
        <rect key={i} x={i*100} y="380" width="100" height="120" fill="none" stroke="#b8a880" strokeWidth="1"/>
      ))}
      {/* Lockers */}
      {Array.from({length: 6}).map((_, i) => (
        <g key={i}>
          <rect x={60 + i*110} y="120" width="80" height="260" rx="2" fill="#4a8a4a" stroke="#3a7a3a" strokeWidth="2"/>
          <circle cx={100 + i*110} cy="260" r="6" fill="#d4a020"/>
        </g>
      ))}
      {/* Ceiling light strips */}
      <rect x="100" y="40" width="200" height="10" rx="3" fill="#fffce0" opacity="0.8"/>
      <rect x="490" y="40" width="200" height="10" rx="3" fill="#fffce0" opacity="0.8"/>
      {/* Board at end */}
      <rect x="300" y="140" width="200" height="130" rx="4" fill="#1a6a2a" stroke="#0a5a1a" strokeWidth="3"/>
      <rect x="320" y="158" width="160" height="96" fill="#1e7a30" opacity="0.5"/>
    </svg>
  );
}

function SceneHome() {
  return (
    <svg viewBox="0 0 800 500" style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', opacity: 0.3 }} preserveAspectRatio="xMidYMid slice">
      <rect width="800" height="500" fill="#14100c"/>
      {/* Warm light from lamp */}
      <defs>
        <radialGradient id="homeGlow" cx="70%" cy="40%" r="45%">
          <stop offset="0%" stopColor="#ff9a30" stopOpacity="0.3"/>
          <stop offset="100%" stopColor="#14100c" stopOpacity="0"/>
        </radialGradient>
      </defs>
      <rect fill="url(#homeGlow)" width="800" height="500"/>
      {/* Wall */}
      <rect x="60" y="60" width="680" height="380" fill="#1e1410" stroke="#2a1c14" strokeWidth="2"/>
      {/* Floor */}
      <rect x="60" y="360" width="680" height="80" fill="#2a1e14"/>
      {/* Table */}
      <rect x="200" y="300" width="300" height="12" rx="3" fill="#4a2e14"/>
      <rect x="220" y="312" width="14" height="60" fill="#3a2010"/>
      <rect x="466" y="312" width="14" height="60" fill="#3a2010"/>
      {/* Chairs */}
      <rect x="160" y="310" width="60" height="10" rx="2" fill="#3a2010"/>
      <rect x="480" y="310" width="60" height="10" rx="2" fill="#3a2010"/>
      {/* Window with night outside */}
      <rect x="550" y="100" width="150" height="180" rx="4" fill="#0a1828" stroke="#3a2010" strokeWidth="4"/>
      <line x1="625" y1="100" x2="625" y2="280" stroke="#3a2010" strokeWidth="2"/>
      <line x1="550" y1="190" x2="700" y2="190" stroke="#3a2010" strokeWidth="2"/>
      <circle cx="590" cy="140" r="12" fill="#f0e8a0" opacity="0.2"/>
      <circle cx="650" cy="230" r="7" fill="#f0f0f0" opacity="0.15"/>
      {/* TV glow */}
      <rect x="100" y="160" width="220" height="150" rx="6" fill="#0d2a3a" stroke="#1a3a50" strokeWidth="3"/>
      <rect x="110" y="170" width="200" height="130" rx="3" fill="#0a2234" opacity="0.8"/>
      <rect x="110" y="170" width="200" height="130" rx="3" fill="#1a6aaa" opacity="0.1"/>
    </svg>
  );
}

function SceneTeen() {
  return (
    <svg viewBox="0 0 800 500" style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', opacity: 0.3 }} preserveAspectRatio="xMidYMid slice">
      <defs>
        <linearGradient id="dusk" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#1a0a2e"/>
          <stop offset="50%" stopColor="#3a1a4e"/>
          <stop offset="100%" stopColor="#0a1428"/>
        </linearGradient>
      </defs>
      <rect width="800" height="500" fill="url(#dusk)"/>
      {/* City silhouettes */}
      <rect x="0"   y="220" width="80"  height="280" fill="#0a0a14"/>
      <rect x="70"  y="280" width="60"  height="220" fill="#0a0a14"/>
      <rect x="120" y="190" width="100" height="310" fill="#0a0a14"/>
      <rect x="210" y="240" width="70"  height="260" fill="#0a0a14"/>
      <rect x="270" y="200" width="120" height="300" fill="#0a0a14"/>
      <rect x="500" y="210" width="90"  height="290" fill="#0a0a14"/>
      <rect x="580" y="170" width="110" height="330" fill="#0a0a14"/>
      <rect x="680" y="230" width="80"  height="270" fill="#0a0a14"/>
      <rect x="740" y="200" width="60"  height="300" fill="#0a0a14"/>
      {/* Windows in buildings */}
      {[[130,210],[155,210],[130,240],[155,240],[285,215],[310,215],[550,230],[550,260],[600,190]].map(([x,y],i) => (
        <rect key={i} x={x} y={y} width="12" height="10" fill="#ffee80" opacity="0.4"/>
      ))}
      {/* Street */}
      <rect x="0" y="390" width="800" height="110" fill="#0d0d1a"/>
      {/* Street lights */}
      <rect x="340" y="280" width="4" height="110" fill="#3a3a50"/>
      <ellipse cx="342" cy="282" rx="30" ry="8" fill="#ffee80" opacity="0.15"/>
      <rect x="600" y="300" width="4" height="90" fill="#3a3a50"/>
      <ellipse cx="602" cy="302" rx="26" ry="7" fill="#ffee80" opacity="0.12"/>
      {/* Moon */}
      <circle cx="680" cy="70" r="40" fill="#f0e8c0" opacity="0.18"/>
      <circle cx="695" cy="60" r="34" fill="#1a0a2e" opacity="0.8"/>
    </svg>
  );
}

function SceneDeparture() {
  return (
    <svg viewBox="0 0 800 500" style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', opacity: 0.45 }} preserveAspectRatio="xMidYMid slice">
      <defs>
        <linearGradient id="depSky" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#060a1e"/>
          <stop offset="60%" stopColor="#1a2040"/>
          <stop offset="100%" stopColor="#0a0a10"/>
        </linearGradient>
        <radialGradient id="DepGlow" cx="50%" cy="70%" r="50%">
          <stop offset="0%" stopColor="#ff6020" stopOpacity="0.2"/>
          <stop offset="100%" stopColor="#060a1e" stopOpacity="0"/>
        </radialGradient>
      </defs>
      <rect width="800" height="500" fill="url(#depSky)"/>
      <rect fill="url(#DepGlow)" width="800" height="500"/>
      {/* Airport runway */}
      <rect x="0" y="380" width="800" height="120" fill="#0a0a14"/>
      <rect x="0" y="378" width="800" height="8" fill="#1a2a4a"/>
      {/* Runway lights */}
      {Array.from({length: 16}).map((_, i) => (
        <circle key={i} cx={50 + i*47} cy="384" r="3" fill="#ffcc00" opacity="0.6"/>
      ))}
      {/* Plane silhouette taking off */}
      <g transform="translate(480, 200) rotate(-12)">
        <ellipse cx="0" cy="0" rx="80" ry="14" fill="#1a2040"/>
        <ellipse cx="0" cy="0" rx="80" ry="14" fill="#2a3060" opacity="0.6"/>
        {/* Wings */}
        <polygon points="10,-14 -30,30 -60,30 -20,-14" fill="#151830"/>
        <polygon points="10,14 -30,-30 -60,-30 -20,14" fill="#151830"/>
        {/* Tail */}
        <polygon points="80,-14 60,-40 55,-14" fill="#151830"/>
        {/* Windows */}
        <ellipse cx="-10" cy="-4" rx="5" ry="3" fill="#ffee80" opacity="0.5"/>
        <ellipse cx="10" cy="-4" rx="5" ry="3" fill="#ffee80" opacity="0.4"/>
        <ellipse cx="30" cy="-4" rx="5" ry="3" fill="#ffee80" opacity="0.35"/>
      </g>
      {/* Trail */}
      <line x1="410" y1="210" x2="200" y2="330" stroke="#ffffff" strokeWidth="1" opacity="0.08"/>
      {/* Stars */}
      {[[100,60],[200,30],[350,80],[500,40],[600,70],[720,50],[150,110],[650,100]].map(([x,y],i) => (
        <circle key={i} cx={x} cy={y} r={1+Math.random()} fill="#fff" opacity={0.2+Math.random()*0.4}/>
      ))}
    </svg>
  );
}

const SCENE_MAP: Record<SceneType, () => JSX.Element> = {
  hospital:  SceneHospital,
  nursery:   SceneNursery,
  street:    SceneStreet,
  school:    SceneSchool,
  home:      SceneHome,
  teen:      SceneTeen,
  departure: SceneDeparture,
};

function PhaseBackground({ scene }: { scene?: SceneType }) {
  if (!scene) return null;
  const Comp = SCENE_MAP[scene];
  return Comp ? <Comp /> : null;
}

// ─── Main component ────────────────────────────────────────────────────────────

type Phase = 'running' | 'choice' | 'rupture';

export function LifeNarrative() {
  const character    = useGameStore(s => s.character);
  const setCharacter = useGameStore(s => s.setCharacter);

  const [ageYears,    setAgeYears]    = useState(0);
  const [phase,       setPhase]       = useState<Phase>('running');
  const [activeEvent, setActiveEvent] = useState<LifeEvent | null>(EVENTS[0]);
  const [choiceEvent, setChoiceEvent] = useState<LifeEvent | null>(null);
  const [traitDeltas, setTraitDeltas] = useState<Record<string, number>>({});
  const [ruptureStep, setRuptureStep] = useState(0);
  const [completing,  setCompleting]  = useState(false);

  const ageRef    = useRef(0);
  const pausedRef = useRef(false);
  const firedRef  = useRef<Set<number>>(new Set());
  const rafRef    = useRef<number>(0);
  const lastTRef  = useRef<number>(0);

  const skipToRupture = useCallback(() => {
    cancelAnimationFrame(rafRef.current);
    ageRef.current = 18;
    setAgeYears(18);
    setPhase('rupture');
  }, []);

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

      if (ageRef.current >= 18) { setPhase('rupture'); return; }

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
    return () => { cancelAnimationFrame(rafRef.current); lastTRef.current = 0; };
  }, [phase]);

  const handleChoice = useCallback((choice: { text: string; traits: Record<string, number> }) => {
    setTraitDeltas(prev => {
      const next = { ...prev };
      for (const [k, v] of Object.entries(choice.traits)) next[k] = (next[k] ?? 0) + v;
      return next;
    });
    setChoiceEvent(null);
    setPhase('running');
  }, []);

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
    } catch { setCompleting(false); }
  }, [completing, traitDeltas, setCharacter]);

  const name = character?.name ?? 'Você';
  const ageLabel = (() => {
    const y = Math.floor(ageYears);
    if (y < 1) return 'recém-nascido';
    return `${y} ano${y !== 1 ? 's' : ''}`;
  })();

  if (phase === 'choice' && choiceEvent) {
    return <ChoiceScreen event={choiceEvent} name={name} onChoice={handleChoice} onSkip={skipToRupture} />;
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
      width: '100vw', height: '100vh',
      background: ageYears >= 12 ? '#060710' : ageYears >= 2 ? '#060a0d' : '#040810',
      display: 'flex', flexDirection: 'column',
      alignItems: 'center', justifyContent: 'center',
      fontFamily: 'Georgia, serif',
      transition: 'background 4s ease',
      position: 'relative', overflow: 'hidden',
    }}>
      {/* Scene illustration */}
      <PhaseBackground scene={activeEvent?.scene} />

      {/* Overlay gradient to blend illustration with dark bg */}
      <div style={{
        position: 'absolute', inset: 0, pointerEvents: 'none',
        background: 'radial-gradient(ellipse at center, transparent 30%, rgba(0,0,0,0.6) 100%)',
      }} />

      {/* Skip button */}
      <button
        onClick={skipToRupture}
        style={{
          position: 'fixed', top: 24, right: 24, zIndex: 100,
          background: 'rgba(0,0,0,0.5)',
          border: '1px solid rgba(255,255,255,0.15)',
          borderRadius: 6, padding: '7px 16px',
          color: 'rgba(255,255,255,0.4)', fontFamily: 'monospace',
          fontSize: 11, cursor: 'pointer', letterSpacing: 1,
          transition: 'all 0.2s',
        }}
        onMouseEnter={e => { (e.target as HTMLElement).style.color = 'rgba(255,255,255,0.8)'; (e.target as HTMLElement).style.borderColor = 'rgba(255,255,255,0.4)'; }}
        onMouseLeave={e => { (e.target as HTMLElement).style.color = 'rgba(255,255,255,0.4)'; (e.target as HTMLElement).style.borderColor = 'rgba(255,255,255,0.15)'; }}
      >
        Pular infância →
      </button>

      {/* Event text */}
      {activeEvent && (
        <div
          key={activeEvent.age}
          style={{
            textAlign: 'center', maxWidth: 520, padding: '0 32px',
            animation: 'narrativeFade 1.2s ease forwards',
            position: 'relative', zIndex: 10,
          }}
        >
          <p style={{
            color: 'rgba(255,255,255,0.9)', fontSize: 22,
            lineHeight: 1.7, fontWeight: 400, marginBottom: 10,
            letterSpacing: 0.2, textShadow: '0 2px 20px rgba(0,0,0,0.8)',
          }}>
            {activeEvent.text}
          </p>
          {activeEvent.sub && (
            <p style={{
              color: 'rgba(255,255,255,0.4)', fontSize: 14,
              fontStyle: 'italic', letterSpacing: 0.5,
            }}>
              {activeEvent.sub}
            </p>
          )}
        </div>
      )}

      {/* Age progress */}
      <div style={{
        position: 'fixed', bottom: 40, zIndex: 10,
        display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10,
      }}>
        <div style={{
          width: 220, height: 2,
          background: 'rgba(255,255,255,0.06)', borderRadius: 1, overflow: 'hidden',
        }}>
          <div style={{
            height: '100%',
            width: `${(ageYears / 18) * 100}%`,
            background: 'rgba(255,215,0,0.5)',
            transition: 'width 0.8s linear',
          }} />
        </div>
        <p style={{
          color: 'rgba(255,255,255,0.2)', fontSize: 10,
          fontFamily: 'monospace', letterSpacing: 3, textTransform: 'uppercase',
        }}>
          {name} · {ageLabel}
        </p>
      </div>

      <style>{`
        @keyframes narrativeFade {
          0%  { opacity: 0; transform: translateY(12px); }
          20% { opacity: 1; transform: translateY(0); }
          80% { opacity: 1; }
          100%{ opacity: 0.9; }
        }
      `}</style>
    </div>
  );
}

// ─── Choice screen ─────────────────────────────────────────────────────────────

function ChoiceScreen({ event, name, onChoice, onSkip }: {
  event: LifeEvent;
  name: string;
  onChoice: (c: { text: string; traits: Record<string, number> }) => void;
  onSkip: () => void;
}) {
  const [chosen, setChosen] = useState<number | null>(null);

  const pick = (i: number) => {
    if (chosen !== null || !event.choices) return;
    setChosen(i);
    setTimeout(() => onChoice(event.choices![i]), 700);
  };

  return (
    <div style={{
      width: '100vw', height: '100vh', background: '#06060e',
      display: 'flex', flexDirection: 'column',
      alignItems: 'center', justifyContent: 'center',
      fontFamily: 'Georgia, serif', padding: 32, position: 'relative',
    }}>
      <PhaseBackground scene={event.scene} />

      <button
        onClick={onSkip}
        style={{
          position: 'fixed', top: 24, right: 24, zIndex: 100,
          background: 'rgba(0,0,0,0.5)',
          border: '1px solid rgba(255,255,255,0.15)',
          borderRadius: 6, padding: '7px 16px',
          color: 'rgba(255,255,255,0.4)', fontFamily: 'monospace',
          fontSize: 11, cursor: 'pointer',
        }}
      >
        Pular infância →
      </button>

      <div style={{
        maxWidth: 480, width: '100%', position: 'relative', zIndex: 10,
        animation: 'choiceFade 0.8s ease forwards',
      }}>
        <p style={{
          color: 'rgba(255,215,0,0.5)', fontSize: 10, fontFamily: 'monospace',
          letterSpacing: 4, textTransform: 'uppercase', textAlign: 'center', marginBottom: 28,
        }}>
          {Math.floor(event.age)} anos · {name}
        </p>
        <p style={{
          color: 'rgba(255,255,255,0.9)', fontSize: 20, lineHeight: 1.65,
          textAlign: 'center', marginBottom: event.sub ? 8 : 36,
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
            <button key={i} onClick={() => pick(i)} disabled={chosen !== null} style={{
              background: chosen === i ? 'rgba(255,215,0,0.06)' : 'rgba(0,0,0,0.4)',
              border: `1px solid ${chosen === i ? 'rgba(255,215,0,0.3)' : 'rgba(255,255,255,0.12)'}`,
              borderRadius: 8, padding: '16px 24px',
              color: chosen === i ? 'rgba(255,215,0,0.8)'
                : chosen !== null ? 'rgba(255,255,255,0.2)' : 'rgba(255,255,255,0.8)',
              fontSize: 15, fontFamily: 'Georgia, serif',
              textAlign: 'left', cursor: chosen === null ? 'pointer' : 'default',
              transition: 'all 0.2s', backdropFilter: 'blur(4px)',
            }}>
              {c.text}
            </button>
          ))}
        </div>
      </div>
      <style>{`
        @keyframes choiceFade { from{opacity:0;transform:translateY(16px)} to{opacity:1;transform:translateY(0)} }
      `}</style>
    </div>
  );
}

// ─── Rupture screen ────────────────────────────────────────────────────────────

const RUPTURE_STEPS = [
  ({ name: _ }: { name: string }) => (
    <div style={{ textAlign: 'center', maxWidth: 440 }}>
      <p style={{ color: 'rgba(200,40,40,0.7)', fontSize: 9, fontFamily: 'monospace', letterSpacing: 5, marginBottom: 20 }}>
        ÚLTIMO MOMENTO
      </p>
      <div style={{ width: 40, height: 1, background: 'rgba(200,40,40,0.3)', margin: '0 auto 22px' }} />
      <p style={{ color: 'rgba(255,255,255,0.85)', fontSize: 21, lineHeight: 1.65, marginBottom: 14 }}>
        Queda de avião sobre o Atlântico.
      </p>
      <p style={{ color: 'rgba(255,255,255,0.3)', fontSize: 13, fontStyle: 'italic' }}>
        Voo 1247 · São Paulo → Lisboa
      </p>
    </div>
  ),
  ({ name }: { name: string }) => (
    <div style={{ textAlign: 'center', maxWidth: 440 }}>
      <p style={{ color: 'rgba(255,255,255,0.35)', fontSize: 12, fontFamily: 'monospace', letterSpacing: 2, marginBottom: 22 }}>
        dois passageiros identificados
      </p>
      <p style={{ color: 'rgba(255,255,255,0.8)', fontSize: 20, lineHeight: 1.8 }}>
        Os pais de {name}.
      </p>
    </div>
  ),
  ({ name }: { name: string }) => (
    <div style={{ textAlign: 'center', maxWidth: 440 }}>
      <p style={{ color: 'rgba(255,255,255,0.9)', fontSize: 24, lineHeight: 1.65, marginBottom: 14 }}>
        {name} ficou sozinho.
      </p>
      <p style={{ color: 'rgba(255,255,255,0.3)', fontSize: 16, fontStyle: 'italic' }}>
        18 anos. Sem manual. Sem garantias.
      </p>
    </div>
  ),
  ({ name: _, onAdvance, completing }: { name: string; onAdvance: () => void; completing: boolean }) => (
    <div style={{ textAlign: 'center', maxWidth: 440 }}>
      <p style={{ color: 'rgba(255,215,0,0.6)', fontSize: 10, fontFamily: 'monospace', letterSpacing: 4, marginBottom: 36, textTransform: 'uppercase' }}>
        Mas a vida não para.
      </p>
      <button
        onClick={onAdvance}
        disabled={completing}
        style={{
          background: completing ? 'transparent' : 'rgba(255,215,0,0.08)',
          border: `1px solid rgba(255,215,0,${completing ? 0.1 : 0.35})`,
          borderRadius: 6, padding: '14px 44px',
          color: completing ? 'rgba(255,215,0,0.2)' : '#FFD700',
          fontSize: 15, fontFamily: 'Georgia, serif', letterSpacing: 2,
          cursor: completing ? 'default' : 'pointer', transition: 'all 0.2s',
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
    const delays = [2200, 1800, 1600];
    const t = setTimeout(() => {
      setVisible(false);
      setTimeout(() => { setVisible(true); onAdvance(); }, 600);
    }, delays[step]);
    return () => clearTimeout(t);
  }, [step, onAdvance]);

  const StepContent = RUPTURE_STEPS[step];

  return (
    <div style={{
      width: '100vw', height: '100vh', background: '#08030a',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      fontFamily: 'Georgia, serif', position: 'relative', overflow: 'hidden',
      transition: 'opacity 0.6s ease', opacity: visible ? 1 : 0,
    }}>
      <SceneDeparture />
      <div style={{ position: 'relative', zIndex: 10, animation: 'ruptFade 1.2s ease forwards' }}>
        <StepContent name={name} onAdvance={onAdvance} completing={completing} />
      </div>
      <style>{`@keyframes ruptFade { from{opacity:0}to{opacity:1} }`}</style>
    </div>
  );
}
