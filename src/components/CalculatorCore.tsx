import { useState, useCallback, useEffect, useRef } from "react";
import { Copy, Trash2, Delete, History as HistoryIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

export type CalcHistoryItem = { id: string; expr: string; result: string; ts: number };

const HISTORY_KEY = "pubcore:calc:history";

function safeEval(expr: string): number {
  // Sanitize: only digits, operators, parens, dot, percent, spaces
  const cleaned = expr.replace(/×/g, "*").replace(/÷/g, "/").replace(/−/g, "-").replace(/,/g, ".");
  if (!/^[\d+\-*/().%\s]*$/.test(cleaned)) throw new Error("Invalid");
  // Convert percentages: 50% -> (50/100)
  const withPct = cleaned.replace(/(\d+(?:\.\d+)?)%/g, "($1/100)");
  // eslint-disable-next-line no-new-func
  const val = Function(`"use strict"; return (${withPct || 0});`)();
  if (typeof val !== "number" || !isFinite(val)) throw new Error("Invalid");
  return val;
}

function formatResult(n: number): string {
  if (Number.isInteger(n)) return n.toString();
  return parseFloat(n.toFixed(10)).toString();
}

export function loadHistory(): CalcHistoryItem[] {
  if (typeof window === "undefined") return [];
  try {
    return JSON.parse(localStorage.getItem(HISTORY_KEY) || "[]");
  } catch {
    return [];
  }
}

function saveHistory(h: CalcHistoryItem[]) {
  try {
    localStorage.setItem(HISTORY_KEY, JSON.stringify(h.slice(0, 50)));
    window.dispatchEvent(new CustomEvent("pubcore:calc:history-changed"));
  } catch {
    // ignore
  }
}

interface Props {
  compact?: boolean;
  onHistoryToggle?: () => void;
  showHistoryPanel?: boolean;
}

export function CalculatorCore({ compact = false, onHistoryToggle, showHistoryPanel }: Props) {
  const [expr, setExpr] = useState("");
  const [preview, setPreview] = useState<string>("");
  const [history, setHistory] = useState<CalcHistoryItem[]>(() => loadHistory());
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const onChange = () => setHistory(loadHistory());
    window.addEventListener("pubcore:calc:history-changed", onChange);
    return () => window.removeEventListener("pubcore:calc:history-changed", onChange);
  }, []);

  useEffect(() => {
    if (!expr) { setPreview(""); return; }
    try {
      setPreview(formatResult(safeEval(expr)));
    } catch {
      setPreview("");
    }
  }, [expr]);

  const append = useCallback((v: string) => setExpr((e) => e + v), []);
  const clear = useCallback(() => { setExpr(""); setPreview(""); }, []);
  const back = useCallback(() => setExpr((e) => e.slice(0, -1)), []);

  const equals = useCallback(() => {
    if (!expr) return;
    try {
      const r = formatResult(safeEval(expr));
      const item: CalcHistoryItem = { id: crypto.randomUUID(), expr, result: r, ts: Date.now() };
      const next = [item, ...history].slice(0, 50);
      setHistory(next);
      saveHistory(next);
      setExpr(r);
    } catch {
      toast.error("Expressão inválida");
    }
  }, [expr, history]);

  const copyResult = useCallback(() => {
    const v = preview || expr;
    if (!v) return;
    navigator.clipboard.writeText(v);
    toast.success("Copiado");
  }, [preview, expr]);

  const clearHistory = () => {
    setHistory([]);
    saveHistory([]);
    toast.success("Histórico limpo");
  };

  // Keyboard support
  useEffect(() => {
    const el = rootRef.current;
    if (!el) return;
    const handler = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement;
      if (target && (target.tagName === "INPUT" || target.tagName === "TEXTAREA" || target.isContentEditable)) {
        if (!el.contains(target)) return;
      }
      if (/^[0-9]$/.test(e.key)) { append(e.key); e.preventDefault(); }
      else if (["+", "-", "*", "/", "(", ")", ".", "%"].includes(e.key)) { append(e.key); e.preventDefault(); }
      else if (e.key === "Enter" || e.key === "=") { equals(); e.preventDefault(); }
      else if (e.key === "Backspace") { back(); e.preventDefault(); }
      else if (e.key === "Escape") { clear(); e.preventDefault(); }
    };
    el.addEventListener("keydown", handler);
    return () => el.removeEventListener("keydown", handler);
  }, [append, equals, back, clear]);

  const btn = "h-11 rounded-lg font-medium text-sm transition-all hover:scale-[1.03] active:scale-95";
  const num = `${btn} bg-secondary/60 hover:bg-secondary text-foreground`;
  const op = `${btn} bg-primary/15 hover:bg-primary/25 text-primary border border-primary/20`;
  const eq = `${btn} bg-gradient-to-br from-primary to-primary/70 text-primary-foreground shadow-lg shadow-primary/30`;

  return (
    <div ref={rootRef} tabIndex={0} className="outline-none flex flex-col gap-3 w-full" >
      {/* Display */}
      <div className="rounded-xl bg-background/60 backdrop-blur border border-border/50 p-3 min-h-[88px] flex flex-col justify-end">
        <div className="text-right text-xs text-muted-foreground min-h-[16px] truncate">
          {expr || "0"}
        </div>
        <div className="text-right font-display text-2xl md:text-3xl text-foreground truncate">
          {preview || "0"}
        </div>
      </div>

      {/* Quick actions */}
      <div className="flex items-center gap-1.5 justify-between">
        <div className="flex gap-1.5">
          <Button size="sm" variant="ghost" onClick={copyResult} className="h-7 px-2 text-xs gap-1">
            <Copy className="h-3 w-3" /> Copiar
          </Button>
          {onHistoryToggle && (
            <Button
              size="sm"
              variant="ghost"
              onClick={onHistoryToggle}
              className={`h-7 px-2 text-xs gap-1 ${showHistoryPanel ? "text-primary" : ""}`}
            >
              <HistoryIcon className="h-3 w-3" /> Histórico
            </Button>
          )}
        </div>
        <Button size="sm" variant="ghost" onClick={back} className="h-7 px-2 text-xs gap-1">
          <Delete className="h-3 w-3" />
        </Button>
      </div>

      {/* Pad */}
      <div className="grid grid-cols-4 gap-1.5">
        <button className={op} onClick={clear}>C</button>
        <button className={op} onClick={() => append("(")}>(</button>
        <button className={op} onClick={() => append(")")}>)</button>
        <button className={op} onClick={() => append("/")}>÷</button>

        <button className={num} onClick={() => append("7")}>7</button>
        <button className={num} onClick={() => append("8")}>8</button>
        <button className={num} onClick={() => append("9")}>9</button>
        <button className={op} onClick={() => append("*")}>×</button>

        <button className={num} onClick={() => append("4")}>4</button>
        <button className={num} onClick={() => append("5")}>5</button>
        <button className={num} onClick={() => append("6")}>6</button>
        <button className={op} onClick={() => append("-")}>−</button>

        <button className={num} onClick={() => append("1")}>1</button>
        <button className={num} onClick={() => append("2")}>2</button>
        <button className={num} onClick={() => append("3")}>3</button>
        <button className={op} onClick={() => append("+")}>+</button>

        <button className={num} onClick={() => append("0")}>0</button>
        <button className={num} onClick={() => append(".")}>.</button>
        <button className={op} onClick={() => append("%")}>%</button>
        <button className={eq} onClick={equals}>=</button>
      </div>

      {/* Quick shortcuts */}
      {!compact && (
        <div className="grid grid-cols-3 gap-1.5">
          <button className={`${op} h-9 text-xs`} onClick={() => append("*1.1")}>+10%</button>
          <button className={`${op} h-9 text-xs`} onClick={() => append("*0.9")}>-10%</button>
          <button className={`${op} h-9 text-xs`} onClick={() => append("*1.2")}>+20%</button>
          <button className={`${op} h-9 text-xs`} onClick={() => append("/2")}>÷2</button>
          <button className={`${op} h-9 text-xs`} onClick={() => append("*2")}>×2</button>
          <button className={`${op} h-9 text-xs`} onClick={() => append("*1.05")}>+5%</button>
        </div>
      )}

      {showHistoryPanel && (
        <div className="rounded-xl border border-border/50 bg-background/40 p-2 max-h-48 overflow-y-auto">
          <div className="flex items-center justify-between px-1 mb-1">
            <span className="text-[10px] uppercase tracking-wider text-muted-foreground">Histórico</span>
            {history.length > 0 && (
              <button onClick={clearHistory} className="text-[10px] text-muted-foreground hover:text-destructive flex items-center gap-1">
                <Trash2 className="h-3 w-3" /> Limpar
              </button>
            )}
          </div>
          {history.length === 0 ? (
            <div className="text-xs text-muted-foreground text-center py-4">Sem cálculos ainda</div>
          ) : (
            <div className="space-y-0.5">
              {history.map((h) => (
                <button
                  key={h.id}
                  onClick={() => setExpr(h.result)}
                  className="w-full text-left px-2 py-1.5 rounded hover:bg-secondary/60 transition-colors"
                >
                  <div className="text-[10px] text-muted-foreground truncate">{h.expr}</div>
                  <div className="text-sm text-foreground font-medium truncate">= {h.result}</div>
                </button>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
