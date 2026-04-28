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

export const COMPANY_CHECKLISTS: Record<Company, string[]> = {
  "Pub 3D": [
    "Verificar fila de renderização",
    "Backup de projetos do dia anterior",
    "Reunião criativa rápida (15min)",
    "Revisar entregas pendentes",
  ],
  "Pub IA": [
    "Monitorar performance dos modelos",
    "Revisar logs de inferência",
    "Validar pipeline de dados",
    "Atualizar dashboards de métrica",
  ],
  "Pub RECORDS": [
    "Conferir agenda de estúdio",
    "Backup de sessões",
    "Revisar masters pendentes",
    "Reunião com artistas do dia",
  ],
  "Pub Films": [
    "Checar equipamento de filmagem",
    "Revisar cronograma de produção",
    "Backup de mídias brutas",
    "Alinhamento com diretor",
  ],
  "Bricks": [
    "Conferência de estoque",
    "Checar pedidos em rota",
    "Validar entregas do dia",
    "Reunião comercial 9h",
  ],
  "Têxtil": [
    "Inspecionar produção da manhã",
    "Verificar qualidade — amostragem",
    "Conferir matéria-prima recebida",
    "Atualizar planilha de produção",
  ],
};

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
