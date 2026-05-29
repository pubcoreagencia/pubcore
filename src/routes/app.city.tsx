import { createFileRoute } from "@tanstack/react-router";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Building2, X, ListChecks, Activity, Layers, Users2, MapPin,
  DoorOpen, ArrowLeft, Anchor, Trees, UtensilsCrossed, Cpu, Factory,
  ShoppingBag, Coins, Music, Keyboard,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useWorkspace } from "@/lib/workspace";
import { useAuth } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from "@/components/ui/sheet";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/app/city")({
  component: CityPage,
});

interface Company {
  id: string;
  name: string;
  color: string;
  slug: string;
}

interface CompanyStats {
  activeTasks: number;
  productiveMs: number;
  projects: number;
  collaborators: string[];
  recentTasks: { id: string; title: string; status: string }[];
}

// ============ MAP CONSTANTS ============
const WORLD_W = 3200;
const WORLD_H = 2200;
const TILE_W = 128;
const TILE_H = 64;

function toIso(x: number, y: number) {
  return { x: (x - y) * (TILE_W / 2), y: (x + y) * (TILE_H / 2) };
}

function formatHours(ms: number) {
  const h = Math.floor(ms / 3_600_000);
  const m = Math.floor((ms % 3_600_000) / 60_000);
  return h > 0 ? `${h}h ${m}m` : `${m}m`;
}

// ============ DISTRICTS (Búzios-inspired) ============
type District = {
  id: string;
  name: string;
  subtitle: string;
  icon: typeof Building2;
  companies: string[];
  color: string;
  // world rect (px)
  x: number; y: number; w: number; h: number;
};

const DISTRICTS: District[] = [
  {
    id: "admin", name: "Centro Administrativo", subtitle: "Praça Santos Dumont",
    icon: Building2, color: "oklch(0.72 0.14 250)",
    companies: ["PUB CORE", "PUB"],
    x: 1300, y: 950, w: 600, h: 400,
  },
  {
    id: "tech", name: "Vale Tech", subtitle: "Morro do Humaitá",
    icon: Cpu, color: "oklch(0.70 0.18 200)",
    companies: ["PUB IA", "PUB 3D", "PUB ADSENSE"],
    x: 1100, y: 250, w: 900, h: 450,
  },
  {
    id: "finance", name: "Distrito Financeiro", subtitle: "Centro-Oeste",
    icon: Coins, color: "oklch(0.78 0.16 90)",
    companies: ["PUB CRYPTO", "PUB IMÓVEIS"],
    x: 600, y: 900, w: 550, h: 380,
  },
  {
    id: "ent", name: "Rua das Pedras", subtitle: "Entretenimento",
    icon: Music, color: "oklch(0.65 0.22 330)",
    companies: ["PUB RECORDS", "PUB FILMS", "PUB CASSINO", "PUB LANÇAMENTOS"],
    x: 1100, y: 1450, w: 1100, h: 380,
  },
  {
    id: "food", name: "Orla Bardot", subtitle: "Gastronômico",
    icon: UtensilsCrossed, color: "oklch(0.72 0.18 40)",
    companies: ["PUB FOOD"],
    x: 350, y: 1380, w: 480, h: 280,
  },
  {
    id: "industrial", name: "Zona Industrial", subtitle: "Manguinhos",
    icon: Factory, color: "oklch(0.55 0.10 50)",
    companies: ["PUB BRICKS", "PUB TÊXTIL"],
    x: 180, y: 480, w: 520, h: 380,
  },
  {
    id: "commerce", name: "Marina & Comércio", subtitle: "Porto Búzios",
    icon: ShoppingBag, color: "oklch(0.70 0.16 160)",
    companies: ["PUB ECOM", "PUB FISHING"],
    x: 2200, y: 750, w: 550, h: 480,
  },
];

function districtOf(companyName: string): District | undefined {
  return DISTRICTS.find((d) => d.companies.includes(companyName));
}

// stable hash for deterministic positioning
function hashStr(s: string) {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0;
  return Math.abs(h);
}

// ============ ROUTE COMPONENT ============
function CityPage() {
  const { activeWorkspaceId } = useWorkspace();
  const { user } = useAuth();
  const [companies, setCompanies] = useState<Company[]>([]);
  const [stats, setStats] = useState<Record<string, CompanyStats>>({});
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<Company | null>(null);
  const [interior, setInterior] = useState<Company | null>(null);
  const [helpOpen, setHelpOpen] = useState(false);

  // ===== Refresh data =====
  const refresh = useCallback(async () => {
    if (!activeWorkspaceId) return;
    const [co, tasks, sessions, archive] = await Promise.all([
      supabase.from("stock_companies").select("id,name,color,slug").eq("workspace_id", activeWorkspaceId).order("position"),
      supabase.from("checklist_tasks").select("id,title,company,status,created_at").eq("workspace_id", activeWorkspaceId).order("created_at", { ascending: false }),
      supabase.from("ponto_sessions").select("company,productive_ms,user_name,owner_email").eq("workspace_id", activeWorkspaceId),
      supabase.from("kanban_cards_archive").select("company").eq("workspace_id", activeWorkspaceId),
    ]);
    const cs = (co.data ?? []) as Company[];
    setCompanies(cs);

    const agg: Record<string, CompanyStats> = {};
    for (const c of cs) agg[c.name] = { activeTasks: 0, productiveMs: 0, projects: 0, collaborators: [], recentTasks: [] };
    for (const t of (tasks.data ?? []) as Array<{ id: string; title: string; company: string; status: string }>) {
      const a = agg[t.company]; if (!a) continue;
      if (t.status !== "done") a.activeTasks++;
      if (a.recentTasks.length < 5) a.recentTasks.push({ id: t.id, title: t.title, status: t.status });
    }
    for (const s of (sessions.data ?? []) as Array<{ company: string | null; productive_ms: number; user_name: string | null; owner_email: string }>) {
      if (!s.company || !agg[s.company]) continue;
      agg[s.company].productiveMs += Number(s.productive_ms || 0);
      const who = s.user_name || s.owner_email;
      if (who && !agg[s.company].collaborators.includes(who)) agg[s.company].collaborators.push(who);
    }
    for (const k of (archive.data ?? []) as Array<{ company: string }>) {
      if (!agg[k.company]) continue;
      agg[k.company].projects++;
    }
    setStats(agg);
    setLoading(false);
  }, [activeWorkspaceId]);

  useEffect(() => { if (activeWorkspaceId) { setLoading(true); refresh(); } }, [activeWorkspaceId, refresh]);

  // ===== Building positions inside districts =====
  const buildings = useMemo(() => {
    const result: Array<{ c: Company; x: number; y: number; h: number; district: District }> = [];
    for (const d of DISTRICTS) {
      const list = companies.filter((c) => d.companies.includes(c.name));
      const n = Math.max(1, list.length);
      const cols = Math.min(n, Math.ceil(Math.sqrt(n) + 0.5));
      list.forEach((c, i) => {
        const gx = i % cols;
        const gy = Math.floor(i / cols);
        const pad = 80;
        const cellW = (d.w - pad * 2) / Math.max(1, cols);
        const cellH = (d.h - pad * 2) / Math.max(1, Math.ceil(n / cols));
        const jitterX = (hashStr(c.name) % 30) - 15;
        const jitterY = (hashStr(c.slug) % 30) - 15;
        const x = d.x + pad + cellW * (gx + 0.5) + jitterX;
        const y = d.y + pad + cellH * (gy + 0.5) + jitterY;
        const height = 70 + (hashStr(c.name) % 90);
        result.push({ c, x, y, h: height, district: d });
      });
    }
    return result;
  }, [companies]);

  // ===== Avatar + Camera =====
  const viewportRef = useRef<HTMLDivElement | null>(null);
  const worldRef = useRef<HTMLDivElement | null>(null);
  const avatarRef = useRef<HTMLDivElement | null>(null);
  const promptRef = useRef<HTMLDivElement | null>(null);

  // mutable game state (not React state, to avoid rerenders per frame)
  const gs = useRef({
    avatar: { x: 1600, y: 1150 }, // center of admin district
    cam: { x: 0, y: 0, scale: 0.9 },
    keys: { up: false, down: false, left: false, right: false },
    joy: { dx: 0, dy: 0, active: false },
    manualPan: false,
    nearest: null as null | { c: Company; dist: number; sx: number; sy: number },
    interiorMode: false,
    interior: { x: 400, y: 300 },
  });

  // We DO use React state for the nearest building label, but throttled
  const [nearestUI, setNearestUI] = useState<{ name: string; color: string } | null>(null);

  // ===== keyboard =====
  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      const k = e.key.toLowerCase();
      if (k === "w" || k === "arrowup") gs.current.keys.up = true;
      else if (k === "s" || k === "arrowdown") gs.current.keys.down = true;
      else if (k === "a" || k === "arrowleft") gs.current.keys.left = true;
      else if (k === "d" || k === "arrowright") gs.current.keys.right = true;
      else if (k === "e") {
        const n = gs.current.nearest;
        if (n && !gs.current.interiorMode) { enterBuilding(n.c); }
      } else if (k === "escape" && gs.current.interiorMode) { exitBuilding(); }
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
  }, []);

  // ===== animation loop =====
  useEffect(() => {
    let raf = 0;
    let last = performance.now();
    const SPEED = 220; // px/s in world coords
    const loop = (t: number) => {
      const dt = Math.min(0.05, (t - last) / 1000);
      last = t;
      const s = gs.current;

      // input
      let vx = 0, vy = 0;
      if (s.keys.up) vy -= 1;
      if (s.keys.down) vy += 1;
      if (s.keys.left) vx -= 1;
      if (s.keys.right) vx += 1;
      if (s.joy.active) { vx += s.joy.dx; vy += s.joy.dy; }
      const mag = Math.hypot(vx, vy);
      if (mag > 0) { vx /= mag; vy /= mag; }

      if (s.interiorMode) {
        s.interior.x = Math.max(40, Math.min(960, s.interior.x + vx * SPEED * dt));
        s.interior.y = Math.max(40, Math.min(560, s.interior.y + vy * SPEED * dt));
        if (avatarRef.current) {
          avatarRef.current.style.transform = `translate(${s.interior.x - 16}px, ${s.interior.y - 16}px)`;
        }
      } else {
        s.avatar.x = Math.max(40, Math.min(WORLD_W - 40, s.avatar.x + vx * SPEED * dt));
        s.avatar.y = Math.max(40, Math.min(WORLD_H - 40, s.avatar.y + vy * SPEED * dt));

        // camera follows when not manual panning, or when moving
        if (!s.manualPan || mag > 0) {
          const vp = viewportRef.current?.getBoundingClientRect();
          if (vp) {
            const targetX = vp.width / 2 - s.avatar.x * s.cam.scale;
            const targetY = vp.height / 2 - s.avatar.y * s.cam.scale;
            s.cam.x += (targetX - s.cam.x) * Math.min(1, dt * 6);
            s.cam.y += (targetY - s.cam.y) * Math.min(1, dt * 6);
          }
          s.manualPan = false;
        }

        // nearest building
        let best: typeof s.nearest = null;
        for (const b of buildings) {
          const d = Math.hypot(b.x - s.avatar.x, b.y - s.avatar.y);
          if (!best || d < best.dist) best = { c: b.c, dist: d, sx: b.x, sy: b.y };
        }
        s.nearest = best && best.dist < 110 ? best : null;

        // apply transforms
        if (worldRef.current) {
          worldRef.current.style.transform = `translate(${s.cam.x}px, ${s.cam.y}px) scale(${s.cam.scale})`;
        }
        if (avatarRef.current) {
          avatarRef.current.style.transform = `translate(${s.avatar.x - 16}px, ${s.avatar.y - 16}px)`;
        }
        if (promptRef.current) {
          if (s.nearest) {
            promptRef.current.style.display = "block";
            promptRef.current.style.transform = `translate(${s.nearest.sx - 70}px, ${s.nearest.sy - 130}px)`;
          } else {
            promptRef.current.style.display = "none";
          }
        }
      }

      // UI nearest (throttled with simple diff)
      const cur = s.nearest?.c.name ?? null;
      const prev = avatarRef.current?.dataset.near ?? null;
      if (cur !== prev) {
        if (avatarRef.current) avatarRef.current.dataset.near = cur ?? "";
        setNearestUI(s.nearest ? { name: s.nearest.c.name, color: s.nearest.c.color } : null);
      }

      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, [buildings]);

  // initial camera centering
  useEffect(() => {
    if (!viewportRef.current) return;
    const vp = viewportRef.current.getBoundingClientRect();
    gs.current.cam = {
      x: vp.width / 2 - gs.current.avatar.x * 0.9,
      y: vp.height / 2 - gs.current.avatar.y * 0.9,
      scale: 0.9,
    };
  }, []);

  // ===== pan / zoom (manual) =====
  const dragRef = useRef<{ x: number; y: number; vx: number; vy: number; moved: boolean } | null>(null);
  const onPointerDown = (e: React.PointerEvent) => {
    if ((e.target as HTMLElement).closest("[data-joystick]") || (e.target as HTMLElement).closest("[data-building-click]")) return;
    (e.target as Element).setPointerCapture?.(e.pointerId);
    dragRef.current = { x: e.clientX, y: e.clientY, vx: gs.current.cam.x, vy: gs.current.cam.y, moved: false };
  };
  const onPointerMove = (e: React.PointerEvent) => {
    if (!dragRef.current) return;
    const dx = e.clientX - dragRef.current.x;
    const dy = e.clientY - dragRef.current.y;
    if (Math.abs(dx) + Math.abs(dy) > 3) dragRef.current.moved = true;
    gs.current.cam.x = dragRef.current.vx + dx;
    gs.current.cam.y = dragRef.current.vy + dy;
    gs.current.manualPan = true;
  };
  const onPointerUp = () => { dragRef.current = null; };

  const onWheel = (e: React.WheelEvent) => {
    const delta = -e.deltaY * 0.0015;
    gs.current.cam.scale = Math.min(1.8, Math.max(0.45, gs.current.cam.scale + delta));
  };

  // ===== joystick (touch) =====
  const joyRef = useRef<HTMLDivElement | null>(null);
  const joyKnobRef = useRef<HTMLDivElement | null>(null);
  const onJoyDown = (e: React.PointerEvent) => {
    if (!joyRef.current) return;
    (e.target as Element).setPointerCapture?.(e.pointerId);
    gs.current.joy.active = true;
  };
  const onJoyMove = (e: React.PointerEvent) => {
    if (!gs.current.joy.active || !joyRef.current) return;
    const r = joyRef.current.getBoundingClientRect();
    const cx = r.left + r.width / 2;
    const cy = r.top + r.height / 2;
    const dx = e.clientX - cx;
    const dy = e.clientY - cy;
    const max = r.width / 2;
    const m = Math.hypot(dx, dy);
    const clamp = m > max ? max / m : 1;
    const kx = dx * clamp;
    const ky = dy * clamp;
    gs.current.joy.dx = kx / max;
    gs.current.joy.dy = ky / max;
    if (joyKnobRef.current) joyKnobRef.current.style.transform = `translate(${kx}px, ${ky}px)`;
  };
  const onJoyUp = () => {
    gs.current.joy.active = false;
    gs.current.joy.dx = 0; gs.current.joy.dy = 0;
    if (joyKnobRef.current) joyKnobRef.current.style.transform = "translate(0,0)";
  };

  // ===== Enter / exit buildings =====
  function enterBuilding(c: Company) {
    gs.current.interiorMode = true;
    gs.current.interior = { x: 500, y: 480 }; // start at "door" bottom-center
    setInterior(c);
  }
  function exitBuilding() {
    gs.current.interiorMode = false;
    setInterior(null);
  }

  // ===== Building click (also opens interior) =====
  const handleBuildingClick = (c: Company) => {
    if (dragRef.current?.moved) return;
    setSelected(c);
  };

  const userInitial = (user?.name || user?.email || "?").trim().charAt(0).toUpperCase();
  const primary = "oklch(0.72 0.18 250)";

  return (
    <div className="relative h-[calc(100dvh-120px)] w-full overflow-hidden rounded-xl border border-white/10 bg-gradient-to-br from-[oklch(0.14_0.02_260)] via-[oklch(0.10_0.02_240)] to-[oklch(0.07_0.02_220)]">
      {/* ===== Header overlay ===== */}
      <div className="pointer-events-none absolute left-0 right-0 top-0 z-20 flex items-center justify-between p-3">
        <div className="pointer-events-auto rounded-xl border border-white/10 bg-black/50 px-3 py-2 backdrop-blur-md">
          <div className="flex items-center gap-2 text-sm font-semibold text-white">
            <MapPin className="h-4 w-4 text-primary" />
            PUB CITY · Búzios
          </div>
          <div className="text-[10px] text-white/50">
            {loading ? "Carregando cidade…" : `${companies.length} empresas · ${DISTRICTS.length} distritos`}
          </div>
        </div>
        <div className="pointer-events-auto flex items-center gap-1 rounded-xl border border-white/10 bg-black/50 p-1 backdrop-blur-md">
          <Button size="sm" variant="ghost" className="h-7 text-white/70 hover:text-white" onClick={() => { gs.current.cam.scale = Math.max(0.45, gs.current.cam.scale - 0.15); }}>−</Button>
          <span className="px-1 text-[10px] text-white/50 tabular-nums">zoom</span>
          <Button size="sm" variant="ghost" className="h-7 text-white/70 hover:text-white" onClick={() => { gs.current.cam.scale = Math.min(1.8, gs.current.cam.scale + 0.15); }}>+</Button>
          <Button size="sm" variant="ghost" className="h-7 text-white/70 hover:text-white" onClick={() => setHelpOpen((v) => !v)}>
            <Keyboard className="h-3.5 w-3.5" />
          </Button>
        </div>
      </div>

      {/* Help bubble */}
      {helpOpen && (
        <div className="absolute right-3 top-16 z-20 w-64 rounded-xl border border-white/10 bg-black/70 p-3 text-xs text-white/80 backdrop-blur-md">
          <div className="mb-2 font-semibold text-white">Controles</div>
          <div className="space-y-1">
            <div><kbd className="rounded bg-white/10 px-1.5">W A S D</kbd> ou setas — andar</div>
            <div><kbd className="rounded bg-white/10 px-1.5">E</kbd> — entrar no prédio próximo</div>
            <div><kbd className="rounded bg-white/10 px-1.5">Esc</kbd> — sair do prédio</div>
            <div>Arraste o mapa ou use o joystick no toque.</div>
          </div>
        </div>
      )}

      {/* ===== Viewport ===== */}
      <div
        ref={viewportRef}
        className="absolute inset-0 cursor-grab touch-none active:cursor-grabbing"
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
        onWheel={onWheel}
      >
        <div
          ref={worldRef}
          className="absolute left-0 top-0 will-change-transform"
          style={{ width: WORLD_W, height: WORLD_H, transformOrigin: "0 0" }}
        >
          {/* ====== TERRAIN ====== */}
          <Terrain />

          {/* ====== Districts zones ====== */}
          {DISTRICTS.map((d) => (
            <DistrictZone key={d.id} d={d} />
          ))}

          {/* ====== Buildings ====== */}
          {buildings
            .slice()
            .sort((a, b) => a.y - b.y)
            .map(({ c, x, y, h }) => (
              <Building
                key={c.id}
                company={c}
                x={x}
                y={y}
                h={h}
                stats={stats[c.name]}
                onClick={() => handleBuildingClick(c)}
              />
            ))}

          {/* Avatar (world) */}
          <div
            ref={avatarRef}
            className="pointer-events-none absolute left-0 top-0 z-30 h-8 w-8 will-change-transform"
            style={{ transform: `translate(${gs.current.avatar.x - 16}px, ${gs.current.avatar.y - 16}px)` }}
          >
            <div className="absolute -bottom-1 left-1/2 h-2 w-7 -translate-x-1/2 rounded-full bg-black/50 blur-sm" />
            <div
              className="relative flex h-8 w-8 items-center justify-center rounded-full text-[11px] font-bold text-white shadow-lg ring-2 ring-white/60"
              style={{ background: `linear-gradient(135deg, ${primary}, oklch(0.55 0.20 280))` }}
            >
              {userInitial}
            </div>
          </div>

          {/* Enter prompt */}
          <div
            ref={promptRef}
            className="pointer-events-none absolute left-0 top-0 z-30 hidden"
          >
            <div className="rounded-md border border-white/20 bg-black/80 px-2 py-1 text-[11px] text-white shadow-lg backdrop-blur">
              <span className="font-semibold" style={{ color: nearestUI?.color }}>{nearestUI?.name}</span>
              <span className="ml-2 text-white/70">• <kbd className="rounded bg-white/10 px-1">E</kbd> entrar</span>
            </div>
          </div>

          {buildings.length === 0 && !loading && (
            <div className="absolute" style={{ left: WORLD_W / 2 - 150, top: WORLD_H / 2 }}>
              <div className="w-[300px] rounded-xl border border-white/10 bg-black/50 p-4 text-center text-sm text-white/70 backdrop-blur-md">
                Nenhuma empresa cadastrada ainda.
              </div>
            </div>
          )}
        </div>
      </div>

      {/* ===== Mobile joystick ===== */}
      <div
        data-joystick
        className="absolute bottom-4 left-4 z-20 select-none touch-none md:hidden"
      >
        <div
          ref={joyRef}
          onPointerDown={onJoyDown}
          onPointerMove={onJoyMove}
          onPointerUp={onJoyUp}
          onPointerCancel={onJoyUp}
          className="relative h-28 w-28 rounded-full border border-white/20 bg-black/40 backdrop-blur-md"
        >
          <div
            ref={joyKnobRef}
            className="absolute left-1/2 top-1/2 h-12 w-12 -translate-x-1/2 -translate-y-1/2 rounded-full bg-white/80 shadow-lg"
          />
        </div>
      </div>

      {/* Enter button (always visible if nearest) */}
      {nearestUI && !interior && (
        <button
          onClick={() => {
            const n = gs.current.nearest;
            if (n) enterBuilding(n.c);
          }}
          className="absolute bottom-6 right-6 z-20 flex items-center gap-2 rounded-full px-4 py-2 text-sm font-semibold text-white shadow-2xl backdrop-blur-md transition-all hover:scale-105"
          style={{ background: `linear-gradient(135deg, ${nearestUI.color}, color-mix(in oklab, ${nearestUI.color} 50%, black))` }}
        >
          <DoorOpen className="h-4 w-4" />
          Entrar em {nearestUI.name}
        </button>
      )}

      {/* ===== Interior overlay ===== */}
      {interior && (
        <BuildingInterior
          company={interior}
          stats={stats[interior.name]}
          onExit={exitBuilding}
          avatarRef={avatarRef}
          avatarInitial={userInitial}
          avatarColor={primary}
        />
      )}

      {/* ===== Detail Sheet (long-press / click info) ===== */}
      <Sheet open={!!selected} onOpenChange={(o) => !o && setSelected(null)}>
        <SheetContent className="w-[380px] border-l border-white/10 bg-[oklch(0.12_0.02_260)] text-white sm:max-w-[380px]">
          {selected && (
            <>
              <SheetHeader>
                <div className="flex items-center gap-3">
                  <div
                    className="flex h-12 w-12 items-center justify-center rounded-lg"
                    style={{ background: `color-mix(in oklab, ${selected.color} 35%, transparent)`, border: `1px solid ${selected.color}` }}
                  >
                    <Building2 className="h-6 w-6" style={{ color: selected.color }} />
                  </div>
                  <div>
                    <SheetTitle className="text-white">{selected.name}</SheetTitle>
                    <SheetDescription className="text-white/50">
                      {districtOf(selected.name)?.name ?? "PUB City"}
                    </SheetDescription>
                  </div>
                </div>
              </SheetHeader>

              <div className="mt-6 grid grid-cols-2 gap-3">
                <Stat icon={ListChecks} label="Tarefas ativas" value={stats[selected.name]?.activeTasks ?? 0} color={selected.color} />
                <Stat icon={Activity} label="Produtividade" value={formatHours(stats[selected.name]?.productiveMs ?? 0)} color={selected.color} />
                <Stat icon={Layers} label="Projetos" value={stats[selected.name]?.projects ?? 0} color={selected.color} />
                <Stat icon={Users2} label="Colaboradores" value={stats[selected.name]?.collaborators.length ?? 0} color={selected.color} />
              </div>

              <Button
                className="mt-4 w-full"
                style={{ background: selected.color, color: "white" }}
                onClick={() => { enterBuilding(selected); setSelected(null); }}
              >
                <DoorOpen className="mr-2 h-4 w-4" /> Entrar no prédio
              </Button>

              <Button variant="ghost" className="absolute right-3 top-3 h-7 w-7 p-0 text-white/60" onClick={() => setSelected(null)}>
                <X className="h-4 w-4" />
              </Button>
            </>
          )}
        </SheetContent>
      </Sheet>
    </div>
  );
}

// ============ TERRAIN (Búzios geography) ============
function Terrain() {
  return (
    <svg width={WORLD_W} height={WORLD_H} className="absolute left-0 top-0 pointer-events-none">
      <defs>
        <radialGradient id="sea-grad" cx="80%" cy="60%" r="80%">
          <stop offset="0%" stopColor="oklch(0.62 0.10 220)" />
          <stop offset="100%" stopColor="oklch(0.32 0.10 240)" />
        </radialGradient>
        <linearGradient id="sand-grad" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="oklch(0.92 0.06 85)" />
          <stop offset="100%" stopColor="oklch(0.82 0.07 75)" />
        </linearGradient>
        <linearGradient id="ground-grad" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="oklch(0.28 0.03 130)" />
          <stop offset="100%" stopColor="oklch(0.22 0.03 130)" />
        </linearGradient>
        <linearGradient id="hill-grad" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="oklch(0.42 0.08 145)" />
          <stop offset="100%" stopColor="oklch(0.28 0.06 145)" />
        </linearGradient>
        <pattern id="iso-grid-light" width={TILE_W} height={TILE_H} patternUnits="userSpaceOnUse">
          <path d={`M 0 ${TILE_H / 2} L ${TILE_W / 2} 0 L ${TILE_W} ${TILE_H / 2} L ${TILE_W / 2} ${TILE_H} Z`}
            fill="none" stroke="oklch(0.4 0.02 130 / 0.18)" strokeWidth="1" />
        </pattern>
      </defs>

      {/* Sea (east/south, large) */}
      <path d={`M ${WORLD_W * 0.62} 0 L ${WORLD_W} 0 L ${WORLD_W} ${WORLD_H} L ${WORLD_W * 0.28} ${WORLD_H} 
                Q ${WORLD_W * 0.45} ${WORLD_H * 0.78}, ${WORLD_W * 0.55} ${WORLD_H * 0.65}
                Q ${WORLD_W * 0.66} ${WORLD_H * 0.5}, ${WORLD_W * 0.62} 0 Z`} fill="url(#sea-grad)" />

      {/* Sea (west - marina bay) */}
      <path d={`M 0 ${WORLD_H * 0.32} L ${WORLD_W * 0.13} ${WORLD_H * 0.34}
                Q ${WORLD_W * 0.18} ${WORLD_H * 0.5}, ${WORLD_W * 0.10} ${WORLD_H * 0.62}
                L 0 ${WORLD_H * 0.66} Z`} fill="url(#sea-grad)" opacity={0.95} />

      {/* Ground island */}
      <path d={`M 0 0 L ${WORLD_W * 0.62} 0
                Q ${WORLD_W * 0.66} ${WORLD_H * 0.5}, ${WORLD_W * 0.55} ${WORLD_H * 0.65}
                Q ${WORLD_W * 0.45} ${WORLD_H * 0.78}, ${WORLD_W * 0.28} ${WORLD_H}
                L 0 ${WORLD_H}
                L 0 ${WORLD_H * 0.66}
                Q ${WORLD_W * 0.10} ${WORLD_H * 0.62}, ${WORLD_W * 0.18} ${WORLD_H * 0.5}
                Q ${WORLD_W * 0.13} ${WORLD_H * 0.34}, 0 ${WORLD_H * 0.32} Z`}
        fill="url(#ground-grad)" />

      {/* Iso grid on ground */}
      <rect width={WORLD_W} height={WORLD_H} fill="url(#iso-grid-light)" opacity={0.4} />

      {/* Beaches (sand arcs) */}
      {/* Praia de Geribá (south) */}
      <path d={`M ${WORLD_W * 0.30} ${WORLD_H - 8}
                Q ${WORLD_W * 0.40} ${WORLD_H - 80}, ${WORLD_W * 0.52} ${WORLD_H * 0.78}`}
        stroke="url(#sand-grad)" strokeWidth="70" strokeLinecap="round" fill="none" />
      {/* Praia da Ferradura (east) */}
      <path d={`M ${WORLD_W * 0.60} ${WORLD_H * 0.55}
                Q ${WORLD_W * 0.52} ${WORLD_H * 0.62}, ${WORLD_W * 0.55} ${WORLD_H * 0.72}`}
        stroke="url(#sand-grad)" strokeWidth="55" strokeLinecap="round" fill="none" />
      {/* Praia João Fernandes (NE) */}
      <path d={`M ${WORLD_W * 0.62} ${WORLD_H * 0.08}
                Q ${WORLD_W * 0.58} ${WORLD_H * 0.18}, ${WORLD_W * 0.62} ${WORLD_H * 0.28}`}
        stroke="url(#sand-grad)" strokeWidth="50" strokeLinecap="round" fill="none" />

      {/* Marina pier (west) */}
      <g>
        <rect x={WORLD_W * 0.10} y={WORLD_H * 0.46} width={WORLD_W * 0.06} height={14}
          fill="oklch(0.40 0.04 60)" />
        <rect x={WORLD_W * 0.08} y={WORLD_H * 0.50} width={WORLD_W * 0.04} height={14}
          fill="oklch(0.40 0.04 60)" />
        {/* boats */}
        {[0, 1, 2].map((i) => (
          <g key={i} transform={`translate(${WORLD_W * 0.06 + i * 30}, ${WORLD_H * 0.55 + i * 12})`}>
            <path d="M 0 0 L 24 0 L 20 8 L 4 8 Z" fill="oklch(0.85 0.02 60)" />
            <rect x="10" y="-12" width="4" height="12" fill="oklch(0.40 0.04 60)" />
          </g>
        ))}
      </g>

      {/* Hills/morros north (silhouettes) */}
      <g opacity={0.85}>
        <path d={`M 200 ${WORLD_H * 0.05} Q 500 ${WORLD_H * 0.01}, 800 ${WORLD_H * 0.06} T 1500 ${WORLD_H * 0.05} T 2400 ${WORLD_H * 0.07}`}
          fill="url(#hill-grad)" stroke="oklch(0.5 0.10 145 / 0.3)" />
        <path d={`M 300 ${WORLD_H * 0.04} Q 600 ${WORLD_H * 0.10}, 900 ${WORLD_H * 0.06} T 1700 ${WORLD_H * 0.08} T 2300 ${WORLD_H * 0.04} L 2300 0 L 300 0 Z`}
          fill="oklch(0.20 0.04 145)" opacity={0.7} />
        {/* trees dots */}
        {Array.from({ length: 24 }).map((_, i) => {
          const x = 220 + i * 95 + ((i * 37) % 50);
          const y = WORLD_H * 0.06 + ((i * 19) % 30);
          return <circle key={i} cx={x} cy={y} r={6} fill="oklch(0.38 0.10 150)" />;
        })}
      </g>

      {/* Rua das Pedras - diagonal cobble street */}
      <path d={`M ${WORLD_W * 0.32} ${WORLD_H * 0.74} L ${WORLD_W * 0.70} ${WORLD_H * 0.66}`}
        stroke="oklch(0.50 0.03 60)" strokeWidth="44" strokeLinecap="round" />
      <path d={`M ${WORLD_W * 0.32} ${WORLD_H * 0.74} L ${WORLD_W * 0.70} ${WORLD_H * 0.66}`}
        stroke="oklch(0.62 0.04 60 / 0.6)" strokeWidth="40" strokeLinecap="round" strokeDasharray="4 6" />

      {/* Orla Bardot — curved promenade */}
      <path d={`M ${WORLD_W * 0.10} ${WORLD_H * 0.62}
                Q ${WORLD_W * 0.25} ${WORLD_H * 0.74}, ${WORLD_W * 0.40} ${WORLD_H * 0.72}`}
        stroke="oklch(0.55 0.04 80)" strokeWidth="34" fill="none" strokeLinecap="round" />

      {/* Praça Santos Dumont — central plaza */}
      <g transform={`translate(${WORLD_W * 0.50}, ${WORLD_H * 0.55})`}>
        <circle r="80" fill="oklch(0.42 0.04 100)" />
        <circle r="80" fill="none" stroke="oklch(0.60 0.05 100 / 0.4)" strokeWidth="2" />
        <circle r="30" fill="oklch(0.50 0.06 130)" />
        <circle r="4" fill="oklch(0.75 0.10 60)" />
      </g>

      {/* Connecting roads (subtle) */}
      {[
        [WORLD_W * 0.50, WORLD_H * 0.55, WORLD_W * 0.50, WORLD_H * 0.20], // to tech
        [WORLD_W * 0.50, WORLD_H * 0.55, WORLD_W * 0.25, WORLD_H * 0.50], // to finance
        [WORLD_W * 0.50, WORLD_H * 0.55, WORLD_W * 0.18, WORLD_H * 0.28], // to industrial
        [WORLD_W * 0.50, WORLD_H * 0.55, WORLD_W * 0.78, WORLD_H * 0.50], // to commerce
        [WORLD_W * 0.50, WORLD_H * 0.55, WORLD_W * 0.50, WORLD_H * 0.72], // to ent
        [WORLD_W * 0.50, WORLD_H * 0.55, WORLD_W * 0.20, WORLD_H * 0.68], // to food
      ].map(([x1, y1, x2, y2], i) => (
        <line key={i} x1={x1} y1={y1} x2={x2} y2={y2}
          stroke="oklch(0.42 0.03 100 / 0.5)" strokeWidth="14" strokeLinecap="round" />
      ))}

      {/* Labels on the map */}
      <g fill="oklch(0.85 0.05 220)" fontFamily="ui-sans-serif" fontWeight={700}>
        <text x={WORLD_W * 0.80} y={WORLD_H * 0.45} fontSize="34" opacity={0.5} letterSpacing="6">OCEANO</text>
        <text x={WORLD_W * 0.80} y={WORLD_H * 0.49} fontSize="14" opacity={0.4} letterSpacing="8">ATLÂNTICO</text>
      </g>
      <g fill="oklch(0.85 0.10 80)" fontFamily="ui-sans-serif" fontWeight={600} opacity={0.55}>
        <text x={WORLD_W * 0.40} y={WORLD_H - 16} fontSize="14" letterSpacing="3">PRAIA DE GERIBÁ</text>
        <text x={WORLD_W * 0.56} y={WORLD_H * 0.68} fontSize="12" letterSpacing="3">FERRADURA</text>
        <text x={WORLD_W * 0.59} y={WORLD_H * 0.20} fontSize="12" letterSpacing="3">JOÃO FERNANDES</text>
        <text x={WORLD_W * 0.07} y={WORLD_H * 0.44} fontSize="13" letterSpacing="3">MARINA</text>
      </g>
    </svg>
  );
}

// ============ DISTRICT ZONE ============
function DistrictZone({ d }: { d: District }) {
  const Icon = d.icon;
  return (
    <div
      className="pointer-events-none absolute"
      style={{ left: d.x, top: d.y, width: d.w, height: d.h }}
    >
      <div
        className="absolute inset-0 rounded-[40px]"
        style={{
          background: `radial-gradient(ellipse at center, color-mix(in oklab, ${d.color} 18%, transparent), transparent 70%)`,
          border: `1px dashed color-mix(in oklab, ${d.color} 40%, transparent)`,
        }}
      />
      <div
        className="absolute -top-3 left-4 flex items-center gap-1.5 rounded-full border px-2 py-0.5 text-[10px] font-bold tracking-wider backdrop-blur"
        style={{
          background: "rgba(0,0,0,0.55)",
          color: d.color,
          borderColor: `color-mix(in oklab, ${d.color} 60%, transparent)`,
        }}
      >
        <Icon className="h-3 w-3" />
        {d.name.toUpperCase()}
        <span className="text-white/40 font-normal">· {d.subtitle}</span>
      </div>
    </div>
  );
}

// ============ Stat card ============
function Stat({ icon: Icon, label, value, color }: { icon: typeof Building2; label: string; value: number | string; color: string }) {
  return (
    <div className="rounded-lg border border-white/10 bg-white/5 p-3">
      <Icon className="mb-2 h-4 w-4" style={{ color }} />
      <div className="text-xs text-white/50">{label}</div>
      <div className="text-lg font-semibold tabular-nums text-white">{value}</div>
    </div>
  );
}

// ============ BUILDING (isometric) ============
function Building({ company, x, y, h, stats, onClick }: { company: Company; x: number; y: number; h: number; stats?: CompanyStats; onClick: () => void }) {
  const color = company.color || "oklch(0.72 0.16 220)";
  const w = TILE_W * 0.78;
  const d = TILE_H * 0.78;
  const active = (stats?.activeTasks ?? 0) > 0;

  return (
    <div
      data-building-click
      className={cn("group absolute cursor-pointer transition-transform hover:-translate-y-1")}
      style={{ left: x - w / 2, top: y - h }}
      onClick={(e) => { e.stopPropagation(); onClick(); }}
    >
      <svg width={w} height={h + d} style={{ overflow: "visible", filter: "drop-shadow(0 12px 24px rgba(0,0,0,0.6))" }}>
        <polygon
          points={`0,${d / 2} ${w / 2},${d} ${w / 2},${d + h} 0,${d / 2 + h}`}
          fill={`color-mix(in oklab, ${color} 55%, black)`}
          stroke={color}
          strokeWidth="1"
        />
        <polygon
          points={`${w / 2},${d} ${w},${d / 2} ${w},${d / 2 + h} ${w / 2},${d + h}`}
          fill={`color-mix(in oklab, ${color} 75%, black)`}
          stroke={color}
          strokeWidth="1"
        />
        <polygon
          points={`0,${d / 2} ${w / 2},0 ${w},${d / 2} ${w / 2},${d}`}
          fill={color}
          stroke="oklch(0.95 0.02 260 / 0.4)"
          strokeWidth="1"
        />
        {Array.from({ length: Math.max(2, Math.floor(h / 22)) }).map((_, row) => (
          <g key={row}>
            <rect x={6} y={d / 2 + 10 + row * 22} width={w / 2 - 14} height={10} fill="oklch(0.92 0.12 80 / 0.6)" opacity={active && row % 2 === 0 ? 1 : 0.35} />
            <rect x={w / 2 + 6} y={d / 2 + 10 + row * 22} width={w / 2 - 12} height={10} fill="oklch(0.92 0.12 80 / 0.45)" opacity={active && row % 2 === 1 ? 1 : 0.3} />
          </g>
        ))}
        {/* door */}
        <rect x={w / 2 - 9} y={h + d - 18} width={18} height={18} fill={`color-mix(in oklab, ${color} 30%, black)`} stroke={color} strokeWidth="0.5" />
      </svg>

      <div className="pointer-events-none absolute left-1/2 top-[-30px] -translate-x-1/2 whitespace-nowrap">
        <div
          className="rounded-md border px-2 py-0.5 text-[10px] font-semibold backdrop-blur-md"
          style={{ background: "rgba(0,0,0,0.55)", borderColor: color, color }}
        >
          {company.name}
        </div>
      </div>

      {active && (
        <div className="pointer-events-none absolute left-1/2 top-[-8px] h-2 w-2 -translate-x-1/2 rounded-full"
          style={{ background: color, boxShadow: `0 0 12px ${color}` }} />
      )}
    </div>
  );
}

// ============ INTERIOR (top-down sectors) ============
function BuildingInterior({
  company, stats, onExit, avatarRef, avatarInitial, avatarColor,
}: {
  company: Company;
  stats?: CompanyStats;
  onExit: () => void;
  avatarRef: React.RefObject<HTMLDivElement | null>;
  avatarInitial: string;
  avatarColor: string;
}) {
  const color = company.color || "oklch(0.72 0.16 220)";

  const sectors = [
    { id: "reception", title: "Recepção", x: 420, y: 60, w: 200, h: 120, icon: Building2, content: <>Bem-vindo à <b>{company.name}</b><div className="mt-1 text-white/50 text-[10px]">{districtOf(company.name)?.name}</div></> },
    { id: "tasks", title: "Mesa de Tarefas", x: 60, y: 60, w: 320, h: 200, icon: ListChecks, content: (
      <>
        <div className="text-2xl font-bold tabular-nums">{stats?.activeTasks ?? 0}</div>
        <div className="text-[10px] uppercase tracking-wider text-white/50">ativas</div>
        <ul className="mt-2 space-y-1 text-[11px] text-white/80">
          {(stats?.recentTasks ?? []).slice(0, 4).map((t) => (
            <li key={t.id} className="flex items-center gap-1.5 truncate">
              <span className={cn("h-1.5 w-1.5 rounded-full", t.status === "done" ? "bg-emerald-400" : "bg-amber-400")} />
              <span className="truncate">{t.title}</span>
            </li>
          ))}
          {(!stats || stats.recentTasks.length === 0) && <li className="text-white/40">Sem tarefas registradas.</li>}
        </ul>
      </>
    ) },
    { id: "ponto", title: "Sala do Ponto", x: 660, y: 60, w: 280, h: 200, icon: Activity, content: (
      <>
        <div className="text-2xl font-bold tabular-nums">{formatHours(stats?.productiveMs ?? 0)}</div>
        <div className="text-[10px] uppercase tracking-wider text-white/50">produtividade total</div>
        <div className="mt-2 text-[11px] text-white/70">{stats?.collaborators.length ?? 0} colaborador(es)</div>
      </>
    ) },
    { id: "projects", title: "Sala de Projetos", x: 60, y: 320, w: 380, h: 200, icon: Layers, content: (
      <>
        <div className="text-2xl font-bold tabular-nums">{stats?.projects ?? 0}</div>
        <div className="text-[10px] uppercase tracking-wider text-white/50">projetos arquivados</div>
      </>
    ) },
    { id: "team", title: "Sala da Equipe", x: 480, y: 320, w: 460, h: 200, icon: Users2, content: (
      <>
        <div className="text-[10px] uppercase tracking-wider text-white/50 mb-1.5">colaboradores</div>
        <div className="flex flex-wrap gap-1.5">
          {(stats?.collaborators ?? []).slice(0, 12).map((n) => (
            <div key={n} className="flex items-center gap-1.5 rounded-md bg-white/10 px-2 py-1 text-[10px] text-white/80">
              <div className="h-5 w-5 rounded-full text-center text-[10px] leading-5" style={{ background: color }}>
                {n.charAt(0).toUpperCase()}
              </div>
              {n}
            </div>
          ))}
          {(!stats || stats.collaborators.length === 0) && <span className="text-[11px] text-white/40">Nenhuma sessão registrada.</span>}
        </div>
      </>
    ) },
  ];

  return (
    <div
      className="absolute inset-0 z-40 animate-in fade-in zoom-in-95 duration-200"
      style={{
        background: `linear-gradient(135deg, color-mix(in oklab, ${color} 12%, oklch(0.08 0.02 260)), oklch(0.06 0.02 260))`,
      }}
    >
      {/* Header */}
      <div className="absolute left-0 right-0 top-0 z-10 flex items-center justify-between p-3">
        <div className="flex items-center gap-2 rounded-xl border border-white/10 bg-black/50 px-3 py-2 backdrop-blur-md">
          <div className="flex h-8 w-8 items-center justify-center rounded-md" style={{ background: color }}>
            <Building2 className="h-4 w-4 text-white" />
          </div>
          <div>
            <div className="text-sm font-semibold text-white">{company.name}</div>
            <div className="text-[10px] text-white/50">Interior · {districtOf(company.name)?.name}</div>
          </div>
        </div>
        <Button onClick={onExit} variant="ghost" className="rounded-xl border border-white/10 bg-black/50 text-white/80 backdrop-blur-md hover:text-white">
          <ArrowLeft className="mr-1 h-4 w-4" /> Sair
        </Button>
      </div>

      {/* Floor plan area */}
      <div className="absolute inset-0 flex items-center justify-center p-12 pt-20">
        <div
          className="relative h-full max-h-[640px] w-full max-w-[1040px] rounded-2xl border-2"
          style={{
            background: `repeating-linear-gradient(45deg, color-mix(in oklab, ${color} 6%, oklch(0.12 0.02 260)) 0 14px, color-mix(in oklab, ${color} 9%, oklch(0.10 0.02 260)) 14px 28px)`,
            borderColor: `color-mix(in oklab, ${color} 60%, transparent)`,
            boxShadow: `0 0 80px color-mix(in oklab, ${color} 25%, transparent) inset`,
          }}
        >
          {sectors.map((s) => {
            const Icon = s.icon;
            return (
              <div
                key={s.id}
                className="absolute rounded-lg border bg-black/40 p-3 backdrop-blur-sm"
                style={{
                  left: s.x, top: s.y, width: s.w, height: s.h,
                  borderColor: `color-mix(in oklab, ${color} 50%, transparent)`,
                  boxShadow: `0 6px 18px color-mix(in oklab, ${color} 20%, transparent)`,
                }}
              >
                <div className="mb-1 flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wider" style={{ color }}>
                  <Icon className="h-3 w-3" />
                  {s.title}
                </div>
                <div className="text-white text-xs">{s.content}</div>
              </div>
            );
          })}

          {/* Door bottom */}
          <div
            className="absolute -bottom-1 left-1/2 h-6 w-24 -translate-x-1/2 rounded-t-md border-t-2 text-center text-[10px] font-semibold uppercase tracking-wider"
            style={{ background: color, borderColor: color, color: "white", lineHeight: "20px" }}
          >
            Saída
          </div>

          {/* Avatar inside */}
          <div
            ref={avatarRef}
            className="pointer-events-none absolute left-0 top-0 h-8 w-8 will-change-transform"
          >
            <div className="absolute -bottom-1 left-1/2 h-2 w-7 -translate-x-1/2 rounded-full bg-black/50 blur-sm" />
            <div
              className="relative flex h-8 w-8 items-center justify-center rounded-full text-[11px] font-bold text-white shadow-lg ring-2 ring-white/60"
              style={{ background: `linear-gradient(135deg, ${avatarColor}, oklch(0.55 0.20 280))` }}
            >
              {avatarInitial}
            </div>
          </div>
        </div>
      </div>

      {/* Hints */}
      <div className="pointer-events-none absolute bottom-3 left-1/2 -translate-x-1/2 rounded-full border border-white/10 bg-black/60 px-3 py-1 text-[10px] text-white/60 backdrop-blur">
        <kbd className="rounded bg-white/10 px-1.5">W A S D</kbd> andar · <kbd className="rounded bg-white/10 px-1.5">Esc</kbd> sair
      </div>

      {/* Decorative beach elements for orla / marina vibe based on district */}
      <DecorativeIcons district={districtOf(company.name)?.id} />
    </div>
  );
}

function DecorativeIcons({ district }: { district?: string }) {
  if (district === "commerce" || district === "food") {
    return <Anchor className="pointer-events-none absolute right-6 bottom-12 h-20 w-20 text-white/5" />;
  }
  if (district === "tech") {
    return <Cpu className="pointer-events-none absolute right-6 bottom-12 h-20 w-20 text-white/5" />;
  }
  if (district === "industrial") {
    return <Factory className="pointer-events-none absolute right-6 bottom-12 h-20 w-20 text-white/5" />;
  }
  return <Trees className="pointer-events-none absolute right-6 bottom-12 h-20 w-20 text-white/5" />;
}
