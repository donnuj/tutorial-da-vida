import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'Tutorial da Vida',
  description: 'RPG/simulador de vida idle 2D. Você nasceu. Agora aprenda a viver.',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-BR">
      <body>{children}</body>
    </html>
  );
}
