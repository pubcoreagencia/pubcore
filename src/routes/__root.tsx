import { Outlet, createRootRoute, HeadContent, Scripts, redirect } from "@tanstack/react-router";
import appCss from "../styles.css?url";
import { AuthProvider } from "@/lib/auth";

export const Route = createRootRoute({
  head: () => ({
    meta: [
      { charSet: "utf-8" },
      { name: "viewport", content: "width=device-width, initial-scale=1" },
      { title: "PUB CORE — Central Operacional Executiva" },
      { name: "description", content: "Plataforma de gestão operacional da holding PUB. Kanban, checklists, calendário, CRM e KPIs em um só lugar." },
      { name: "theme-color", content: "#0e1118" },
      { property: "og:title", content: "PUB CORE — Holding OS" },
      { property: "og:description", content: "Central operacional executiva da holding PUB." },
      { property: "og:type", content: "website" },
    ],
    links: [{ rel: "stylesheet", href: appCss }],
  }),
  shellComponent: RootShell,
  component: () => <AuthProvider><Outlet /></AuthProvider>,
  notFoundComponent: NotFound,
});

function RootShell({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-BR">
      <head><HeadContent /></head>
      <body>{children}<Scripts /></body>
    </html>
  );
}

function NotFound() {
  return (
    <div className="min-h-screen grid place-items-center bg-background">
      <div className="text-center">
        <h1 className="font-display text-7xl text-gradient">404</h1>
        <p className="mt-2 text-muted-foreground">Rota não encontrada</p>
        <a href="/" className="mt-6 inline-block rounded-lg bg-gradient-primary px-5 py-2.5 text-sm font-semibold text-primary-foreground">Voltar</a>
      </div>
    </div>
  );
}

export { redirect };
