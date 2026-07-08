import {
  LayoutDashboard, ListChecks, Calendar, Users2, Settings,
  StickyNote, Wallet, Boxes, Calculator, MapPin, KanbanSquare, Building2, FolderOpen,
  TrendingUp, PiggyBank, Share2, Sparkles,
} from "lucide-react";


export type NavItem = { to: string; label: string; icon: typeof LayoutDashboard; exact?: boolean };
export type NavGroup = { label: string; items: NavItem[] };

export const navGroups: NavGroup[] = [
  {
    label: "Operação",
    items: [
      { to: "/app", label: "Dashboard", icon: LayoutDashboard, exact: true },
      { to: "/app/city", label: "Cidade", icon: MapPin },
    ],
  },
  {
    label: "Workflow",
    items: [
      { to: "/app/operacao", label: "Centro Operacional", icon: KanbanSquare },
      { to: "/app/completion-reports", label: "Relatórios de Conclusão", icon: Sparkles },
      { to: "/app/calendar", label: "Calendário", icon: Calendar },
      { to: "/app/notes", label: "Notas", icon: StickyNote },
      { to: "/app/files", label: "Central de Arquivos", icon: FolderOpen },
      { to: "/app/shared", label: "Compartilhados", icon: Share2 },
      { to: "/app/trends", label: "Painel de Tendências", icon: TrendingUp },
    ],

  },
  {
    label: "Gestão",
    items: [
      { to: "/app/companies", label: "Empresas", icon: Building2 },
      { to: "/app/crm", label: "CRM", icon: Users2 },
      { to: "/app/finance", label: "Finanças", icon: Wallet },
      { to: "/app/personal-finance", label: "Finanças Pessoais", icon: PiggyBank },
      { to: "/app/stock", label: "Estoque", icon: Boxes },
      { to: "/app/calculator", label: "Calculadora de Custos", icon: Calculator },

      { to: "/app/settings", label: "Configurações", icon: Settings },
    ],
  },
];
