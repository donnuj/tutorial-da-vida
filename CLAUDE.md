# Tutorial da Vida

RPG/simulador de vida idle 2D.

## Stack

| Camada | Tecnologia |
|--------|-----------|
| Frontend | Next.js 16 + React 19 + TypeScript |
| Game engine | Phaser 3.90 (client-side only, SSR=false) |
| State | Zustand + Immer |
| Styles | Tailwind CSS v4 |
| Backend | NestJS 11 + Prisma + Neon PostgreSQL |
| Auth | JWT + refresh tokens (sem Google OAuth) |
| Deploy frontend | Cloudflare Pages (via GitHub Actions) |
| Deploy backend | Render Node.js (sem Docker) |
| Repo | github.com/donnuj/tutorial-da-vida |

## Arquitetura do jogo

**Servidor = verdade do mundo** (dinheiro, atributos, progresso, eventos)
**Cliente = representação visual** (mapa, sprites, animações, câmera)

Nunca confiar no cliente para calcular valores importantes.

## Módulos backend

- `auth/` — registro, login, JWT, refresh tokens, forgot/reset password
- `character/` — criação, estado, ações, save/load
- `simulation/` — progresso offline, avanço de tempo

## Módulos frontend

- `src/game/scenes/WorldScene.ts` — cena principal Phaser
- `src/game/entities/Player.ts` — player com WASD + click
- `src/game/entities/NPC.ts` — NPCs com rotinas de patrulha
- `src/game/systems/TimeSystem.ts` — relógio do jogo (1s real = 1min jogo)
- `src/game/world/NeighborhoodMap.ts` — mapa 60x50 tiles + prédios + NPCs
- `src/store/gameStore.ts` — estado global (Zustand)
- `src/components/GameCanvas.tsx` — mount do Phaser
- `src/components/GameHUD.tsx` — HUD React sobreposta ao canvas

## Mapa inicial

Bairro pequeno, 60x50 tiles @ 32px cada.
Zonas: Residencial (NW), Comercial (NE), Educacional (SW), Serviços (SE), Parque (centro).

## Assets

MVP usa texturas programáticas geradas via Phaser.Graphics.
Arquitetura permite substituir por sprites reais sem reescrever sistemas.
Pasta: `public/assets/{characters,tiles,buildings,objects,ui,effects}`

## Tempo de jogo

1 segundo real = 1 minuto de jogo
1 hora de jogo = 60 segundos reais
1 dia de jogo = 24 minutos reais
Personagem começa na infância (gameAge=0 minutos)
Adulto aos 18 anos de jogo = 18 * 365 * 24 * 60 game-minutes

## Importante

- Phaser DEVE ser importado com `dynamic(..., { ssr: false })` — não roda no Edge
- `emitDecoratorMetadata: true` obrigatório no tsconfig do backend
- Repositório vai para `donnuj` (nunca impulse-digital)
- Next.js 16: `params` é Promise

<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->
