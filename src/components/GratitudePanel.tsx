import { useEffect, useRef, useState, useCallback } from "react";
import { Sparkles, Sun, Heart, Target, Compass, Moon, NotebookPen, Check, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { useWorkspace } from "@/lib/workspace";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";

type Entry = {
  id?: string;
  gratitude: string;
  objectives: string;
  mission: string;
  dreams: string;
  reflection: string;
  completed_at?: string | null;
};

const EMPTY: Entry = { gratitude: "", objectives: "", mission: "", dreams: "", reflection: "" };

function todayISO() {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

const FIELDS: Array<{ key: keyof Entry; label: string; placeholder: string; icon: typeof Heart; rows: number }> = [
  { key: "gratitude", label: "Gratidão do dia", placeholder: "Pelo que você é grato hoje?", icon: Heart, rows: 3 },
  { key: "objectives", label: "Objetivos atuais", placeholder: "O que deseja conquistar nesta fase?", icon: Target, rows: 3 },
  { key: "mission", label: "Missão principal", placeholder: "Qual é o seu foco principal hoje?", icon: Compass, rows: 2 },
  { key: "dreams", label: "Sonhos & metas", placeholder: "O que está construindo no longo prazo?", icon: Moon, rows: 3 },
  { key: "reflection", label: "Reflexão livre", placeholder: "Escreva o que sentir vontade…", icon: NotebookPen, rows: 4 },
];

export function GratitudePanel() {
  const { user } = useAuth();
  const { activeWorkspaceId } = useWorkspace();
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [entry, setEntry] = useState<Entry>(EMPTY);
  const [saving, setSaving] = useState<"idle" | "saving" | "saved">("idle");
  const [submitting, setSubmitting] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const entryRef = useRef<Entry>(EMPTY);
  entryRef.current = entry;

  // Check if today's entry exists / is completed
  useEffect(() => {
    if (!user || !activeWorkspaceId) return;
    let cancelled = false;
    (async () => {
      const date = todayISO();
      const { data } = await (supabase as any)
        .from("gratitude_entries")
        .select("*")
        .eq("user_id", user.id)
        .eq("entry_date", date)
        .maybeSingle();
      if (cancelled) return;
      if (data?.completed_at) {
        setOpen(false);
      } else {
        if (data) {
          setEntry({
            id: data.id,
            gratitude: data.gratitude ?? "",
            objectives: data.objectives ?? "",
            mission: data.mission ?? "",
            dreams: data.dreams ?? "",
            reflection: data.reflection ?? "",
          });
        }
        setOpen(true);
      }
      setLoading(false);
    })();
    return () => { cancelled = true; };
  }, [user, activeWorkspaceId]);

  // Lock body scroll
  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = prev; };
  }, [open]);

  const saveDraft = useCallback(async () => {
    if (!user || !activeWorkspaceId) return;
    const cur = entryRef.current;
    setSaving("saving");
    const payload = {
      workspace_id: activeWorkspaceId,
      user_id: user.id,
      owner_email: user.email,
      entry_date: todayISO(),
      gratitude: cur.gratitude,
      objectives: cur.objectives,
      mission: cur.mission,
      dreams: cur.dreams,
      reflection: cur.reflection,
    };
    const { data, error } = await (supabase as any)
      .from("gratitude_entries")
      .upsert(payload, { onConflict: "user_id,entry_date" })
      .select()
      .single();
    if (!error && data?.id) setEntry((e) => ({ ...e, id: data.id }));
    setSaving(error ? "idle" : "saved");
    if (!error) setTimeout(() => setSaving("idle"), 1500);
  }, [user, activeWorkspaceId]);

  const update = (key: keyof Entry, value: string) => {
    setEntry((e) => ({ ...e, [key]: value }));
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => { void saveDraft(); }, 700);
  };

  const handleComplete = async () => {
    if (!user || !activeWorkspaceId) return;
    const cur = entryRef.current;
    const hasContent = (cur.gratitude + cur.objectives + cur.mission + cur.dreams + cur.reflection).trim().length > 0;
    if (!hasContent) {
      toast.error("Escreva ao menos uma reflexão para concluir");
      return;
    }
    setSubmitting(true);
    const payload = {
      workspace_id: activeWorkspaceId,
      user_id: user.id,
      owner_email: user.email,
      entry_date: todayISO(),
      gratitude: cur.gratitude,
      objectives: cur.objectives,
      mission: cur.mission,
      dreams: cur.dreams,
      reflection: cur.reflection,
      completed_at: new Date().toISOString(),
    };
    const { error } = await (supabase as any)
      .from("gratitude_entries")
      .upsert(payload, { onConflict: "user_id,entry_date" });
    setSubmitting(false);
    if (error) {
      toast.error("Não foi possível concluir. Tente novamente.");
      return;
    }
    toast.success("Ritual concluído. Tenha um ótimo dia.");
    setOpen(false);
  };

  if (loading || !open) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-stretch justify-center overflow-y-auto bg-background/70 backdrop-blur-xl p-0 md:p-6">
      <div className="relative w-full max-w-2xl my-auto md:my-6">
        <div className="absolute -inset-px rounded-none md:rounded-3xl bg-gradient-to-br from-amber-200/20 via-rose-200/10 to-violet-300/20 blur-xl opacity-60 pointer-events-none" />
        <div className="relative rounded-none md:rounded-3xl border border-border/40 bg-card/80 backdrop-blur-2xl shadow-2xl">
          <header className="px-6 md:px-10 pt-8 pb-6 text-center border-b border-border/30">
            <div className="inline-flex h-12 w-12 items-center justify-center rounded-full bg-gradient-to-br from-amber-400/20 to-rose-400/20 ring-1 ring-amber-300/30 mb-4">
              <Sun className="h-6 w-6 text-amber-400" />
            </div>
            <h1 className="text-2xl md:text-3xl font-light tracking-tight">Painel da Gratidão</h1>
            <p className="mt-2 text-sm text-muted-foreground max-w-md mx-auto leading-relaxed">
              Um momento de respiro antes de começar. Escreva com calma — ninguém além de você lerá isto.
            </p>
            <div className="mt-4 flex items-center justify-center gap-1.5 text-[11px] uppercase tracking-[0.2em] text-muted-foreground/70">
              <Sparkles className="h-3 w-3" />
              <span>Ritual diário</span>
            </div>
          </header>

          <div className="px-6 md:px-10 py-6 space-y-6 max-h-[60vh] md:max-h-[55vh] overflow-y-auto">
            {FIELDS.map((f) => {
              const Icon = f.icon;
              return (
                <div key={f.key} className="space-y-2">
                  <label className="flex items-center gap-2 text-xs font-medium text-foreground/80 uppercase tracking-wider">
                    <Icon className="h-3.5 w-3.5 text-amber-400/80" />
                    {f.label}
                  </label>
                  <Textarea
                    value={entry[f.key] as string}
                    onChange={(e) => update(f.key, e.target.value)}
                    placeholder={f.placeholder}
                    rows={f.rows}
                    className="resize-none bg-background/40 border-border/40 focus-visible:ring-amber-400/30 placeholder:text-muted-foreground/50 leading-relaxed text-[15px]"
                  />
                </div>
              );
            })}
          </div>

          <footer className="px-6 md:px-10 py-5 border-t border-border/30 flex items-center justify-between gap-3 bg-background/30">
            <div className="text-[11px] text-muted-foreground inline-flex items-center gap-1.5 min-h-[20px]">
              {saving === "saving" && (<><Loader2 className="h-3 w-3 animate-spin" /> Salvando rascunho…</>)}
              {saving === "saved" && (<><Check className="h-3 w-3 text-emerald-500" /> Rascunho salvo</>)}
            </div>
            <div className="flex items-center gap-2">
              <Button variant="ghost" size="sm" onClick={() => void saveDraft()} disabled={submitting}>
                Salvar rascunho
              </Button>
              <Button
                size="sm"
                onClick={handleComplete}
                disabled={submitting}
                className="bg-gradient-to-r from-amber-500 to-rose-500 text-white hover:opacity-90 shadow-lg"
              >
                {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : "Concluir ritual"}
              </Button>
            </div>
          </footer>
        </div>
      </div>
    </div>
  );
}
