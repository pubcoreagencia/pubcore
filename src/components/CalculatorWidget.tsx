import { useState, useEffect, useRef, useCallback } from "react";
import { Calculator as CalcIcon, X, Minus } from "lucide-react";
import { CalculatorCore } from "./CalculatorCore";
import { useRouterState } from "@tanstack/react-router";

const POS_KEY = "pubcore:calc:widget:pos";
const OPEN_KEY = "pubcore:calc:widget:open";

type Pos = { x: number; y: number };

function loadPos(): Pos | null {
  if (typeof window === "undefined") return null;
  try {
    const p = JSON.parse(localStorage.getItem(POS_KEY) || "null");
    if (p && typeof p.x === "number" && typeof p.y === "number") return p;
  } catch {}
  return null;
}

const MOBILE_BREAKPOINT = 768;
const BOTTOM_NAV_RESERVE = 80; // bottom nav (~56) + folga
const TOP_RESERVE = 12;

function isMobile() {
  return typeof window !== "undefined" && window.innerWidth < MOBILE_BREAKPOINT;
}

function defaultPos(width: number, height: number): Pos {
  if (typeof window === "undefined") return { x: 24, y: 24 };
  const margin = isMobile() ? 12 : 24;
  const bottomReserve = isMobile() ? BOTTOM_NAV_RESERVE : margin;
  return {
    x: window.innerWidth - width - margin,
    y: window.innerHeight - height - bottomReserve,
  };
}

export function CalculatorWidget() {
  const path = useRouterState({ select: (s) => s.location.pathname });
  const [pos, setPos] = useState<Pos>(() => {
    if (typeof window === "undefined") return { x: 24, y: 24 };
    const saved = loadPos();
    if (saved) return saved;
    return defaultPos(48, 48);
  });
  const [open, setOpen] = useState(false);
  const [showHistory, setShowHistory] = useState(false);
  const dragRef = useRef<{ startX: number; startY: number; origX: number; origY: number; dragging: boolean; moved: boolean }>({
    startX: 0, startY: 0, origX: 0, origY: 0, dragging: false, moved: false,
  });
  const containerRef = useRef<HTMLDivElement>(null);

  // restore open state per session
  useEffect(() => {
    try {
      setOpen(sessionStorage.getItem(OPEN_KEY) === "1");
    } catch {}
  }, []);

  useEffect(() => {
    try { sessionStorage.setItem(OPEN_KEY, open ? "1" : "0"); } catch {}
  }, [open]);

  // clamp position on resize — respeita bottom nav no mobile
  useEffect(() => {
    const clamp = () => {
      setPos((p) => {
        const w = containerRef.current?.offsetWidth ?? 64;
        const h = containerRef.current?.offsetHeight ?? 64;
        const mobile = isMobile();
        const bottomReserve = mobile ? BOTTOM_NAV_RESERVE : 8;
        const sideMargin = mobile ? 8 : 8;
        const maxX = window.innerWidth - w - sideMargin;
        const maxY = window.innerHeight - h - bottomReserve;
        return {
          x: Math.max(sideMargin, Math.min(p.x, maxX)),
          y: Math.max(TOP_RESERVE, Math.min(p.y, maxY)),
        };
      });
    };
    clamp();
    window.addEventListener("resize", clamp);
    return () => window.removeEventListener("resize", clamp);
  }, [open]);

  // save pos
  useEffect(() => {
    try { localStorage.setItem(POS_KEY, JSON.stringify(pos)); } catch {}
  }, [pos]);

  const onPointerDown = useCallback((e: React.PointerEvent) => {
    dragRef.current = {
      startX: e.clientX, startY: e.clientY,
      origX: pos.x, origY: pos.y,
      dragging: true, moved: false,
    };
    (e.target as Element).setPointerCapture(e.pointerId);
  }, [pos]);

  const onPointerMove = useCallback((e: React.PointerEvent) => {
    const d = dragRef.current;
    if (!d.dragging) return;
    const dx = e.clientX - d.startX;
    const dy = e.clientY - d.startY;
    if (Math.abs(dx) > 3 || Math.abs(dy) > 3) d.moved = true;
    const w = containerRef.current?.offsetWidth ?? 64;
    const h = containerRef.current?.offsetHeight ?? 64;
    const mobile = isMobile();
    const bottomReserve = mobile ? BOTTOM_NAV_RESERVE : 8;
    const sideMargin = 8;
    const maxX = window.innerWidth - w - sideMargin;
    const maxY = window.innerHeight - h - bottomReserve;
    setPos({
      x: Math.max(sideMargin, Math.min(d.origX + dx, maxX)),
      y: Math.max(TOP_RESERVE, Math.min(d.origY + dy, maxY)),
    });
  }, []);

  const onPointerUp = useCallback((e: React.PointerEvent, onClick?: () => void) => {
    const d = dragRef.current;
    const moved = d.moved;
    d.dragging = false;
    try { (e.target as Element).releasePointerCapture(e.pointerId); } catch {}
    if (!moved && onClick) onClick();
  }, []);

  // hide on auth pages
  if (!path.startsWith("/app")) return null;

  return (
    <div
      ref={containerRef}
      style={{ left: pos.x, top: pos.y }}
      className="fixed z-50 select-none"
    >
      {open ? (
        <div className="w-[300px] rounded-2xl border border-border/60 bg-card/80 backdrop-blur-xl shadow-2xl shadow-primary/10 overflow-hidden animate-scale-in">
          <div
            className="flex items-center justify-between px-3 py-2 border-b border-border/50 bg-background/40 cursor-grab active:cursor-grabbing touch-none"
            onPointerDown={onPointerDown}
            onPointerMove={onPointerMove}
            onPointerUp={(e) => onPointerUp(e)}
          >
            <div className="flex items-center gap-2">
              <div className="h-6 w-6 rounded-md bg-primary/15 grid place-items-center">
                <CalcIcon className="h-3.5 w-3.5 text-primary" />
              </div>
              <span className="text-xs font-medium text-foreground">Calculadora</span>
            </div>
            <div className="flex items-center gap-1">
              <button
                onClick={() => setOpen(false)}
                className="h-6 w-6 grid place-items-center rounded hover:bg-secondary/60 text-muted-foreground hover:text-foreground"
                aria-label="Minimizar"
              >
                <Minus className="h-3.5 w-3.5" />
              </button>
              <button
                onClick={() => setOpen(false)}
                className="h-6 w-6 grid place-items-center rounded hover:bg-destructive/20 text-muted-foreground hover:text-destructive"
                aria-label="Fechar"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </div>
          </div>
          <div className="p-3">
            <CalculatorCore
              compact
              onHistoryToggle={() => setShowHistory((v) => !v)}
              showHistoryPanel={showHistory}
            />
          </div>
        </div>
      ) : (
        <button
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={(e) => onPointerUp(e, () => setOpen(true))}
          className="h-12 w-12 rounded-full bg-gradient-to-br from-primary to-primary/70 text-primary-foreground shadow-xl shadow-primary/30 grid place-items-center hover:scale-110 transition-transform touch-none animate-fade-in"
          aria-label="Abrir calculadora"
        >
          <CalcIcon className="h-5 w-5" />
        </button>
      )}
    </div>
  );
}
