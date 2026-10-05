'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { auth, ApiError } from '@/src/lib/api';

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
      const data = mode === 'login'
        ? await auth.login(email, password)
        : await auth.register(email, username, password);

      localStorage.setItem('tdv_access_token', data.accessToken);
      localStorage.setItem('tdv_profile', JSON.stringify(data.profile));

      if (data.profile.hasCharacter) {
        router.replace('/game');
      } else {
        router.replace('/create-character');
      }
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Erro desconhecido');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div style={{
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      height: '100vh', background: '#0d0d1a', fontFamily: 'monospace',
      backgroundImage: 'radial-gradient(ellipse at 50% 120%, #1a1a3a 0%, #0d0d1a 70%)',
    }}>
      <div style={{
        background: 'rgba(255,255,255,0.04)',
        border: '1px solid rgba(255,215,0,0.2)',
        borderRadius: 16, padding: '40px 48px',
        width: 360, color: '#fff',
        boxShadow: '0 0 80px rgba(255,215,0,0.05)',
      }}>
        <div style={{ textAlign: 'center', marginBottom: 32 }}>
          <div style={{ fontSize: 40, marginBottom: 10, filter: 'drop-shadow(0 0 20px rgba(255,215,0,0.4))' }}>🌍</div>
          <h1 style={{ fontSize: 22, color: '#FFD700', fontWeight: 'bold', letterSpacing: 1, marginBottom: 6 }}>
            Tutorial da Vida
          </h1>
          <p style={{ fontSize: 12, color: '#555', fontStyle: 'italic' }}>
            Você nasceu. Agora aprenda a viver.
          </p>
        </div>

        <div style={{ display: 'flex', marginBottom: 24, borderRadius: 8, overflow: 'hidden', border: '1px solid rgba(255,255,255,0.08)' }}>
          {(['login', 'register'] as const).map((m) => (
            <button key={m} onClick={() => setMode(m)} style={{
              flex: 1, padding: '9px 0', fontSize: 12,
              background: mode === m ? 'rgba(255,215,0,0.1)' : 'transparent',
              border: 'none', color: mode === m ? '#FFD700' : '#444',
              fontFamily: 'monospace',
              borderBottom: mode === m ? '2px solid #FFD700' : '2px solid transparent',
              transition: 'all 0.2s',
            }}>
              {m === 'login' ? 'Entrar' : 'Criar Conta'}
            </button>
          ))}
        </div>

        <form onSubmit={submit} style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          <input type="email" placeholder="Email" value={email}
            onChange={(e) => setEmail(e.target.value)} required style={inputStyle} />

          {mode === 'register' && (
            <input type="text" placeholder="Nome de usuário" value={username}
              onChange={(e) => setUsername(e.target.value)} required style={inputStyle} />
          )}

          <input type="password" placeholder="Senha" value={password}
            onChange={(e) => setPassword(e.target.value)} required style={inputStyle} />

          {error && (
            <div style={{ color: '#FF6B6B', fontSize: 11, textAlign: 'center', padding: '4px 0' }}>
              {error}
            </div>
          )}

          <button type="submit" disabled={loading} style={{
            marginTop: 6, padding: '13px 0',
            background: loading ? 'rgba(255,215,0,0.05)' : 'rgba(255,215,0,0.12)',
            border: '1px solid rgba(255,215,0,0.4)',
            borderRadius: 8, color: '#FFD700',
            fontSize: 13, fontFamily: 'monospace', fontWeight: 'bold',
            letterSpacing: 0.5, transition: 'all 0.2s',
          }}>
            {loading ? 'Aguarde...' : mode === 'login' ? 'Entrar' : 'Criar Conta'}
          </button>
        </form>
      </div>
    </div>
  );
}

const inputStyle: React.CSSProperties = {
  background: 'rgba(255,255,255,0.04)',
  border: '1px solid rgba(255,255,255,0.1)',
  borderRadius: 6, padding: '11px 14px',
  color: '#fff', fontSize: 13, fontFamily: 'monospace',
  outline: 'none', width: '100%',
  transition: 'border-color 0.2s',
};
