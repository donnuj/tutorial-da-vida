'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

const API = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3000/api/v1';

export default function LoginPage() {
  const router = useRouter();
  const [mode, setMode] = useState<'login' | 'register'>('login');
  const [email, setEmail] = useState('');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const endpoint = mode === 'login' ? '/auth/login' : '/auth/register';
      const body = mode === 'login'
        ? { email, password }
        : { email, username, password };

      const res = await fetch(API + endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(body),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.message ?? 'Erro desconhecido');
      }

      const data = await res.json();
      localStorage.setItem('tdv_access_token', data.accessToken);
      localStorage.setItem('tdv_profile', JSON.stringify(data.profile));
      router.replace('/game');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao fazer login');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div style={{
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      height: '100vh', background: '#1a1a2e', fontFamily: 'monospace',
    }}>
      <div style={{
        background: 'rgba(255,255,255,0.05)',
        border: '1px solid rgba(255,215,0,0.3)',
        borderRadius: 12, padding: '40px 48px',
        width: 360, color: '#fff',
      }}>
        <div style={{ textAlign: 'center', marginBottom: 32 }}>
          <div style={{ fontSize: 36, marginBottom: 8 }}>🌍</div>
          <h1 style={{ fontSize: 20, color: '#FFD700', fontWeight: 'bold' }}>
            Tutorial da Vida
          </h1>
          <p style={{ fontSize: 11, color: '#888', marginTop: 6 }}>
            Você nasceu. Agora aprenda a viver.
          </p>
        </div>

        {/* Mode toggle */}
        <div style={{ display: 'flex', marginBottom: 24, borderRadius: 8, overflow: 'hidden', border: '1px solid rgba(255,255,255,0.1)' }}>
          {(['login', 'register'] as const).map((m) => (
            <button
              key={m}
              onClick={() => setMode(m)}
              style={{
                flex: 1, padding: '8px 0', fontSize: 12,
                background: mode === m ? 'rgba(255,215,0,0.15)' : 'transparent',
                border: 'none',
                color: mode === m ? '#FFD700' : '#666',
                fontFamily: 'monospace',
                borderBottom: mode === m ? '2px solid #FFD700' : '2px solid transparent',
              }}
            >
              {m === 'login' ? 'Entrar' : 'Criar Conta'}
            </button>
          ))}
        </div>

        <form onSubmit={submit} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <input
            type="email"
            placeholder="Email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            style={inputStyle}
          />

          {mode === 'register' && (
            <input
              type="text"
              placeholder="Nome de usuário (3-32 caracteres)"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              required
              style={inputStyle}
            />
          )}

          <input
            type="password"
            placeholder="Senha"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            style={inputStyle}
          />

          {error && (
            <div style={{ color: '#FF6B6B', fontSize: 11, textAlign: 'center' }}>
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            style={{
              marginTop: 8,
              padding: '12px 0',
              background: loading ? 'rgba(255,215,0,0.1)' : 'rgba(255,215,0,0.2)',
              border: '1px solid rgba(255,215,0,0.5)',
              borderRadius: 8,
              color: '#FFD700',
              fontSize: 13,
              fontFamily: 'monospace',
              fontWeight: 'bold',
            }}
          >
            {loading ? 'Aguarde...' : mode === 'login' ? 'Entrar' : 'Criar Conta'}
          </button>
        </form>
      </div>
    </div>
  );
}

const inputStyle: React.CSSProperties = {
  background: 'rgba(255,255,255,0.05)',
  border: '1px solid rgba(255,255,255,0.15)',
  borderRadius: 6,
  padding: '10px 12px',
  color: '#fff',
  fontSize: 13,
  fontFamily: 'monospace',
  outline: 'none',
  width: '100%',
};
