import { Outlet, createRootRoute, HeadContent, Scripts, redirect } from "@tanstack/react-router";
import appCss from "../styles.css?url";
import { AuthProvider } from "@/lib/auth";
import { ThemeProvider } from "@/lib/theme";


export const Route = createRootRoute({
  head: () => ({
    meta: [
      { charSet: "utf-8" },
      { name: "viewport", content: "width=device-width, initial-scale=1" },
      { title: "PUB CORE — Central Operacional Executiva" },
      { name: "description", content: "Plataforma de gestão operacional da holding PUB. Kanban, checklists, calendário, CRM e KPIs em um só lugar." },
      { name: "theme-color", content: "#0e1118" },
      { property: "og:title", content: "PUB CORE — Central Operacional Executiva" },
      { property: "og:description", content: "Plataforma de gestão operacional da holding PUB. Kanban, checklists, calendário, CRM e KPIs em um só lugar." },
      { property: "og:type", content: "website" },
      { name: "twitter:title", content: "PUB CORE — Central Operacional Executiva" },
      { name: "twitter:description", content: "Plataforma de gestão operacional da holding PUB. Kanban, checklists, calendário, CRM e KPIs em um só lugar." },
      { property: "og:image", content: "https://pub-bb2e103a32db4e198524a2e9ed8f35b4.r2.dev/1fd4d5e1-80cf-406e-9163-588803fa9d75/id-preview-70992e44--5b07b214-0bf2-4def-8198-79e6de96bab5.lovable.app-1777387192188.png" },
      { name: "twitter:image", content: "https://pub-bb2e103a32db4e198524a2e9ed8f35b4.r2.dev/1fd4d5e1-80cf-406e-9163-588803fa9d75/id-preview-70992e44--5b07b214-0bf2-4def-8198-79e6de96bab5.lovable.app-1777387192188.png" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
    links: [{ rel: "stylesheet", href: appCss }],
  }),
  shellComponent: RootShell,
  component: () => <ThemeProvider><AuthProvider><Outlet /></AuthProvider></ThemeProvider>,
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
