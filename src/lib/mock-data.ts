export type Role = "Executivo" | "Marketing" | "Logística/Comercial";

export const COMPANIES = [
  "Pub 3D",
  "Pub IA",
  "Pub RECORDS",
  "Pub Films",
  "Bricks",
  "Têxtil",
] as const;
export type Company = (typeof COMPANIES)[number];

export const COMPANY_COLORS: Record<Company, string> = {
  "Pub 3D": "oklch(0.7 0.18 280)",
  "Pub IA": "oklch(0.75 0.16 195)",
  "Pub RECORDS": "oklch(0.72 0.18 25)",
  "Pub Films": "oklch(0.78 0.16 65)",
  "Bricks": "oklch(0.7 0.14 145)",
  "Têxtil": "oklch(0.74 0.16 340)",
};

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
  company: Company;
  assignee: string;
  dueTime: string; // HH:MM
  priority: Priority;
}

export const DAILY_TASKS: DailyTask[] = [
  // Pub 3D
  { id: "t1", text: "Verificar fila de renderização", company: "Pub 3D", assignee: "Lucas M.", dueTime: "09:00", priority: "Alta" },
  { id: "t2", text: "Backup de projetos do dia anterior", company: "Pub 3D", assignee: "Lucas M.", dueTime: "09:30", priority: "Média" },
  { id: "t3", text: "Reunião criativa rápida", company: "Pub 3D", assignee: "Pedro A.", dueTime: "10:00", priority: "Média" },
  { id: "t4", text: "Revisar entregas pendentes", company: "Pub 3D", assignee: "Lucas M.", dueTime: "17:00", priority: "Alta" },
  // Pub IA
  { id: "t5", text: "Monitorar performance dos modelos", company: "Pub IA", assignee: "Marina S.", dueTime: "08:30", priority: "Crítica" },
  { id: "t6", text: "Revisar logs de inferência", company: "Pub IA", assignee: "Marina S.", dueTime: "11:00", priority: "Alta" },
  { id: "t7", text: "Validar pipeline de dados", company: "Pub IA", assignee: "Marina S.", dueTime: "14:00", priority: "Média" },
  { id: "t8", text: "Atualizar dashboards de métrica", company: "Pub IA", assignee: "Marina S.", dueTime: "16:30", priority: "Baixa" },
  // Pub RECORDS
  { id: "t9", text: "Conferir agenda de estúdio", company: "Pub RECORDS", assignee: "Júlia R.", dueTime: "09:00", priority: "Alta" },
  { id: "t10", text: "Backup de sessões", company: "Pub RECORDS", assignee: "Júlia R.", dueTime: "10:00", priority: "Crítica" },
  { id: "t11", text: "Revisar masters pendentes", company: "Pub RECORDS", assignee: "Júlia R.", dueTime: "15:00", priority: "Alta" },
  { id: "t12", text: "Reunião com artistas do dia", company: "Pub RECORDS", assignee: "Pedro A.", dueTime: "17:30", priority: "Média" },
  // Pub Films
  { id: "t13", text: "Checar equipamento de filmagem", company: "Pub Films", assignee: "Pedro A.", dueTime: "08:00", priority: "Crítica" },
  { id: "t14", text: "Revisar cronograma de produção", company: "Pub Films", assignee: "Pedro A.", dueTime: "10:30", priority: "Alta" },
  { id: "t15", text: "Backup de mídias brutas", company: "Pub Films", assignee: "Pedro A.", dueTime: "18:00", priority: "Alta" },
  { id: "t16", text: "Alinhamento com diretor", company: "Pub Films", assignee: "Pedro A.", dueTime: "11:30", priority: "Média" },
  // Bricks
  { id: "t17", text: "Conferência de estoque", company: "Bricks", assignee: "Rafael T.", dueTime: "08:00", priority: "Alta" },
  { id: "t18", text: "Checar pedidos em rota", company: "Bricks", assignee: "Rafael T.", dueTime: "10:00", priority: "Crítica" },
  { id: "t19", text: "Validar entregas do dia", company: "Bricks", assignee: "Rafael T.", dueTime: "16:00", priority: "Alta" },
  { id: "t20", text: "Reunião comercial", company: "Bricks", assignee: "Rafael T.", dueTime: "09:00", priority: "Média" },
  // Têxtil
  { id: "t21", text: "Inspecionar produção da manhã", company: "Têxtil", assignee: "Camila O.", dueTime: "08:30", priority: "Alta" },
  { id: "t22", text: "Verificar qualidade — amostragem", company: "Têxtil", assignee: "Camila O.", dueTime: "11:00", priority: "Crítica" },
  { id: "t23", text: "Conferir matéria-prima", company: "Têxtil", assignee: "Camila O.", dueTime: "14:00", priority: "Média" },
  { id: "t24", text: "Atualizar planilha de produção", company: "Têxtil", assignee: "Camila O.", dueTime: "17:00", priority: "Baixa" },
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
