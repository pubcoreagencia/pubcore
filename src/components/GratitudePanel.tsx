import { useEffect, useRef, useState, useCallback } from "react";
import { Sparkles, Sun, Check, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { useWorkspace } from "@/lib/workspace";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { useAutosave } from "@/hooks/use-autosave";
import { useGratitudeEnabled } from "@/lib/user-preferences";

function todayISO() {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

export function GratitudePanel() {
  const { user } = useAuth();
  const { activeWorkspaceId } = useWorkspace();
  const [gratitudeEnabled] = useGratitudeEnabled();
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const contentRef = useRef<string>("");
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);
  const initialLoadRef = useRef(false);

  // ── 1. Check if today's entry exists / is completed ──
  useEffect(() => {
    if (!user || !activeWorkspaceId) return;
    let cancelled = false;
    (async () => {
      const date = todayISO();
      const { data } = await (supabase as any)
        .from("gratitude_entries")
        .select("id,content,completed_at")
        .eq("user_id", user.id)
        .eq("entry_date", date)
        .maybeSingle();
      if (cancelled) return;
      if (data?.completed_at) {
        setOpen(false);
      } else {
        contentRef.current = data?.content ?? "";
        if (textareaRef.current) textareaRef.current.value = contentRef.current;
        initialLoadRef.current = true;
        setOpen(true);
      }
      setLoading(false);
    })();
    return () => { cancelled = true; };
  }, [user, activeWorkspaceId]);

  // ── 2. Lock body scroll ──
  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = prev; };
  }, [open]);

  // ── 3. Autosave hook (debounce 1.5 s) ──
  const saver = useCallback(
    async (patch: { content: string }) => {
      if (!user || !activeWorkspaceId) return {};
      const payload = {
        workspace_id: activeWorkspaceId,
        user_id: user.id,
        owner_email: user.email,
        entry_date: todayISO(),
        content: patch.content,
      };
      const { error } = await (supabase as any)
        .from("gratitude_entries")
        .upsert(payload, { onConflict: "user_id,entry_date" });
      if (error) return { error: { message: error.message } };
      return {};
    },
    [user, activeWorkspaceId]
  );

  const { queue, flush, status } = useAutosave<{ content: string }>(saver, 1500);

  // Flush pending saves on tab-switch / unmount
  useEffect(() => {
    const onVis = () => {
      if (document.visibilityState === "hidden") flush();
    };
    document.addEventListener("visibilitychange", onVis);
    return () => {
      document.removeEventListener("visibilitychange", onVis);
      flush();
    };
  }, [flush]);

  // ── 4. Handlers ──
  // Uncontrolled textarea — store in ref to avoid re-rendering the heavy modal on every keystroke
  const handleChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    contentRef.current = e.target.value;
    if (initialLoadRef.current) {
      queue({ content: e.target.value });
    }
  };

  const handleBlur = () => {
    flush();
  };


  const handleComplete = async () => {
    if (!user || !activeWorkspaceId) return;
    const cur = contentRef.current.trim();
    if (!cur) {
      toast.error("Escreva algo para concluir");
      return;
    }
    setSubmitting(true);
    await flush(); // ensure any pending draft is persisted first
    const payload = {
      workspace_id: activeWorkspaceId,
      user_id: user.id,
      owner_email: user.email,
      entry_date: todayISO(),
      content: cur,
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
    <div className="fixed inset-0 z-[100] flex items-stretch justify-center overflow-y-auto bg-background/95 p-0 md:p-6">
      <div className="relative w-full max-w-2xl my-auto md:my-6">
        <div className="relative rounded-none md:rounded-3xl border border-border/40 bg-card shadow-2xl">
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

          <div className="px-6 md:px-10 py-6 max-h-[60vh] md:max-h-[55vh] overflow-y-auto">
            <Textarea
              ref={textareaRef}
              defaultValue={contentRef.current}
              onChange={handleChange}
              onBlur={handleBlur}
              placeholder="Escreva o que sentir vontade... gratidão, objetivos, sonhos, reflexões..."
              rows={12}
              className="resize-none bg-background/40 border-border/40 focus-visible:ring-amber-400/30 placeholder:text-muted-foreground/50 leading-relaxed text-[15px]"
            />
          </div>

          <footer className="px-6 md:px-10 py-5 border-t border-border/30 flex items-center justify-between gap-3 bg-background/30">
            <div className="text-[11px] text-muted-foreground inline-flex items-center gap-1.5 min-h-[20px]">
              {status === "saving" && (
                <><Loader2 className="h-3 w-3 animate-spin" /> Salvando…</>
              )}
              {status === "saved" && (
                <><Check className="h-3 w-3 text-emerald-500" /> Salvo</>
              )}
              {status === "error" && (
                <span className="text-red-400">Erro ao salvar</span>
              )}
            </div>
            <div className="flex items-center gap-2">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => void flush()}
                disabled={submitting || status === "saving"}
              >
                Salvar agora
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
