// PUB CORE — plataforma multiempresa.
// Este módulo foi neutralizado: não contém mais empresas pré-cadastradas
// da Holding PUB. Toda lista de empresas vem dinamicamente do workspace
// do usuário (tabela `checklist_companies` via `useChecklistCompanies`).

export type Role = "Executivo" | "Marketing" | "Logística/Comercial";

// Mantido como array vazio para compatibilidade com callsites legados.
// A lista real de empresas vem de `useChecklistCompanies()`.
export const COMPANIES: readonly string[] = [] as const;

export type Company = string;

export const COMPANY_COLORS: Record<string, string> = {};

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
  company: string;
  column: KanbanColumn;
  checklist: ChecklistItem[];
}

export const INITIAL_CARDS: KanbanCard[] = [];

export interface DailyTask {
  id: string;
  text: string;
  category: string;
  company: string;
  assignee: string;
  dueTime: string;
  priority: Priority;
  recurrence: "Diária";
}

export const DAILY_TASKS: DailyTask[] = [];

export const ASSIGNEES: readonly string[] = [] as const;

export interface HistoryDay {
  date: string;
  label: string;
  completed: number;
  pending: number;
  late: number;
  productivity: number;
}

export const OPERATIONAL_HISTORY: HistoryDay[] = [];

export interface TimelineEntry {
  id: string;
  time: string;
  user: string;
  company: string;
  action: string;
  status: "completed" | "late" | "pending";
}

export const TIMELINE: TimelineEntry[] = [];

export interface CalendarEvent {
  id: string;
  title: string;
  type: "Reunião" | "Campanha" | "Entrega" | "Produção";
  day: number;
  time: string;
  company: string;
}

export const EVENTS: CalendarEvent[] = [];

export interface Lead {
  id: string;
  name: string;
  company: string;
  stage: "Novo" | "Qualificado" | "Proposta" | "Negociação" | "Fechado";
  value: number;
  owner: string;
}

export const LEADS: Lead[] = [];
