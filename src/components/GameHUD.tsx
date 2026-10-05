'use client';

import { useGameStore } from '@/src/store/gameStore';
import { BUILDINGS } from '@/src/game/world/NeighborhoodMap';

const ACTION_LABELS: Record<string, string> = {
  work: 'Trabalhar',
  study: 'Estudar',
  sleep: 'Dormir',
  shop: 'Comprar',
  visit: 'Visitar',
  idle: 'Descansar',
};

const ACTION_ICONS: Record<string, string> = {
  work: '⚒', study: '📖', sleep: '💤', shop: '🛒', visit: '👋', idle: '💬',
};

export function GameHUD() {
  const character = useGameStore((s) => s.character);
  const getTimeString = useGameStore((s) => s.getTimeString);
  const getAgeString = useGameStore((s) => s.getAgeString);
  const nearbyBuildingId = useGameStore((s) => s.nearbyBuildingId);
  const triggerAction = useGameStore((s) => s.triggerAction);

  if (!character) return null;

  const nearbyBuilding = nearbyBuildingId
    ? BUILDINGS.find((b) => b.id === nearbyBuildingId)
    : null;

  const barColor = (val: number) => {
    if (val > 60) return '#4CAF50';
    if (val > 30) return '#FF9800';
    return '#F44336';
  };

  return (
    <>
      {/* Top-left: character status */}
      <div style={{
        position: 'fixed', top: 12, left: 12, zIndex: 100,
        background: 'rgba(10,10,20,0.85)',
        border: '1px solid rgba(255,255,255,0.15)',
        borderRadius: 8,
        padding: '10px 14px',
        color: '#fff',
        fontFamily: 'monospace',
        fontSize: 12,
        minWidth: 180,
        backdropFilter: 'blur(4px)',
      }}>
        <div style={{ fontWeight: 'bold', fontSize: 14, marginBottom: 6, color: '#FFD700' }}>
          {character.name}
        </div>
        <div style={{ color: '#aaa', marginBottom: 8 }}>
          {getAgeString()} · {character.phase === 'childhood' ? 'Infância' : character.phase === 'adolescence' ? 'Adolescência' : 'Adulto'}
        </div>

        {/* Energy bar */}
        <StatBar label="Energia" value={character.energy} color={barColor(character.energy)} />
        <StatBar label="Saúde" value={character.health} color={barColor(character.health)} />
        <StatBar label="Felicidade" value={character.happiness} color={barColor(character.happiness)} />

        {character.stress > 40 && (
          <div style={{ color: '#FF6B6B', marginTop: 4, fontSize: 11 }}>
            ⚠ Estresse: {Math.round(character.stress)}%
          </div>
        )}
      </div>

      {/* Top-right: time and money */}
      <div style={{
        position: 'fixed', top: 12, right: 12, zIndex: 100,
        background: 'rgba(10,10,20,0.85)',
        border: '1px solid rgba(255,255,255,0.15)',
        borderRadius: 8,
        padding: '10px 14px',
        color: '#fff',
        fontFamily: 'monospace',
        fontSize: 12,
        textAlign: 'right',
        backdropFilter: 'blur(4px)',
      }}>
        <div style={{ fontSize: 20, fontWeight: 'bold', color: '#4CAF50', marginBottom: 4 }}>
          R$ {character.money.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
        </div>
        <div style={{ fontSize: 18, color: '#87CEEB' }}>
          {getTimeString()}
        </div>
        {character.jobTitle && (
          <div style={{ color: '#aaa', marginTop: 4, fontSize: 11 }}>
            ⚒ {character.jobTitle}
          </div>
        )}
      </div>

      {/* Current activity banner */}
      {character.currentActivity && (
        <div style={{
          position: 'fixed', top: '50%', left: '50%',
          transform: 'translate(-50%, -50%)',
          zIndex: 90,
          background: 'rgba(10,10,20,0.7)',
          border: '1px solid rgba(255,215,0,0.4)',
          borderRadius: 12,
          padding: '8px 20px',
          color: '#FFD700',
          fontFamily: 'monospace',
          fontSize: 13,
          pointerEvents: 'none',
          marginTop: -120,
        }}>
          {ACTION_ICONS[character.currentActivity] ?? '?'} {ACTION_LABELS[character.currentActivity] ?? character.currentActivity}...
        </div>
      )}

      {/* Nearby building action panel */}
      {nearbyBuilding && !character.currentActivity && (
        <div style={{
          position: 'fixed', bottom: 24, left: '50%',
          transform: 'translateX(-50%)',
          zIndex: 100,
          background: 'rgba(10,10,20,0.9)',
          border: '1px solid rgba(255,215,0,0.6)',
          borderRadius: 12,
          padding: '12px 20px',
          color: '#fff',
          fontFamily: 'monospace',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: 8,
          minWidth: 220,
          backdropFilter: 'blur(4px)',
        }}>
          <div style={{ color: '#FFD700', fontWeight: 'bold', fontSize: 13 }}>
            {nearbyBuilding.label}
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            {nearbyBuilding.actions.map((action) => (
              <button
                key={action}
                onClick={() => triggerAction({ buildingId: nearbyBuilding.id, action })}
                style={{
                  background: 'rgba(255,215,0,0.15)',
                  border: '1px solid rgba(255,215,0,0.5)',
                  borderRadius: 6,
                  color: '#FFD700',
                  fontFamily: 'monospace',
                  fontSize: 12,
                  padding: '6px 12px',
                  cursor: 'pointer',
                }}
              >
                {ACTION_ICONS[action] ?? ''} {ACTION_LABELS[action] ?? action}
              </button>
            ))}
          </div>
          <div style={{ color: '#666', fontSize: 10 }}>Pressione [E] para interagir</div>
        </div>
      )}

      {/* Controls hint */}
      <div style={{
        position: 'fixed', bottom: 12, right: 12, zIndex: 100,
        color: 'rgba(255,255,255,0.3)',
        fontFamily: 'monospace',
        fontSize: 10,
        textAlign: 'right',
        lineHeight: 1.6,
      }}>
        WASD/Setas — mover<br />
        E — interagir<br />
        Click — andar até
      </div>
    </>
  );
}

function StatBar({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <div style={{ marginBottom: 5 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 2, fontSize: 10, color: '#aaa' }}>
        <span>{label}</span>
        <span>{Math.round(value)}%</span>
      </div>
      <div style={{ background: 'rgba(255,255,255,0.1)', borderRadius: 3, height: 5, overflow: 'hidden' }}>
        <div style={{
          width: `${Math.max(0, Math.min(100, value))}%`,
          height: '100%',
          background: color,
          borderRadius: 3,
          transition: 'width 0.3s ease',
        }} />
      </div>
    </div>
  );
}
