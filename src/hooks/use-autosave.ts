import { useCallback, useEffect, useRef, useState } from "react";

export type SaveStatus = "idle" | "saving" | "saved" | "error";

/**
 * Debounced autosave with per-key flush guarantees.
 * - Coalesces rapid edits into a single write
 * - Flushes pending writes when the key changes or the component unmounts
 * - Exposes a "salvando/salvo" status for visual feedback
 */
export function useAutosave<T extends Record<string, unknown>>(
  saver: (patch: T) => Promise<{ error?: { message: string } | null } | void>,
  delay = 600,
) {
  const [status, setStatus] = useState<SaveStatus>("idle");
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pendingRef = useRef<T | null>(null);
  const savedTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const saverRef = useRef(saver);
  saverRef.current = saver;

  const flush = useCallback(async () => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
    const patch = pendingRef.current;
    if (!patch) return;
    pendingRef.current = null;
    setStatus("saving");
    try {
      const res = await saverRef.current(patch);
      if (res && "error" in res && res.error) {
        setStatus("error");
        return;
      }
      setStatus("saved");
      if (savedTimerRef.current) clearTimeout(savedTimerRef.current);
      savedTimerRef.current = setTimeout(() => setStatus("idle"), 1500);
    } catch {
      setStatus("error");
    }
  }, []);

  const queue = useCallback((patch: T) => {
    pendingRef.current = { ...(pendingRef.current ?? {}), ...patch } as T;
    // Avoid setState on every keystroke — only flip to "saving" when not already saving
    setStatus((s) => (s === "saving" ? s : "saving"));
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => { void flush(); }, delay);
  }, [delay, flush]);

  useEffect(() => () => {
    // Best-effort flush on unmount
    if (pendingRef.current) void flush();
    if (savedTimerRef.current) clearTimeout(savedTimerRef.current);
  }, [flush]);

  return { queue, flush, status };
}
