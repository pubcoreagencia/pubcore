# PUB City — Mapa Búzios + Distritos + Interiores

## Escopo
Evoluir `src/routes/app.city.tsx` mantendo o visual isométrico atual. Sem novas tabelas, sem mudar regras existentes. Tudo client-side em cima dos dados já carregados (`stock_companies`, `checklist_tasks`, `ponto_sessions`, `kanban_cards_archive`).

## Mapa inspirado em Búzios

Layout em uma única SVG-world ~3000×2200 navegável por pan/zoom (já existe) + agora também por avatar (teclado/toque).

Elementos do terreno (todos desenhados em SVG, sem assets externos):
- **Praias** em arco no leste/sul: Geribá, Ferradura, João Fernandes — areia (`oklch(0.88 0.06 85)`) + mar gradiente (`oklch(0.55 0.10 220)` → `oklch(0.35 0.12 240)`) com ondas animadas sutis.
- **Marina** no oeste com píer e silhuetas de barcos (Marina Porto Búzios).
- **Morros** ao norte como polígonos isométricos verde-escuro com curvas de nível.
- **Rua das Pedras** = avenida principal diagonal cortando o centro, ladeada por prédios comerciais/gastronômicos.
- **Orla Bardot** = calçadão curvo entre a marina e o centro.
- **Praça Santos Dumont** no coração, hub central de onde partem as ruas dos distritos.
- Ruas em grid isométrico conectando todos os distritos (faixas mais claras sobre o chão).

## Distritos (7) — cada um agrupa empresas relacionadas

| Distrito | Empresas | Localização |
|---|---|---|
| Administrativo | PUB CORE, PUB | Centro (Praça Santos Dumont) |
| Tecnológico | PUB IA, PUB 3D, PUB ADSENSE | Norte (morros — "Vale do Silício de Búzios") |
| Financeiro | PUB CRYPTO, PUB IMÓVEIS | Centro-oeste |
| Entretenimento | PUB RECORDS, PUB FILMS, PUB CASSINO, PUB LANÇAMENTOS | Rua das Pedras (sul) |
| Gastronômico | PUB FOOD | Orla Bardot |
| Industrial | PUB BRICKS, PUB TÊXTIL | Oeste (próximo à marina, zona industrial) |
| Comercial | PUB ECOM, PUB FISHING | Marina/Píer |

Distrito = retângulo isométrico tingido com a cor predominante do grupo + label flutuante. Empresas posicionadas dentro com offset determinístico (hash do nome) para visual orgânico, não grade.

## Avatar caminhável

- Avatar = circle SVG com inicial do usuário (cor primária do tema).
- Controles: **WASD/setas** no desktop, **joystick virtual** no canto inferior esquerdo no mobile/touch.
- Velocidade ~140 px/s em coords de mundo. Movimento livre (sem colisão por enquanto — fora de escopo manter simples).
- Câmera segue avatar suavemente (lerp). Pan/zoom manual continua disponível e desacopla a câmera enquanto o usuário arrasta.
- Quando o avatar fica a <60px de um prédio, mostra prompt "Pressione E / Toque para entrar".

## Entrar/Sair de prédios (sem reload)

- Estado local `interior: Company | null`. Quando definido, renderiza overlay com transição (fade + zoom) sobre o mapa — sem mudar de rota.
- **Interior** = nova vista 2D top-down do andar da empresa:
  - Paredes coloridas com a cor da empresa
  - **Setores operacionais** (cards/zonas) gerados dinamicamente a partir dos dados existentes:
    - Mesa de Tarefas → contagem de `checklist_tasks` ativas, lista os 5 mais recentes
    - Sala do Ponto → produtividade agregada e colaboradores ativos (`ponto_sessions`)
    - Sala de Projetos → `kanban_cards_archive` por empresa
    - Recepção → nome/slug/cor da empresa
  - Avatar continua andando dentro do interior (mesmo controles).
  - Botão "Sair" + tecla Esc voltam ao mapa preservando posição anterior do avatar.
- Painel lateral (Sheet) atual de detalhe continua disponível ao clicar de longe em um prédio, complementar ao interior.

## Mudanças técnicas

**Apenas `src/routes/app.city.tsx`** (arquivo único, ~700 linhas finais):
1. Adicionar `useAvatar()` interno: estado `{x,y, dir}`, loop `requestAnimationFrame`, listeners de teclado, joystick touch.
2. Adicionar `useCamera()`: lerp para seguir avatar quando avatar está em movimento; modo manual quando usuário arrasta.
3. Função `layoutDistricts(companies)` — agrupa por mapa de empresa→distrito, calcula bbox de cada distrito, posiciona prédios dentro.
4. Componente `<Terrain />` — desenha praias, mar, morros, ruas, praça, marina como SVG em camadas.
5. Componente `<DistrictZone />` — retângulo iso tingido + label.
6. Componente `<Avatar />` — círculo + sombra + nome.
7. Componente `<BuildingInterior company />` — overlay com setores; reusa as queries já feitas em `refresh()`.
8. Tecla **E** / botão flutuante entra no prédio mais próximo.

## Performance
- SVG único com `<g>` por camada, sem re-render por frame: a câmera muda só `transform` do container (estilo já em uso).
- Avatar/joystick em divs absolutos sobrepostos, transform via CSS vars, sem React state por frame (usar ref + rAF).

## Fora de escopo (Fase futura)
- Multiplayer realtime, colisão, pathfinding, NPCs, gamificação, XP, áudio ambiente, salvar posição do avatar no banco.

## Arquivos alterados
- `src/routes/app.city.tsx` (reescrita expandida)

Nenhum outro arquivo é tocado. Sem migrações. Sem novas dependências.
