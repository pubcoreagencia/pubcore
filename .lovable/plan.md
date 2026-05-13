## Diagnóstico

Acessei o workspace **PUB Records Hub** via cross-project tools. A identidade real é o oposto do que apliquei na rodada anterior:

| | PUB Records (real) | PUB CORE atual (errado) |
|---|---|---|
| Canvas | Preto puro `hsl(0 0% 4%)` | Azul-escuro com aurora |
| Acento | **Vermelho** `hsl(0 72% 51%)` único | Violeta neon + azul elétrico |
| Estilo | Flat, minimal, sem glow | Glassmorphism + grid + glow |
| Cards | `bg-card border rounded-xl` chapado | Sombras + ring + hover-lift |
| Logo | `/logo.png` (identidade própria) | Ícone genérico `Sparkles` |
| Tipografia | Space Grotesk + DM Sans ✓ | Space Grotesk + DM Sans ✓ |
| Sidebar | Agrupada com labels minúsculas uppercase | Item flat sem grupos |

A direção certa é **executiva, sóbria, cinematográfica em escuridão — não neon**.

## Plano

### 1. Tokens de design (`src/styles.css`)
Reescrever a paleta espelhando PUB Records, mantendo o formato `oklch` exigido pelo template:
- `--background` preto profundo, `--card`/`--surface` em cinzas escurecidos refinados
- `--primary` = vermelho PUB (≈ `oklch(0.58 0.22 25)`), `--ring` igual
- `--accent` discreto (cinza elevado), não uma segunda cor neon
- Remover `--gradient-aurora`, `bg-aurora`, `grid-bg`, `ring-glow` (poluição)
- Manter `glass`, `shadow-card`, `shadow-elegant` mais sutis
- Background do `body` sem radial-gradients coloridos (só preto + um leve halo vermelho 5% no topo)

### 2. Logo PUB Records
- Copiar `public/logo.png` do workspace via `cross_project--copy_project_asset` para `public/logo.png` da PUB CORE
- Usar em Sidebar, tela de Login e header onde fizer sentido

### 3. Sidebar (`src/components/Sidebar.tsx`)
- Trocar ícone `Sparkles` pelo `<img src="/logo.png">`
- Agrupar nav em seções com labels uppercase tracking-widest, padrão PUB Records:
  - **Operação**: Dashboard, Bater Ponto (atalho)
  - **Workflow**: Kanban, Checklists, Calendário
  - **Gestão**: CRM, Configurações
- Item ativo: `bg-secondary text-foreground` simples (sem barra lateral neon, sem ponto pulsante) — alinhado ao padrão PUB Records
- Footer do usuário: avatar com inicial em vermelho sólido, sem `glass`

### 4. Shell (`src/routes/app.tsx`)
- Remover `bg-glow` + `grid-bg` do `<main>`; deixar fundo limpo
- Manter apenas um halo vermelho muito sutil no canto superior direito (radial 6% opacidade)

### 5. Componente `StatusBadge` portado
- Criar `src/components/StatusBadge.tsx` usando o mapa de cores por status do PUB Records (Produção/Mixagem/Aprovado/etc.) — útil para Kanban, Checklists e Histórico
- Substituir badges atuais nos módulos onde já existem labels de status

### 6. PontoHeader + cards globais
- Padronizar todos os cards para `bg-card border border-border rounded-xl p-5` (flat, sem `hover-lift`/`ring-glow`)
- Botões primários: vermelho sólido, sem gradiente; hover = `opacity-90` (padrão PUB Records)
- Inputs: `bg-card border border-border focus:ring-1 focus:ring-primary`

### 7. Login (`src/routes/login.tsx`)
- Trocar branding pelo `<img src="/logo.png" className="h-20" />` centralizado
- Remover gradientes neon do botão "Entrar"

### Não tocar
- Toda lógica, hooks, Supabase, realtime, rotas, tipos
- Conteúdo dos módulos (Dashboard data, Kanban DnD, Checklists, etc.)
- `client.ts`, `types.ts`, migrations

## Resultado esperado
PUB CORE com a mesma "respiração" visual da PUB Records: preto sólido, vermelho como única assinatura cromática, tipografia Space Grotesk + DM Sans, cards flat e organização sidebar por grupos — coerência total entre os dois produtos do mesmo grupo.