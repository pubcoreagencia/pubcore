import {
  LayoutDashboard, ListChecks, Calendar, Users2, Settings,
  StickyNote, Wallet, Boxes, Calculator, Box,
} from "lucide-react";

export type NavItem = { to: string; label: string; icon: typeof LayoutDashboard; exact?: boolean };
export type NavGroup = { label: string; items: NavItem[] };

export const navGroups: NavGroup[] = [
  {
    label: "Operação",
    items: [{ to: "/app", label: "Dashboard", icon: LayoutDashboard, exact: true }],
  },
  {
    label: "Workflow",
    items: [
      { to: "/app/checklists", label: "Centro Operacional", icon: ListChecks },
      { to: "/app/calendar", label: "Calendário", icon: Calendar },
      { to: "/app/notes", label: "Notas", icon: StickyNote },
    ],
  },
  {
    label: "Gestão",
    items: [
      { to: "/app/crm", label: "CRM", icon: Users2 },
      { to: "/app/finance", label: "Finanças", icon: Wallet },
      { to: "/app/stock", label: "Estoque", icon: Boxes },
      { to: "/app/calculator", label: "Calculadora", icon: Calculator },
      { to: "/app/calc3d", label: "Calculadora 3D", icon: Box },
      { to: "/app/settings", label: "Configurações", icon: Settings },
    ],
  },
];
