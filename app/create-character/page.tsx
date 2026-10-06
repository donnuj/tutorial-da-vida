'use client';

import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { character as characterApi, ApiError } from '@/src/lib/api';

const LINES = [
  { text: '...' , delay: 0 },
  { text: 'Tudo era silêncio.', delay: 1200 },
  { text: 'E então, de repente...', delay: 2800 },
  { text: 'Você nasceu.', delay: 5000, big: true },
  { text: 'Um novo ser chegou ao mundo.', delay: 7000 },
  { text: 'Sem manual.', delay: 8500 },
  { text: 'Sem garantias.', delay: 10000 },
  { text: 'Apenas uma vida pela frente.', delay: 11500 },
  { text: null, delay: 13500 }, // shows input
];

export default function CreateCharacterPage() {
  const router = useRouter();
  const [phase, setPhase] = useState<'narrative' | 'name' | 'creating' | 'born'>('narrative');
  const [visibleLines, setVisibleLines] = useState<typeof LINES>([]);
  const [name, setName] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    // Check auth
    const token = localStorage.getItem('tdv_access_token');
    if (!token) { router.replace('/login'); return; }

    // Reveal narrative lines
    LINES.forEach((line, i) => {
      setTimeout(() => {
        if (line.text === null) {
          setPhase('name');
          setTimeout(() => inputRef.current?.focus(), 100);
        } else {
          setVisibleLines((prev) => [...prev, line]);
        }
      }, line.delay);
    });
  }, [router]);

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim() || loading) return;
    setError('');
    setLoading(true);
    setPhase('creating');

    try {
      const char = await characterApi.create(name.trim());
      localStorage.setItem('tdv_character', JSON.stringify(char));
      setPhase('born');

      setTimeout(() => router.replace('/game'), 3000);
    } catch (err) {
      if (err instanceof ApiError && err.status === 409) {
        router.replace('/game');
        return;
      }
      setError(err instanceof ApiError ? err.message : 'Erro ao criar personagem');
      setPhase('name');
      setLoading(false);
    }
  }

  return (
    <div style={{
      display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
      minHeight: '100vh', background: '#000',
      fontFamily: 'Georgia, serif',
      padding: 40,
    }}>
      {/* Narrative lines */}
      <div style={{
        maxWidth: 520, width: '100%',
        display: 'flex', flexDirection: 'column', gap: 16,
        marginBottom: phase === 'name' || phase === 'creating' || phase === 'born' ? 48 : 0,
      }}>
        {visibleLines.map((line, i) => (
          <p
            key={i}
            style={{
              color: line.big ? '#FFD700' : 'rgba(255,255,255,0.7)',
              fontSize: line.big ? 28 : 16,
              fontWeight: line.big ? 'bold' : 'normal',
              fontStyle: line.big ? 'normal' : 'italic',
              textAlign: 'center',
              lineHeight: 1.6,
              animation: 'fadeIn 1.2s ease forwards',
            }}
          >
            {line.text}
          </p>
        ))}
      </div>

      {/* Name input phase */}
      {phase === 'name' && (
        <div style={{
          maxWidth: 400, width: '100%', textAlign: 'center',
          animation: 'fadeIn 1s ease forwards',
        }}>
          <p style={{
            color: 'rgba(255,255,255,0.5)', fontSize: 13,
            fontStyle: 'italic', marginBottom: 24, letterSpacing: 0.5,
          }}>
            Toda vida começa com um nome.
          </p>

          <form onSubmit={handleCreate} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 16 }}>
            <input
              ref={inputRef}
              type="text"
              placeholder="Nome da criança..."
              value={name}
              onChange={(e) => setName(e.target.value)}
              maxLength={32}
              minLength={2}
              required
              style={{
                background: 'transparent',
                border: 'none',
                borderBottom: '1px solid rgba(255,215,0,0.4)',
                borderRadius: 0,
                padding: '12px 4px',
                color: '#FFD700',
                fontSize: 22,
                fontFamily: 'Georgia, serif',
                textAlign: 'center',
                width: 280,
                outline: 'none',
                letterSpacing: 1,
              }}
            />

            {error && (
              <div style={{ color: '#FF6B6B', fontSize: 12 }}>{error}</div>
            )}

            <button
              type="submit"
              disabled={!name.trim() || name.trim().length < 2}
              style={{
                marginTop: 8,
                background: 'transparent',
                border: '1px solid rgba(255,215,0,0.3)',
                borderRadius: 6,
                color: name.trim().length >= 2 ? '#FFD700' : '#333',
                fontSize: 13,
                fontFamily: 'Georgia, serif',
                padding: '10px 28px',
                letterSpacing: 2,
                transition: 'all 0.3s',
                textTransform: 'uppercase',
              }}
            >
              Nascer
            </button>
          </form>
        </div>
      )}

      {/* Creating phase */}
      {phase === 'creating' && (
        <div style={{
          color: 'rgba(255,255,255,0.4)',
          fontSize: 14, fontStyle: 'italic',
          animation: 'fadeIn 0.5s ease forwards',
        }}>
          Um novo ser chega ao mundo...
        </div>
      )}

      {/* Born phase */}
      {phase === 'born' && (
        <div style={{
          textAlign: 'center',
          animation: 'fadeIn 1s ease forwards',
        }}>
          <p style={{ color: '#FFD700', fontSize: 26, fontWeight: 'bold', marginBottom: 12 }}>
            {name} nasceu.
          </p>
          <p style={{ color: 'rgba(255,255,255,0.4)', fontSize: 13, fontStyle: 'italic' }}>
            O tutorial da vida começa agora.
          </p>
        </div>
      )}

      <style>{`
        @keyframes fadeIn {
          from { opacity: 0; transform: translateY(8px); }
          to { opacity: 1; transform: translateY(0); }
        }
      `}</style>
    </div>
  );
}
