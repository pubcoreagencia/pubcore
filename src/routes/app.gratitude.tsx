import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Sun, ChevronLeft, Calendar } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";

export const Route = createFileRoute("/app/gratitude")({
  component: GratitudeHistoryPage,
});

type Row = {
  id: string;
  entry_date: string;
  content: string;
  completed_at: string | null;
};

function formatDate(iso: string) {
  const [y, m, d] = iso.split("-").map(Number);
  const dt = new Date(y, m - 1, d);
  return dt.toLocaleDateString("pt-BR", { weekday: "long", day: "2-digit", month: "long", year: "numeric" });
}

function GratitudeHistoryPage() {
  const { user } = useAuth();
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState<string | null>(null);

  useEffect(() => {
    if (!user) return;
    (async () => {
      const { data } = await (supabase as any)
        .from("gratitude_entries")
        .select("id,entry_date,content,completed_at")
        .eq("user_id", user.id)
        .order("entry_date", { ascending: false })
        .limit(200);
      setRows((data ?? []) as Row[]);
      setLoading(false);
    })();
  }, [user]);

  return (
    <div className="px-4 md:px-8 py-6 md:py-10 max-w-3xl mx-auto w-full">
      <Link to="/app" className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground mb-4">
        <ChevronLeft className="h-3 w-3" /> Voltar
      </Link>
      <div className="flex items-center gap-3 mb-2">
        <div className="inline-flex h-10 w-10 items-center justify-center rounded-full bg-gradient-to-br from-amber-400/20 to-rose-400/20 ring-1 ring-amber-300/30">
          <Sun className="h-5 w-5 text-amber-400" />
        </div>
        <div>
          <h1 className="text-2xl font-light tracking-tight">Histórico da Gratidão</h1>
          <p className="text-sm text-muted-foreground">Suas reflexões anteriores, dia a dia.</p>
        </div>
      </div>

      <div className="mt-8 space-y-3">
        {loading && <div className="text-sm text-muted-foreground">Carregando…</div>}
        {!loading && rows.length === 0 && (
          <div className="rounded-2xl border border-dashed border-border/50 p-10 text-center text-sm text-muted-foreground">
            Ainda não há registros. Seu primeiro ritual aparecerá aqui.
          </div>
        )}
        {rows.map((r) => {
          const isOpen = expanded === r.id;
          return (
            <div key={r.id} className="rounded-2xl border border-border/40 bg-card/50 backdrop-blur overflow-hidden">
              <button
                onClick={() => setExpanded(isOpen ? null : r.id)}
                className="w-full px-5 py-4 flex items-center justify-between hover:bg-accent/30 transition-colors text-left"
              >
                <div className="flex items-center gap-3">
                  <Calendar className="h-4 w-4 text-amber-400/80" />
                  <div>
                    <div className="text-sm font-medium capitalize">{formatDate(r.entry_date)}</div>
                    {r.completed_at && <div className="text-[11px] text-emerald-500/80">Concluído</div>}
                  </div>
                </div>
                <ChevronLeft className={`h-4 w-4 text-muted-foreground transition-transform ${isOpen ? "-rotate-90" : "rotate-180"}`} />
              </button>
              {isOpen && (
                <div className="px-5 pb-5 pt-1 border-t border-border/30">
                  <p className="text-sm leading-relaxed whitespace-pre-wrap text-foreground/90">{r.content}</p>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
