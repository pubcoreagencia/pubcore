import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Building2, ListChecks, Clock, Layers, NotebookPen, FolderArchive,
  Music, Package, Wallet, TrendingUp, Settings, Search, Map as MapIcon,
  Gauge, X, DoorOpen, Keyboard,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/app/city")({
  component: CityPage,
});

// ============ MAP DEFINITION ============
// Compacto: 1600x1000. Tudo cabe na tela, sem walking simulator.
const WORLD_W = 1600;
const WORLD_H = 1000;
const AVATAR_SIZE = 22;
const SPEED = 4.2;          // px per frame (rápido)
const INTERACT_RADIUS = 90;

type Place = {
  id: string;
  name: string;
  desc: string;
  route: string;
  icon: typeof Building2;
  x: number; y: number; w: number; h: number;
  color: string;            // accent oklch
  roof: string;             // roof oklch
};

const PLACES: Place[] = [
  // Linha 1 — Núcleo administrativo
  { id: "dashboard", name: "Escritório Central", desc: "Dashboard & visão geral", route: "/app",
    icon: Gauge, x: 700, y: 420, w: 200, h: 160,
    color: "oklch(0.72 0.18 250)", roof: "oklch(0.55 0.18 250)" },
  { id: "companies", name: "Prefeitura", desc: "Empresas da holding", route: "/app/companies",
    icon: Building2, x: 380, y: 420, w: 180, h: 160,
    color: "oklch(0.74 0.10 60)", roof: "oklch(0.55 0.12 60)" },
  { id: "settings", name: "Administração", desc: "Configurações", route: "/app/settings",
    icon: Settings, x: 1040, y: 420, w: 180, h: 160,
    color: "oklch(0.70 0.06 270)", roof: "oklch(0.50 0.08 270)" },

  // Linha 2 — Operação (topo)
  { id: "checklists", name: "Sala de Operações", desc: "Checklists e tarefas", route: "/app/checklists",
    icon: ListChecks, x: 200, y: 140, w: 180, h: 150,
    color: "oklch(0.72 0.18 160)", roof: "oklch(0.50 0.15 160)" },
  { id: "ponto", name: "Relógio de Ponto", desc: "Bater ponto", route: "/app/index",
    icon: Clock, x: 430, y: 140, w: 160, h: 150,
    color: "oklch(0.78 0.16 90)", roof: "oklch(0.55 0.15 90)" },
  { id: "kanban", name: "Estúdio Criativo", desc: "Kanban & fluxos", route: "/app/kanban",
    icon: Layers, x: 640, y: 140, w: 200, h: 150,
    color: "oklch(0.70 0.20 320)", roof: "oklch(0.50 0.18 320)" },
  { id: "notes", name: "Biblioteca", desc: "Notas e documentos", route: "/app/notes",
    icon: NotebookPen, x: 890, y: 140, w: 180, h: 150,
    color: "oklch(0.74 0.12 200)", roof: "oklch(0.52 0.12 200)" },
  { id: "files", name: "Arquivo Central", desc: "Central de arquivos", route: "/app/files",
    icon: FolderArchive, x: 1120, y: 140, w: 180, h: 150,
    color: "oklch(0.72 0.14 40)", roof: "oklch(0.50 0.14 40)" },

  // Linha 3 — Setores (base)
  { id: "discography", name: "Estúdio Musical", desc: "Discografia", route: "/app/discography",
    icon: Music, x: 200, y: 720, w: 200, h: 160,
    color: "oklch(0.68 0.20 330)", roof: "oklch(0.48 0.18 330)" },
  { id: "stock", name: "Galpão", desc: "Estoque", route: "/app/stock",
    icon: Package, x: 450, y: 720, w: 200, h: 160,
    color: "oklch(0.60 0.08 60)", roof: "oklch(0.40 0.10 60)" },
  { id: "finance", name: "Banco Central", desc: "Finanças", route: "/app/finance",
    icon: Wallet, x: 700, y: 720, w: 200, h: 160,
    color: "oklch(0.74 0.16 140)", roof: "oklch(0.50 0.15 140)" },
  { id: "trends", name: "Radar Estratégico", desc: "Painel de tendências", route: "/app/trends",
    icon: TrendingUp, x: 950, y: 720, w: 200, h: 160,
    color: "oklch(0.72 0.20 25)", roof: "oklch(0.52 0.18 25)" },
  { id: "calendar", name: "Praça Central", desc: "Calendário & eventos", route: "/app/calendar",
    icon: MapIcon, x: 1200, y: 720, w: 180, h: 160,
    color: "oklch(0.74 0.14 220)", roof: "oklch(0.52 0.14 220)" },
];

function dist(ax: number, ay: number, bx: number, by: number) {
  const dx = ax - bx, dy = ay - by; return Math.sqrt(dx * dx + dy * dy);
}

// Rect-circle collision check for avatar movement
function intersectsBuilding(x: number, y: number, r: number) {
  for (const p of PLACES) {
    const cx = Math.max(p.x, Math.min(x, p.x + p.w));
    const cy = Math.max(p.y, Math.min(y, p.y + p.h));
    if (dist(x, y, cx, cy) < r) return true;
  }
  return false;
}

function CityPage() {
  const navigate = useNavigate();
  const viewportRef = useRef<HTMLDivElement | null>(null);
  const avatarRef = useRef<HTMLDivElement | null>(null);
  const [hoverId, setHoverId] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [panelOpen, setPanelOpen] = useState(true);
  const [showHelp, setShowHelp] = useState(false);

  const gs = useRef({
    x: WORLD_W / 2,
    y: WORLD_H / 2 + 60,
    target: null as { x: number; y: number } | null,
    keys: { up: false, down: false, left: false, right: false },
    nearestId: null as string | null,
    scale: 1,
    camX: 0, camY: 0,
  });

  const [nearest, setNearest] = useState<Place | null>(null);

  // Keyboard controls
  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement)?.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA") return;
      const k = e.key.toLowerCase();
      if (k === "w" || k === "arrowup") gs.current.keys.up = true;
      else if (k === "s" || k === "arrowdown") gs.current.keys.down = true;
      else if (k === "a" || k === "arrowleft") gs.current.keys.left = true;
      else if (k === "d" || k === "arrowright") gs.current.keys.right = true;
      else if (k === "e" || k === "enter") {
        const id = gs.current.nearestId;
        if (id) {
          const p = PLACES.find((x) => x.id === id);
          if (p) navigate({ to: p.route });
        }
      }
      if (["w","a","s","d","arrowup","arrowdown","arrowleft","arrowright"].includes(k)) {
        gs.current.target = null;
        e.preventDefault();
      }
    };
    const up = (e: KeyboardEvent) => {
      const k = e.key.toLowerCase();
      if (k === "w" || k === "arrowup") gs.current.keys.up = false;
      else if (k === "s" || k === "arrowdown") gs.current.keys.down = false;
      else if (k === "a" || k === "arrowleft") gs.current.keys.left = false;
      else if (k === "d" || k === "arrowright") gs.current.keys.right = false;
    };
    window.addEventListener("keydown", down);
    window.addEventListener("keyup", up);
    return () => { window.removeEventListener("keydown", down); window.removeEventListener("keyup", up); };
  }, [navigate]);

  // Game loop — movement + nearest detection + camera
  useEffect(() => {
    let raf = 0;
    let lastNearest: string | null = null;
    const loop = () => {
      const g = gs.current;
      let dx = 0, dy = 0;
      if (g.keys.up) dy -= 1;
      if (g.keys.down) dy += 1;
      if (g.keys.left) dx -= 1;
      if (g.keys.right) dx += 1;

      if (dx !== 0 || dy !== 0) {
        const len = Math.hypot(dx, dy);
        dx = (dx / len) * SPEED;
        dy = (dy / len) * SPEED;
      } else if (g.target) {
        const ddx = g.target.x - g.x;
        const ddy = g.target.y - g.y;
        const d = Math.hypot(ddx, ddy);
        if (d < SPEED) { g.x = g.target.x; g.y = g.target.y; g.target = null; }
        else { dx = (ddx / d) * SPEED; dy = (ddy / d) * SPEED; }
      }

      if (dx !== 0 || dy !== 0) {
        const nx = Math.max(20, Math.min(WORLD_W - 20, g.x + dx));
        const ny = Math.max(20, Math.min(WORLD_H - 20, g.y + dy));
        // axis-separated collision
        if (!intersectsBuilding(nx, g.y, AVATAR_SIZE / 2)) g.x = nx;
        if (!intersectsBuilding(g.x, ny, AVATAR_SIZE / 2)) g.y = ny;
      }

      // nearest
      let nId: string | null = null;
      let nd = Infinity;
      for (const p of PLACES) {
        const cx = Math.max(p.x, Math.min(g.x, p.x + p.w));
        const cy = Math.max(p.y, Math.min(g.y, p.y + p.h));
        const d = dist(g.x, g.y, cx, cy);
        if (d < nd) { nd = d; if (d < INTERACT_RADIUS) nId = p.id; }
      }
      g.nearestId = nId;
      if (nId !== lastNearest) {
        lastNearest = nId;
        setNearest(nId ? PLACES.find((p) => p.id === nId) ?? null : null);
      }

      // camera follow (centra avatar quando possível)
      const vp = viewportRef.current;
      const av = avatarRef.current;
      if (av) {
        av.style.transform = `translate(${g.x - AVATAR_SIZE / 2}px, ${g.y - AVATAR_SIZE / 2}px)`;
      }
      if (vp) {
        const rect = vp.getBoundingClientRect();
        // computed scale (CSS scales world to fit)
        const scale = Math.min(rect.width / WORLD_W, rect.height / WORLD_H);
        // se há espaço extra, mapa fica centralizado — sem scroll
        if (scale < 1) {
          const targetScrollX = g.x * scale - rect.width / 2;
          const targetScrollY = g.y * scale - rect.height / 2;
          vp.scrollLeft += (targetScrollX - vp.scrollLeft) * 0.15;
          vp.scrollTop += (targetScrollY - vp.scrollTop) * 0.15;
        }
      }

      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, []);

  // Click on world → set target (move avatar). Click on building → also enter.
  const onWorldClick = useCallback((e: React.MouseEvent) => {
    const world = e.currentTarget.getBoundingClientRect();
    const x = ((e.clientX - world.left) / world.width) * WORLD_W;
    const y = ((e.clientY - world.top) / world.height) * WORLD_H;
    gs.current.target = { x, y };
  }, []);

  const enterPlace = useCallback((p: Place) => {
    navigate({ to: p.route });
  }, [navigate]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return PLACES;
    return PLACES.filter((p) =>
      p.name.toLowerCase().includes(q) || p.desc.toLowerCase().includes(q)
    );
  }, [search]);

  const teleport = (p: Place) => {
    gs.current.x = p.x + p.w / 2;
    gs.current.y = p.y + p.h + 40;
    gs.current.target = null;
  };

  return (
    <div className="relative h-[calc(100vh-4rem)] w-full overflow-hidden bg-[oklch(0.18_0.02_240)]">
      {/* Viewport */}
      <div
        ref={viewportRef}
        className="absolute inset-0 overflow-auto"
        style={{
          backgroundImage:
            "radial-gradient(circle at 20% 10%, oklch(0.25 0.04 240) 0%, oklch(0.16 0.02 240) 60%)",
        }}
      >
        <div
          className="relative origin-top-left"
          style={{
            width: WORLD_W,
            height: WORLD_H,
            // pixel-art crisp
            imageRendering: "pixelated",
          }}
          onClick={onWorldClick}
        >
          {/* ground tiles */}
          <div
            className="absolute inset-0"
            style={{
              backgroundColor: "oklch(0.30 0.04 150)",
              backgroundImage:
                "linear-gradient(oklch(0.34 0.05 150) 1px, transparent 1px), linear-gradient(90deg, oklch(0.34 0.05 150) 1px, transparent 1px)",
              backgroundSize: "32px 32px",
            }}
          />
          {/* roads */}
          <div className="absolute" style={{ left: 0, right: 0, top: 350, height: 40, background: "oklch(0.28 0.01 240)" }} />
          <div className="absolute" style={{ left: 0, right: 0, top: 620, height: 40, background: "oklch(0.28 0.01 240)" }} />
          <div className="absolute" style={{ top: 0, bottom: 0, left: 600, width: 40, background: "oklch(0.28 0.01 240)" }} />
          <div className="absolute" style={{ top: 0, bottom: 0, left: 1000, width: 40, background: "oklch(0.28 0.01 240)" }} />
          {/* road dashes */}
          {[370, 640].map((t) => (
            <div key={t} className="absolute" style={{ left: 0, right: 0, top: t, height: 2, backgroundImage: "repeating-linear-gradient(90deg, oklch(0.85 0 0) 0 16px, transparent 16px 32px)" }} />
          ))}

          {/* Praça central decoration */}
          <div className="absolute rounded-full" style={{
            left: 700, top: 470, width: 200, height: 60, background: "oklch(0.45 0.10 150)",
            boxShadow: "inset 0 0 0 4px oklch(0.55 0.10 150)",
          }} />

          {/* Buildings */}
          {PLACES.map((p) => {
            const Icon = p.icon;
            const isNear = nearest?.id === p.id;
            const isHover = hoverId === p.id;
            return (
              <div
                key={p.id}
                className="absolute cursor-pointer select-none transition-transform"
                style={{
                  left: p.x, top: p.y, width: p.w, height: p.h,
                  transform: isHover || isNear ? "translateY(-4px)" : undefined,
                  filter: isNear ? `drop-shadow(0 0 16px ${p.color})` : undefined,
                }}
                onMouseEnter={() => setHoverId(p.id)}
                onMouseLeave={() => setHoverId((v) => (v === p.id ? null : v))}
                onClick={(e) => { e.stopPropagation(); enterPlace(p); }}
              >
                {/* roof */}
                <div className="absolute left-0 right-0 top-0 h-10"
                  style={{
                    background: p.roof,
                    clipPath: "polygon(8% 100%, 0 100%, 50% 0, 100% 100%, 92% 100%)",
                  }}
                />
                {/* body */}
                <div className="absolute left-0 right-0 bottom-0"
                  style={{
                    top: 36,
                    background: `linear-gradient(180deg, ${p.color}, oklch(0.40 0.05 240))`,
                    border: "3px solid oklch(0.15 0.01 240)",
                    borderRadius: 4,
                    boxShadow: "inset 0 -8px 0 oklch(0 0 0 / 0.25)",
                  }}
                >
                  {/* windows */}
                  <div className="absolute inset-x-3 top-3 grid grid-cols-3 gap-2">
                    {Array.from({ length: 6 }).map((_, i) => (
                      <div key={i} className="aspect-square rounded-sm"
                        style={{ background: isNear ? "oklch(0.95 0.15 90)" : "oklch(0.85 0.10 220)" }}
                      />
                    ))}
                  </div>
                  {/* door */}
                  <div className="absolute left-1/2 bottom-1 -translate-x-1/2 h-8 w-8 rounded-t"
                    style={{ background: "oklch(0.25 0.05 30)" }}
                  />
                  {/* sign / icon */}
                  <div className="absolute left-1/2 -translate-x-1/2 -top-3 rounded px-1.5 py-0.5 text-[10px] font-bold flex items-center gap-1 whitespace-nowrap"
                    style={{ background: "oklch(0.18 0.02 240)", color: "oklch(0.95 0 0)", border: `2px solid ${p.color}` }}
                  >
                    <Icon className="h-3 w-3" />
                    {p.name}
                  </div>
                </div>

                {/* Tooltip on hover */}
                {(isHover || isNear) && (
                  <div className="absolute left-1/2 -translate-x-1/2 -bottom-16 z-20 w-44 rounded-md border-2 p-2 text-center text-xs shadow-xl"
                    style={{ background: "oklch(0.16 0.02 240)", color: "oklch(0.95 0 0)", borderColor: p.color }}
                  >
                    <div className="font-bold">{p.name}</div>
                    <div className="text-[10px] opacity-70 mb-1">{p.desc}</div>
                    <button
                      onClick={(e) => { e.stopPropagation(); enterPlace(p); }}
                      className="inline-flex items-center gap-1 rounded px-2 py-0.5 text-[10px] font-bold"
                      style={{ background: p.color, color: "oklch(0.15 0.01 240)" }}
                    >
                      <DoorOpen className="h-3 w-3" /> Entrar
                    </button>
                  </div>
                )}
              </div>
            );
          })}

          {/* Avatar */}
          <div
            ref={avatarRef}
            className="absolute z-30 pointer-events-none"
            style={{
              width: AVATAR_SIZE, height: AVATAR_SIZE,
              transition: "transform 60ms linear",
            }}
          >
            <div className="h-full w-full rounded-full border-2 border-white shadow-lg"
              style={{ background: "oklch(0.72 0.18 30)" }}
            />
            <div className="absolute -top-5 left-1/2 -translate-x-1/2 rounded bg-black/70 px-1.5 py-0.5 text-[9px] font-bold text-white whitespace-nowrap">
              Você
            </div>
          </div>
        </div>
      </div>

      {/* Top bar */}
      <div className="absolute top-3 left-3 right-3 z-40 flex items-center gap-2 pointer-events-none">
        <div className="rounded-lg bg-card/95 backdrop-blur px-3 py-2 shadow-lg border pointer-events-auto flex items-center gap-2">
          <MapIcon className="h-4 w-4 text-primary" />
          <span className="font-bold text-sm">Cidade PUB CORE</span>
        </div>
        <div className="ml-auto flex items-center gap-2 pointer-events-auto">
          <Button size="sm" variant="secondary" onClick={() => setShowHelp((v) => !v)}>
            <Keyboard className="h-4 w-4 mr-1" /> Atalhos
          </Button>
          <Button size="sm" variant="secondary" onClick={() => setPanelOpen((v) => !v)}>
            {panelOpen ? <X className="h-4 w-4" /> : <Search className="h-4 w-4" />}
          </Button>
        </div>
      </div>

      {/* Quick Access Panel */}
      {panelOpen && (
        <div className="absolute top-16 right-3 bottom-20 z-40 w-72 max-w-[90vw] rounded-xl border bg-card/95 backdrop-blur shadow-2xl flex flex-col overflow-hidden">
          <div className="p-3 border-b">
            <div className="text-xs font-bold uppercase opacity-70 mb-2">Acesso Rápido</div>
            <div className="relative">
              <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-4 w-4 opacity-60" />
              <Input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Buscar local..."
                className="pl-8 h-9"
              />
            </div>
          </div>
          <div className="flex-1 overflow-auto p-2 space-y-1">
            {filtered.map((p) => {
              const Icon = p.icon;
              return (
                <div key={p.id} className="flex items-center gap-2 p-2 rounded-md hover:bg-muted group">
                  <div className="h-8 w-8 rounded grid place-items-center shrink-0"
                    style={{ background: p.color, color: "oklch(0.15 0.01 240)" }}>
                    <Icon className="h-4 w-4" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="text-sm font-semibold truncate">{p.name}</div>
                    <div className="text-[11px] opacity-60 truncate">{p.desc}</div>
                  </div>
                  <div className="flex flex-col gap-1 shrink-0">
                    <button
                      onClick={() => teleport(p)}
                      className="text-[10px] px-1.5 py-0.5 rounded bg-muted hover:bg-muted/70"
                      title="Levar avatar até aqui"
                    >
                      Ir
                    </button>
                    <button
                      onClick={() => enterPlace(p)}
                      className="text-[10px] px-1.5 py-0.5 rounded bg-primary text-primary-foreground font-bold"
                    >
                      Abrir
                    </button>
                  </div>
                </div>
              );
            })}
            {filtered.length === 0 && (
              <div className="text-center text-xs opacity-60 py-8">Nenhum local encontrado.</div>
            )}
          </div>
          {/* Mini-map */}
          <div className="border-t p-3">
            <div className="text-xs font-bold uppercase opacity-70 mb-2">Mini-mapa</div>
            <div className="relative w-full rounded border bg-[oklch(0.20_0.02_240)] overflow-hidden"
              style={{ aspectRatio: `${WORLD_W} / ${WORLD_H}` }}
            >
              {PLACES.map((p) => (
                <div key={p.id} className="absolute rounded-sm"
                  style={{
                    left: `${(p.x / WORLD_W) * 100}%`,
                    top: `${(p.y / WORLD_H) * 100}%`,
                    width: `${(p.w / WORLD_W) * 100}%`,
                    height: `${(p.h / WORLD_H) * 100}%`,
                    background: p.color,
                    opacity: nearest?.id === p.id ? 1 : 0.55,
                  }}
                  title={p.name}
                />
              ))}
              <MiniMapAvatar gs={gs} />
            </div>
          </div>
        </div>
      )}

      {/* Interaction hint */}
      {nearest && (
        <div className="absolute bottom-24 left-1/2 -translate-x-1/2 z-40 rounded-full border-2 px-4 py-2 shadow-xl bg-card/95 backdrop-blur flex items-center gap-2"
          style={{ borderColor: nearest.color }}
        >
          <DoorOpen className="h-4 w-4" style={{ color: nearest.color }} />
          <span className="text-sm font-bold">{nearest.name}</span>
          <Button size="sm" className="h-7" onClick={() => enterPlace(nearest)}>
            Entrar
            <kbd className="ml-2 text-[10px] opacity-70 hidden sm:inline">E</kbd>
          </Button>
        </div>
      )}

      {/* Mobile joystick */}
      <MobileJoystick gs={gs} />

      {/* Help overlay */}
      {showHelp && (
        <div className="absolute inset-0 z-50 bg-black/60 grid place-items-center p-4" onClick={() => setShowHelp(false)}>
          <div className="rounded-xl bg-card border shadow-2xl p-5 max-w-md w-full" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-3">
              <h3 className="font-bold text-lg flex items-center gap-2"><Keyboard className="h-4 w-4" /> Como navegar</h3>
              <button onClick={() => setShowHelp(false)}><X className="h-4 w-4" /></button>
            </div>
            <ul className="text-sm space-y-2 opacity-90">
              <li>• <b>WASD</b> ou <b>setas</b> para mover o avatar</li>
              <li>• <b>Clique no mapa</b> para o avatar caminhar até o ponto</li>
              <li>• <b>Clique no prédio</b> para abrir a ferramenta direto</li>
              <li>• Pressione <b>E</b> ou <b>Enter</b> ao se aproximar para entrar</li>
              <li>• Use o <b>painel à direita</b> para busca rápida e mini-mapa</li>
            </ul>
          </div>
        </div>
      )}
    </div>
  );
}

// Subcomponent: avatar marker on minimap (uses raf to follow)
function MiniMapAvatar({ gs }: { gs: React.MutableRefObject<{ x: number; y: number } & Record<string, unknown>> }) {
  const ref = useRef<HTMLDivElement | null>(null);
  useEffect(() => {
    let raf = 0;
    const loop = () => {
      const el = ref.current;
      if (el) {
        el.style.left = `${(gs.current.x / WORLD_W) * 100}%`;
        el.style.top = `${(gs.current.y / WORLD_H) * 100}%`;
      }
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, [gs]);
  return (
    <div ref={ref} className="absolute h-2 w-2 -translate-x-1/2 -translate-y-1/2 rounded-full bg-white border border-black shadow" />
  );
}

// Subcomponent: virtual joystick for mobile
function MobileJoystick({ gs }: { gs: React.MutableRefObject<{ keys: { up: boolean; down: boolean; left: boolean; right: boolean }; target: unknown } & Record<string, unknown>> }) {
  const [active, setActive] = useState(false);
  const [knob, setKnob] = useState({ x: 0, y: 0 });
  const baseRef = useRef<HTMLDivElement | null>(null);

  const updateKeys = (dx: number, dy: number) => {
    const threshold = 12;
    gs.current.keys.left = dx < -threshold;
    gs.current.keys.right = dx > threshold;
    gs.current.keys.up = dy < -threshold;
    gs.current.keys.down = dy > threshold;
    if (dx !== 0 || dy !== 0) gs.current.target = null;
  };

  const onStart = (e: React.TouchEvent | React.MouseEvent) => {
    setActive(true);
    e.preventDefault();
  };
  const onMove = (e: React.TouchEvent | React.MouseEvent) => {
    if (!active || !baseRef.current) return;
    const rect = baseRef.current.getBoundingClientRect();
    const cx = rect.left + rect.width / 2;
    const cy = rect.top + rect.height / 2;
    const pt = "touches" in e ? e.touches[0] : (e as React.MouseEvent);
    let dx = pt.clientX - cx;
    let dy = pt.clientY - cy;
    const max = rect.width / 2;
    const d = Math.hypot(dx, dy);
    if (d > max) { dx = (dx / d) * max; dy = (dy / d) * max; }
    setKnob({ x: dx, y: dy });
    updateKeys(dx, dy);
  };
  const onEnd = () => {
    setActive(false);
    setKnob({ x: 0, y: 0 });
    updateKeys(0, 0);
  };

  return (
    <div className="absolute bottom-4 left-4 z-40 md:hidden">
      <div
        ref={baseRef}
        className="relative h-28 w-28 rounded-full bg-card/80 backdrop-blur border-2 border-border touch-none"
        onTouchStart={onStart}
        onTouchMove={onMove}
        onTouchEnd={onEnd}
        onMouseDown={onStart}
        onMouseMove={onMove}
        onMouseUp={onEnd}
        onMouseLeave={onEnd}
      >
        <div
          className="absolute left-1/2 top-1/2 h-12 w-12 -translate-x-1/2 -translate-y-1/2 rounded-full bg-primary shadow-lg"
          style={{ transform: `translate(calc(-50% + ${knob.x}px), calc(-50% + ${knob.y}px))` }}
        />
      </div>
    </div>
  );
}
