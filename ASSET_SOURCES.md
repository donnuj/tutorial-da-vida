# Asset Sources — Tutorial da Vida

Todos os assets usados no projeto. Apenas CC0 / domínio público.

---

## Tiles do Mapa

### Kenney Tiny Town
- **Arquivo no projeto**: `public/assets/tiles/tiny-town.png`
- **Fonte**: https://kenney.nl/assets/tiny-town
- **Licença**: CC0 1.0 Universal (domínio público)
- **Tamanho do tile**: 16×16 px (packed, sem espaço)
- **Grid**: 12 colunas × 11 linhas = 132 frames
- **Uso**: terreno (grama, estrada, calçada, água, árvores), edifícios renderizados via Phaser.Graphics
- **Frames de personagens**: 127–131 (usados nos NPCs)

---

## Personagens

### Player — 32×64 Female Base Sprite (Walking 4 Directions)
- **Arquivo no projeto**: `public/assets/characters/player.png`
- **Fonte**: https://opengameart.org/content/32x64-female-base-sprite-walking-4-directions
- **Autor**: Spring
- **Licença**: CC0 1.0 Universal
- **Formato**: 512×64 px — 16 frames em strip horizontal (32×64 px por frame)
- **Layout de frames**:
  - 0–3: walk_down
  - 4–7: walk_left
  - 8–11: walk_up
  - 12–15: walk_right
- **Uso**: sprite do jogador com walk cycle 4 direções

### NPCs — Kenney Tiny Town Characters
- **Frames**: 127–131 do tileset tiny-town.png
- **Licença**: CC0 (parte do pack Kenney Tiny Town)
- **Tamanho**: 16×16 px exibidos em 2× (32×32 px)
- **Uso**: sprites dos NPCs com animação de bob via tween

---

## Tiles de Interior

### Kenney Roguelike Indoor Pack
- **Arquivo no projeto**: `public/assets/tiles/kenney-indoor.png`
- **Fonte**: https://kenney.nl/assets/roguelike-rpg-pack
- **Licença**: CC0 1.0 Universal (domínio público)
- **Tamanho do tile**: 16×16 px, espaçamento de 1 px entre tiles
- **Grid**: 26 colunas × 18 linhas = 468 frames
- **Uso**: pisos dos interiores (quarto, sala, cozinha, banheiro)
- **Frames chave**: 312 = piso de madeira (linha 12), 208 = pedra/banheiro (linha 8)

---

## Móveis (Cena Interior)

### Crimelike Furniture Pack
- **Arquivos no projeto**: `public/assets/furniture/*.png`
- **Fonte**: https://opengameart.org/content/crimelike-characters
- **Autor**: extradave (OpenGameArt)
- **Licença**: CC0 1.0 Universal
- **Tamanho**: 32×32 px cada (1 tile de jogo)
- **Uso**: móveis top-down no interior da casa do jogador

| Arquivo | Móvel | Cômodo |
|---------|-------|--------|
| `bed_wooden_s.png` | Cama de madeira | Quarto |
| `bath_full_e.png` | Banheira | Banheiro |
| `sofa_down_1.png` | Sofá | Sala |
| `desk1.png` | Escrivaninha | Escritório |
| `oven1.png` | Fogão | Cozinha |
| `counter_wooden_red.png` | Balcão (geladeira placeholder) | Cozinha |
| `hifi.png` | TV/Home Theater | Sala |

---

## Pendências / Próximas Aquisições

| Asset | Fonte Sugerida | Licença | Prioridade |
|-------|----------------|---------|------------|
| Variantes de personagem (criança, idoso) | LPC Generator / OGA | CC-BY-SA | Alta |
| Personagem masculino base | https://opengameart.org | CC0 | Alta |
| Veículos top-down | Kenney Top-Down Shooter | CC0 | Média |
| Interior de edifícios | Kenney RPG Interior | CC0 | Média |
| Animais (cachorro, gato) | OGA / Kenney | CC0 | Baixa |

---

## Repos Avaliados

| Repo | Status | Resultado |
|------|--------|-----------|
| kenney.nl/assets | Baixado e integrado | Tiny Town tiles + personagens NPCs ✓ |
| opengameart.org CC0 chars | Baixado e integrado | Player walk cycle ✓ |
| kenney mini-characters | Avaliado | 3D (FBX/GLB) — não serve para 2D |
| kenney roguelike-characters | Avaliado | Sprite de partes, sem walk cycle |
| LPC Universal Generator | Pendente | CC-BY-SA — walk cycle completo, 64×64 |
| Papyszoo/CC0-Public-Domain-Sprites | Não avaliado | — |
| SpriteCook | Não avaliado | — |

---

## Notas Técnicas

- Tilemap carregado via `scene.load.spritesheet('terrain', ..., { frameWidth: 16, frameHeight: 16 })`
- Player sprite: `scene.load.spritesheet('player', ..., { frameWidth: 32, frameHeight: 64 })`
- NPCs usam frames do tileset terrain via `scene.add.image(0, 0, 'terrain', frameIndex)`
- Animações Phaser registradas uma vez por cena com prefixo `player_`
