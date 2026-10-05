'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

export default function Home() {
  const router = useRouter();

  useEffect(() => {
    // Check if logged in
    const token = typeof window !== 'undefined'
      ? localStorage.getItem('tdv_access_token')
      : null;

    if (token) {
      router.replace('/game');
    } else {
      router.replace('/login');
    }
  }, [router]);

  return (
    <div style={{
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      height: '100vh', background: '#1a1a2e', color: '#fff',
      fontFamily: 'monospace', fontSize: 14,
    }}>
      Carregando...
    </div>
  );
}
