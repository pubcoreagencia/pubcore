export type Role = "Executivo" | "Marketing" | "Logística/Comercial";

export const COMPANIES = [
  "PUB CORE",
  "PUB IA",
  "PUB 3D",
  "PUB RECORDS",
  "PUB FILMS",
  "PUB IMÓVEIS",
  "PUB CASSINO",
  "PUB FISHING",
  "PUB FOOD",
  "PUB ECOM",
  "PUB LANÇAMENTOS",
  "PUB ADSENSE",
  "PUB CRYPTO",
  "PUB BRICKS",
  "PUB TÊXTIL",
] as const;
export type Company = (typeof COMPANIES)[number];

export const COMPANY_COLORS: Record<string, string> = {
  "PUB CORE": "oklch(0.75 0.15 250)",
  "PUB IA": "oklch(0.72 0.20 290)",
  "PUB 3D": "oklch(0.72 0.18 240)",
  "PUB RECORDS": "oklch(0.74 0.18 30)",
  "PUB FILMS": "oklch(0.72 0.16 200)",
  "PUB IMÓVEIS": "oklch(0.74 0.15 130)",
  "PUB CASSINO": "oklch(0.74 0.18 10)",
  "PUB FISHING": "oklch(0.72 0.16 220)",
  "PUB FOOD": "oklch(0.78 0.17 80)",
  "PUB ECOM": "oklch(0.74 0.16 160)",
  "PUB LANÇAMENTOS": "oklch(0.74 0.18 320)",
  "PUB ADSENSE": "oklch(0.78 0.16 100)",
  "PUB CRYPTO": "oklch(0.78 0.15 75)",
  "PUB BRICKS": "oklch(0.74 0.16 60)",
  "PUB TÊXTIL": "oklch(0.72 0.18 340)",
};

export const DEFAULT_COMPANY_COLOR = "oklch(0.72 0.10 260)";


export type Priority = "Baixa" | "Média" | "Alta" | "Crítica";
export type KanbanColumn = "Backlog" | "Hoje" | "Em andamento" | "Revisão" | "Concluído";

export const KANBAN_COLUMNS: KanbanColumn[] = [
  "Backlog",
  "Hoje",
  "Em andamento",
  "Revisão",
  "Concluído",
];

export interface ChecklistItem {
  id: string;
  text: string;
  done: boolean;
}

export interface KanbanCard {
  id: string;
  title: string;
  priority: Priority;
  assignee: string;
  company: Company;
  column: KanbanColumn;
  checklist: ChecklistItem[];
}

export const INITIAL_CARDS: KanbanCard[] = [
  {
    id: "c1", title: "Render final — Campanha Verão Bricks", priority: "Alta",
    assignee: "Lucas M.", company: "Pub 3D", column: "Em andamento",
    checklist: [
      { id: "1", text: "Modelagem", done: true },
      { id: "2", text: "Texturas", done: true },
      { id: "3", text: "Render 4K", done: false },
    ],
  },
  {
    id: "c2", title: "Treinar modelo de copy IA", priority: "Crítica",
    assignee: "Marina S.", company: "Pub IA", column: "Hoje",
    checklist: [{ id: "1", text: "Dataset pronto", done: true }, { id: "2", text: "Fine-tune", done: false }],
  },
  {
    id: "c3", title: "Roteiro institucional Q2", priority: "Média",
    assignee: "Pedro A.", company: "Pub Films", column: "Revisão",
    checklist: [{ id: "1", text: "Aprovação executivo", done: false }],
  },
  {
    id: "c4", title: "Master final EP Lançamento", priority: "Alta",
    assignee: "Júlia R.", company: "Pub RECORDS", column: "Backlog",
    checklist: [{ id: "1", text: "Mix", done: false }, { id: "2", text: "Master", done: false }],
  },
  {
    id: "c5", title: "Logística entrega cliente VIP", priority: "Crítica",
    assignee: "Rafael T.", company: "Bricks", column: "Hoje",
    checklist: [{ id: "1", text: "Conferência", done: true }, { id: "2", text: "Despacho", done: false }],
  },
  {
    id: "c6", title: "Coleção outono — costura piloto", priority: "Média",
    assignee: "Camila O.", company: "Têxtil", column: "Em andamento",
    checklist: [{ id: "1", text: "Modelagem", done: true }],
  },
  {
    id: "c7", title: "Relatório mensal performance", priority: "Baixa",
    assignee: "Marina S.", company: "Pub IA", column: "Concluído",
    checklist: [{ id: "1", text: "Enviar", done: true }],
  },
  {
    id: "c8", title: "Brief campanha Têxtil verão", priority: "Alta",
    assignee: "Pedro A.", company: "Têxtil", column: "Backlog",
    checklist: [{ id: "1", text: "Reunião kickoff", done: false }],
  },
];

export interface DailyTask {
  id: string;
  text: string;
  category: string;
  company: Company;
  assignee: string;
  dueTime: string; // HH:MM
  priority: Priority;
  recurrence: "Diária";
}

export const DAILY_TASKS: DailyTask[] = [
  // ===== Pub 3D =====
  { id: "p3d-1", text: "Mineração Diária", category: "Mineração", company: "Pub 3D", assignee: "Lucas M.", dueTime: "08:30", priority: "Crítica", recurrence: "Diária" },
  { id: "p3d-2", text: "Catalogação de arquivos e modelos", category: "Catalogação", company: "Pub 3D", assignee: "Lucas M.", dueTime: "10:00", priority: "Alta", recurrence: "Diária" },
  { id: "p3d-3", text: "Revisão das máquinas (impressoras/render farm)", category: "Manutenção", company: "Pub 3D", assignee: "Lucas M.", dueTime: "11:00", priority: "Alta", recurrence: "Diária" },
  { id: "p3d-4", text: "Revisão de estoque de insumos", category: "Estoque", company: "Pub 3D", assignee: "Rafael T.", dueTime: "14:00", priority: "Média", recurrence: "Diária" },
  { id: "p3d-5", text: "Revisão de estoque de peças de reposição", category: "Estoque", company: "Pub 3D", assignee: "Rafael T.", dueTime: "14:30", priority: "Média", recurrence: "Diária" },
  { id: "p3d-6", text: "Ações de marketing diárias", category: "Marketing", company: "Pub 3D", assignee: "Marina S.", dueTime: "15:00", priority: "Média", recurrence: "Diária" },
  { id: "p3d-7", text: "Postagens em redes sociais", category: "Rede Social", company: "Pub 3D", assignee: "Marina S.", dueTime: "16:00", priority: "Alta", recurrence: "Diária" },

  // ===== Pub IA =====
  { id: "pia-1", text: "Desenvolvimento diário de produtos", category: "Desenvolvimento", company: "Pub IA", assignee: "Marina S.", dueTime: "09:00", priority: "Crítica", recurrence: "Diária" },
  { id: "pia-2", text: "Prospecção ativa de clientes", category: "Prospecção", company: "Pub IA", assignee: "Pedro A.", dueTime: "10:30", priority: "Alta", recurrence: "Diária" },
  { id: "pia-3", text: "Prospecção passiva (inbound)", category: "Prospecção", company: "Pub IA", assignee: "Pedro A.", dueTime: "11:30", priority: "Média", recurrence: "Diária" },
  { id: "pia-4", text: "Ações de marketing diárias", category: "Marketing", company: "Pub IA", assignee: "Marina S.", dueTime: "14:00", priority: "Alta", recurrence: "Diária" },
  { id: "pia-5", text: "Postagens em redes sociais", category: "Rede Social", company: "Pub IA", assignee: "Marina S.", dueTime: "16:00", priority: "Alta", recurrence: "Diária" },

  // ===== Pub RECORDS =====
  { id: "prc-1", text: "Ações de marketing diárias", category: "Marketing", company: "Pub RECORDS", assignee: "Marina S.", dueTime: "09:00", priority: "Alta", recurrence: "Diária" },
  { id: "prc-2", text: "Postagens em redes sociais", category: "Rede Social", company: "Pub RECORDS", assignee: "Marina S.", dueTime: "10:00", priority: "Alta", recurrence: "Diária" },
  { id: "prc-3", text: "Prospecção ativa/passiva", category: "Prospecção", company: "Pub RECORDS", assignee: "Pedro A.", dueTime: "11:00", priority: "Média", recurrence: "Diária" },
  { id: "prc-4", text: "Produção musical (sessões do dia)", category: "Produção Musical", company: "Pub RECORDS", assignee: "Júlia R.", dueTime: "13:00", priority: "Crítica", recurrence: "Diária" },
  { id: "prc-5", text: "Operação Rádio 24h — Peace Beats", category: "Rádio 24h", company: "Pub RECORDS", assignee: "Júlia R.", dueTime: "08:00", priority: "Alta", recurrence: "Diária" },
  { id: "prc-6", text: "Produção e catalogação de beats e samples", category: "Beats & Samples", company: "Pub RECORDS", assignee: "Júlia R.", dueTime: "15:00", priority: "Alta", recurrence: "Diária" },

  // ===== Pub Films =====
  { id: "pfm-1", text: "Ações de marketing diárias", category: "Marketing", company: "Pub Films", assignee: "Marina S.", dueTime: "09:30", priority: "Alta", recurrence: "Diária" },
  { id: "pfm-2", text: "Postagens em redes sociais", category: "Rede Social", company: "Pub Films", assignee: "Marina S.", dueTime: "10:30", priority: "Alta", recurrence: "Diária" },
  { id: "pfm-3", text: "Prospecção ativa/passiva", category: "Prospecção", company: "Pub Films", assignee: "Pedro A.", dueTime: "14:00", priority: "Média", recurrence: "Diária" },

  // ===== Bricks =====
  { id: "brk-1", text: "Conferência de estoque", category: "Estoque", company: "Bricks", assignee: "Rafael T.", dueTime: "08:00", priority: "Alta", recurrence: "Diária" },
  { id: "brk-2", text: "Checar pedidos em rota", category: "Logística", company: "Bricks", assignee: "Rafael T.", dueTime: "10:00", priority: "Crítica", recurrence: "Diária" },
  { id: "brk-3", text: "Validar entregas do dia", category: "Logística", company: "Bricks", assignee: "Rafael T.", dueTime: "16:00", priority: "Alta", recurrence: "Diária" },
  { id: "brk-4", text: "Reunião comercial", category: "Comercial", company: "Bricks", assignee: "Rafael T.", dueTime: "09:00", priority: "Média", recurrence: "Diária" },

  // ===== Têxtil =====
  { id: "txt-1", text: "Inspecionar produção da manhã", category: "Produção", company: "Têxtil", assignee: "Camila O.", dueTime: "08:30", priority: "Alta", recurrence: "Diária" },
  { id: "txt-2", text: "Verificar qualidade — amostragem", category: "Qualidade", company: "Têxtil", assignee: "Camila O.", dueTime: "11:00", priority: "Crítica", recurrence: "Diária" },
  { id: "txt-3", text: "Conferir matéria-prima", category: "Estoque", company: "Têxtil", assignee: "Camila O.", dueTime: "14:00", priority: "Média", recurrence: "Diária" },
  { id: "txt-4", text: "Atualizar planilha de produção", category: "Produção", company: "Têxtil", assignee: "Camila O.", dueTime: "17:00", priority: "Baixa", recurrence: "Diária" },
];

export const ASSIGNEES = [
  "Lucas M.", "Marina S.", "Pedro A.", "Júlia R.", "Rafael T.", "Camila O.",
] as const;

// Histórico operacional: últimos 14 dias
export interface HistoryDay {
  date: string; // ISO yyyy-mm-dd
  label: string; // "Seg 21"
  completed: number;
  pending: number;
  late: number;
  productivity: number; // 0..100
}

function genHistory(): HistoryDay[] {
  const days: HistoryDay[] = [];
  const today = new Date();
  const wd = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];
  for (let i = 13; i >= 0; i--) {
    const d = new Date(today);
    d.setDate(today.getDate() - i);
    const seed = d.getDate() + d.getMonth() * 31;
    const completed = 14 + (seed % 9);
    const late = (seed % 4);
    const pending = 24 - completed - late;
    const productivity = Math.round((completed / 24) * 100);
    days.push({
      date: d.toISOString().slice(0, 10),
      label: `${wd[d.getDay()]} ${String(d.getDate()).padStart(2, "0")}`,
      completed, pending: Math.max(0, pending), late, productivity,
    });
  }
  return days;
}

export const OPERATIONAL_HISTORY: HistoryDay[] = genHistory();

export interface TimelineEntry {
  id: string;
  time: string;
  user: string;
  company: Company;
  action: string;
  status: "completed" | "late" | "pending";
}

export const TIMELINE: TimelineEntry[] = [
  { id: "h1", time: "08:32", user: "Marina S.", company: "Pub IA", action: "Concluiu monitoramento de modelos", status: "completed" },
  { id: "h2", time: "09:05", user: "Rafael T.", company: "Bricks", action: "Conferência de estoque finalizada", status: "completed" },
  { id: "h3", time: "09:48", user: "Pedro A.", company: "Pub Films", action: "Equipamento checado", status: "completed" },
  { id: "h4", time: "10:22", user: "Júlia R.", company: "Pub RECORDS", action: "Backup de sessões", status: "late" },
  { id: "h5", time: "11:10", user: "Camila O.", company: "Têxtil", action: "Amostragem de qualidade", status: "completed" },
  { id: "h6", time: "11:55", user: "Lucas M.", company: "Pub 3D", action: "Render fila — pendente revisão", status: "pending" },
  { id: "h7", time: "13:40", user: "Marina S.", company: "Pub IA", action: "Pipeline validado", status: "completed" },
  { id: "h8", time: "15:18", user: "Júlia R.", company: "Pub RECORDS", action: "Master revisado", status: "completed" },
  { id: "h9", time: "16:05", user: "Rafael T.", company: "Bricks", action: "Entregas do dia validadas", status: "completed" },
  { id: "h10", time: "17:22", user: "Lucas M.", company: "Pub 3D", action: "Revisão de entregas atrasada", status: "late" },
];

export interface CalendarEvent {
  id: string;
  title: string;
  type: "Reunião" | "Campanha" | "Entrega" | "Produção";
  day: number; // dia do mês atual
  time: string;
  company: Company;
}

export const EVENTS: CalendarEvent[] = [
  { id: "e1", title: "Reunião executiva semanal", type: "Reunião", day: 3, time: "09:00", company: "Pub IA" },
  { id: "e2", title: "Lançamento campanha verão", type: "Campanha", day: 5, time: "10:00", company: "Bricks" },
  { id: "e3", title: "Entrega render cliente VIP", type: "Entrega", day: 7, time: "14:00", company: "Pub 3D" },
  { id: "e4", title: "Filmagem institucional", type: "Produção", day: 10, time: "08:00", company: "Pub Films" },
  { id: "e5", title: "Sessão de gravação EP", type: "Produção", day: 12, time: "13:00", company: "Pub RECORDS" },
  { id: "e6", title: "Reunião alinhamento têxtil", type: "Reunião", day: 15, time: "11:00", company: "Têxtil" },
  { id: "e7", title: "Campanha Pub IA — kickoff", type: "Campanha", day: 18, time: "15:00", company: "Pub IA" },
  { id: "e8", title: "Entrega coleção piloto", type: "Entrega", day: 22, time: "10:00", company: "Têxtil" },
  { id: "e9", title: "Reunião board mensal", type: "Reunião", day: 25, time: "16:00", company: "Bricks" },
  { id: "e10", title: "Produção spot publicitário", type: "Produção", day: 28, time: "09:00", company: "Pub Films" },
];

export interface Lead {
  id: string;
  name: string;
  company: string;
  stage: "Novo" | "Qualificado" | "Proposta" | "Negociação" | "Fechado";
  value: number;
  owner: Company;
}

export const LEADS: Lead[] = [
  { id: "l1", name: "Ana Carvalho", company: "Construtora Vértice", stage: "Proposta", value: 180000, owner: "Bricks" },
  { id: "l2", name: "Bruno Mendes", company: "TechWave", stage: "Qualificado", value: 65000, owner: "Pub IA" },
  { id: "l3", name: "Carla Souza", company: "Studio Lumière", stage: "Negociação", value: 240000, owner: "Pub Films" },
  { id: "l4", name: "Diego Pinto", company: "Rede Harmonia", stage: "Novo", value: 45000, owner: "Pub RECORDS" },
  { id: "l5", name: "Eliana Reis", company: "ModaForte", stage: "Fechado", value: 320000, owner: "Têxtil" },
  { id: "l6", name: "Fabio Lima", company: "ImobPlus", stage: "Proposta", value: 95000, owner: "Pub 3D" },
];
