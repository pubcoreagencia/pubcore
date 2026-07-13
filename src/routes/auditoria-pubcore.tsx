import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useCallback, useEffect, useMemo, useState } from "react";
import { getAuditReport } from "@/lib/audit.functions";

type AuditData = Awaited<ReturnType<typeof getAuditReport>>;

export const Route = createFileRoute("/auditoria-pubcore")({
  head: () => ({
    meta: [
      { title: "Auditoria PUB CORE — Somente leitura" },
      { name: "robots", content: "noindex, nofollow" },
      { name: "description", content: "Página temporária de auditoria pública, apenas leitura, sem dados sensíveis." },
    ],
  }),
  component: AuditPage,
  ssr: false,
});

function AuditPage() {
  const fn = useServerFn(getAuditReport);
  const [data, setData] = useState<AuditData | null>(null);
  const [error, setError] = useState<Error | null>(null);
  const [isFetching, setIsFetching] = useState(false);
  const [copied, setCopied] = useState(false);

  const load = useCallback(async () => {
    setIsFetching(true);
    setError(null);
    try {
      const res = await fn();
      setData(res);
    } catch (e) {
      setError(e as Error);
    } finally {
      setIsFetching(false);
    }
  }, [fn]);

  useEffect(() => { load(); }, [load]);

  const isLoading = !data && isFetching;
  const refetch = load;

  const report = useMemo(() => (data ? buildTextReport(data) : ""), [data]);

  async function copyReport() {
    try {
      await navigator.clipboard.writeText(report);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      /* noop */
    }
  }

  return (
    <div className="min-h-screen bg-background text-foreground">
      <div className="max-w-6xl mx-auto p-6 md:p-10 space-y-8">
        <header className="space-y-2">
          <div className="inline-flex items-center gap-2 rounded-full border border-border/60 bg-card/60 px-3 py-1 text-xs uppercase tracking-widest text-muted-foreground">
            <span className="h-2 w-2 rounded-full bg-emerald-500" /> Somente leitura • sem login
          </div>
          <h1 className="text-3xl md:text-4xl font-bold tracking-tight">Auditoria PUB CORE</h1>
          <p className="text-sm text-muted-foreground max-w-2xl">
            Página temporária para inspeção externa do estado da plataforma. Não expõe emails
            completos, chaves, tokens, conteúdo de arquivos ou permite edição.
          </p>
          <div className="flex flex-wrap gap-2 pt-2">
            <button
              onClick={copyReport}
              disabled={!data}
              className="rounded-md bg-primary text-primary-foreground px-4 py-2 text-sm font-medium hover:bg-primary/90 disabled:opacity-50"
            >
              {copied ? "✓ Copiado" : "Copiar relatório técnico"}
            </button>
            <button
              onClick={() => refetch()}
              disabled={isFetching}
              className="rounded-md border border-border bg-card px-4 py-2 text-sm hover:bg-accent disabled:opacity-50"
            >
              {isFetching ? "Atualizando…" : "Atualizar"}
            </button>
          </div>
        </header>

        {isLoading && <div className="text-muted-foreground">Carregando dados…</div>}
        {error && (
          <div className="rounded-lg border border-destructive/40 bg-destructive/10 p-4 text-sm">
            Erro ao carregar: {(error as Error).message}
          </div>
        )}

        {data && (
          <>
            <Section title="Resumo por módulo">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {data.modules.map((m) => (
                  <div key={m.key} className="rounded-lg border border-border/60 bg-card/40 p-4">
                    <div className="text-sm font-semibold">{m.label}</div>
                    <dl className="mt-2 grid grid-cols-2 gap-x-3 gap-y-1 text-xs text-muted-foreground">
                      {Object.entries(m.counts).map(([k, v]) => (
                        <div key={k} className="flex justify-between">
                          <dt className="capitalize">{k.replace(/_/g, " ")}</dt>
                          <dd className="font-mono text-foreground">{v as number}</dd>
                        </div>
                      ))}
                    </dl>
                  </div>
                ))}
              </div>
            </Section>

            <Section title={`Workspaces (${data.workspaces.length})`}>
              <div className="overflow-x-auto rounded-lg border border-border/60">
                <table className="w-full text-sm">
                  <thead className="bg-muted/40 text-xs uppercase text-muted-foreground">
                    <tr>
                      <th className="p-2 text-left">Nome</th>
                      <th className="p-2 text-left">Slug</th>
                      <th className="p-2 text-left">Owner</th>
                      <th className="p-2 text-left">Email (mascarado)</th>
                      <th className="p-2 text-right">Membros</th>
                      <th className="p-2 text-left">Criado</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.workspaces.map((w) => (
                      <tr key={w.id} className="border-t border-border/40">
                        <td className="p-2">{w.name}</td>
                        <td className="p-2 text-muted-foreground">{w.slug ?? "—"}</td>
                        <td className="p-2">{w.owner_name}</td>
                        <td className="p-2 font-mono text-xs">{w.owner_email_masked}</td>
                        <td className="p-2 text-right font-mono">{w.member_count}</td>
                        <td className="p-2 text-xs text-muted-foreground">
                          {new Date(w.created_at).toLocaleDateString("pt-BR")}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </Section>

            <Section title={`Inconsistências detectadas (${data.inconsistencies.length})`}>
              {data.inconsistencies.length === 0 ? (
                <div className="text-sm text-emerald-500">Nenhuma inconsistência detectada.</div>
              ) : (
                <ul className="space-y-2">
                  {data.inconsistencies.map((i) => (
                    <li
                      key={i.id}
                      className="rounded-md border border-amber-500/30 bg-amber-500/5 p-3 text-sm flex justify-between"
                    >
                      <span>{i.label}</span>
                      <span className="font-mono">{i.count}</span>
                    </li>
                  ))}
                </ul>
              )}
            </Section>

            <Section title="Contagem completa por tabela">
              <div className="grid grid-cols-2 md:grid-cols-3 gap-2 text-xs">
                {Object.entries(data.counts)
                  .sort(([a], [b]) => a.localeCompare(b))
                  .map(([t, v]) => (
                    <div
                      key={t}
                      className="flex justify-between rounded border border-border/40 bg-card/30 px-2 py-1"
                    >
                      <span className="font-mono text-muted-foreground">{t}</span>
                      <span className="font-mono">
                        {v.error ? <span className="text-destructive">err</span> : v.count}
                      </span>
                    </div>
                  ))}
              </div>
            </Section>

            <Section title="Notas de segurança">
              <p className="text-sm text-muted-foreground">{data.permissions_note}</p>
              <p className="text-xs text-muted-foreground mt-2">
                Gerado em: {new Date(data.generated_at).toLocaleString("pt-BR")}
              </p>
            </Section>

            <details className="rounded-lg border border-border/60 bg-card/30 p-4">
              <summary className="cursor-pointer text-sm font-medium">
                Ver relatório técnico em texto
              </summary>
              <pre className="mt-3 max-h-96 overflow-auto whitespace-pre-wrap text-xs font-mono">
                {report}
              </pre>
            </details>
          </>
        )}
      </div>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="space-y-3">
      <h2 className="text-lg font-semibold">{title}</h2>
      {children}
    </section>
  );
}

function buildTextReport(d: Awaited<ReturnType<typeof getAuditReport>>): string {
  const L: string[] = [];
  L.push("=== AUDITORIA PUB CORE ===");
  L.push(`Gerado em: ${d.generated_at}`);
  L.push("");
  L.push("--- RESUMO POR MÓDULO ---");
  for (const m of d.modules) {
    L.push(`\n[${m.label}]`);
    for (const [k, v] of Object.entries(m.counts)) L.push(`  ${k}: ${v}`);
  }
  L.push("\n--- WORKSPACES ---");
  for (const w of d.workspaces) {
    L.push(
      `- ${w.name} (slug=${w.slug ?? "—"}) owner=${w.owner_name} <${w.owner_email_masked}> membros=${w.member_count} criado=${w.created_at}`,
    );
  }
  L.push("\n--- INCONSISTÊNCIAS ---");
  if (d.inconsistencies.length === 0) L.push("Nenhuma detectada.");
  for (const i of d.inconsistencies) L.push(`- ${i.label}: ${i.count}`);
  L.push("\n--- CONTAGEM POR TABELA ---");
  for (const [t, v] of Object.entries(d.counts).sort()) {
    L.push(`  ${t.padEnd(32)} ${v.error ? `ERRO: ${v.error}` : v.count}`);
  }
  L.push("\n--- SEGURANÇA ---");
  L.push(d.permissions_note);
  return L.join("\n");
}
