import { createFileRoute } from "@tanstack/react-router";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Building2, X, ListChecks, Activity, Layers, Users2, MapPin } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useWorkspace } from "@/lib/workspace";
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
}

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

function CityPage() {
  const { activeWorkspaceId } = useWorkspace();
  const [companies, setCompanies] = useState<Company[]>([]);
  const [stats, setStats] = useState<Record<string, CompanyStats>>({});
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<Company | null>(null);

  // viewport pan/zoom
  const [view, setView] = useState({ x: 0, y: 0, scale: 1 });
  const viewportRef = useRef<HTMLDivElement | null>(null);
  const dragRef = useRef<{ x: number; y: number; vx: number; vy: number; moved: boolean } | null>(null);

  const refresh = useCallback(async () => {
    if (!activeWorkspaceId) return;
    const [co, tasks, sessions, archive, members] = await Promise.all([
      supabase.from("stock_companies").select("id,name,color,slug").eq("workspace_id", activeWorkspaceId).order("position"),
      supabase.from("checklist_tasks").select("company,status").eq("workspace_id", activeWorkspaceId),
      supabase.from("ponto_sessions").select("company,productive_ms,user_name,owner_email").eq("workspace_id", activeWorkspaceId),
      supabase.from("kanban_cards_archive").select("company").eq("workspace_id", activeWorkspaceId),
    ]);
    const cs = (co.data ?? []) as Company[];
    setCompanies(cs);

    const agg: Record<string, CompanyStats> = {};
    for (const c of cs) agg[c.name] = { activeTasks: 0, productiveMs: 0, projects: 0, collaborators: [] };
    for (const t of (tasks.data ?? []) as Array<{ company: string; status: string }>) {
      if (!agg[t.company]) continue;
      if (t.status !== "done") agg[t.company].activeTasks++;
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

  useEffect(() => {
    if (!activeWorkspaceId) return;
    setLoading(true);
    refresh();
  }, [activeWorkspaceId, refresh]);

  // center map initially
  useEffect(() => {
    if (!viewportRef.current || companies.length === 0) return;
    const r = viewportRef.current.getBoundingClientRect();
    setView({ x: r.width / 2, y: r.height / 3, scale: 1 });
  }, [companies.length]);

  const buildings = useMemo(() => {
    // arrange in grid 4 cols
    const cols = Math.min(4, Math.max(2, Math.ceil(Math.sqrt(companies.length || 1))));
    return companies.map((c, i) => {
      const gx = i % cols;
      const gy = Math.floor(i / cols);
      const p = toIso(gx, gy);
      const height = 60 + ((i * 17) % 80);
      return { c, x: p.x, y: p.y, h: height };
    });
  }, [companies]);

  const onPointerDown = (e: React.PointerEvent) => {
    (e.target as Element).setPointerCapture?.(e.pointerId);
    dragRef.current = { x: e.clientX, y: e.clientY, vx: view.x, vy: view.y, moved: false };
  };
  const onPointerMove = (e: React.PointerEvent) => {
    if (!dragRef.current) return;
    const dx = e.clientX - dragRef.current.x;
    const dy = e.clientY - dragRef.current.y;
    if (Math.abs(dx) + Math.abs(dy) > 4) dragRef.current.moved = true;
    setView((v) => ({ ...v, x: dragRef.current!.vx + dx, y: dragRef.current!.vy + dy }));
  };
  const onPointerUp = () => { dragRef.current = null; };

  const onWheel = (e: React.WheelEvent) => {
    const delta = -e.deltaY * 0.0015;
    setView((v) => ({ ...v, scale: Math.min(2, Math.max(0.4, v.scale + delta)) }));
  };

  const handleBuildingClick = (c: Company) => {
    if (dragRef.current?.moved) return;
    setSelected(c);
  };

  return (
    <div className="relative h-[calc(100dvh-120px)] w-full overflow-hidden bg-gradient-to-br from-[oklch(0.14_0.02_260)] via-[oklch(0.11_0.02_260)] to-[oklch(0.08_0.02_260)]">
      {/* Header overlay */}
      <div className="pointer-events-none absolute left-0 right-0 top-0 z-10 flex items-center justify-between p-4">
        <div className="pointer-events-auto rounded-xl border border-white/10 bg-black/40 px-3 py-2 backdrop-blur-md">
          <div className="flex items-center gap-2 text-sm font-semibold text-white">
            <MapPin className="h-4 w-4 text-primary" />
            PUB CITY
          </div>
          <div className="text-[10px] text-white/50">
            {loading ? "Carregando cidade..." : `${companies.length} empresa${companies.length === 1 ? "" : "s"} na holding`}
          </div>
        </div>
        <div className="pointer-events-auto flex items-center gap-1 rounded-xl border border-white/10 bg-black/40 p-1 backdrop-blur-md">
          <Button size="sm" variant="ghost" className="h-7 text-white/70 hover:text-white" onClick={() => setView((v) => ({ ...v, scale: Math.max(0.4, v.scale - 0.15) }))}>−</Button>
          <span className="px-1 text-[10px] text-white/50 tabular-nums">{Math.round(view.scale * 100)}%</span>
          <Button size="sm" variant="ghost" className="h-7 text-white/70 hover:text-white" onClick={() => setView((v) => ({ ...v, scale: Math.min(2, v.scale + 0.15) }))}>+</Button>
        </div>
      </div>

      {/* Ground / Map */}
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
          className="absolute left-0 top-0"
          style={{ transform: `translate(${view.x}px, ${view.y}px) scale(${view.scale})`, transformOrigin: "0 0" }}
        >
          {/* Grid floor */}
          <svg
            width="2000"
            height="1400"
            style={{ position: "absolute", left: -1000, top: -200, pointerEvents: "none" }}
          >
            <defs>
              <pattern id="iso-grid" width={TILE_W} height={TILE_H} patternUnits="userSpaceOnUse">
                <path d={`M 0 ${TILE_H / 2} L ${TILE_W / 2} 0 L ${TILE_W} ${TILE_H / 2} L ${TILE_W / 2} ${TILE_H} Z`} fill="none" stroke="oklch(0.3 0.02 260 / 0.35)" strokeWidth="1" />
              </pattern>
            </defs>
            <rect width="2000" height="1400" fill="url(#iso-grid)" />
          </svg>

          {/* Buildings */}
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

          {buildings.length === 0 && !loading && (
            <div className="absolute" style={{ left: -150, top: 0, width: 300 }}>
              <div className="rounded-xl border border-white/10 bg-black/40 p-4 text-center text-sm text-white/70 backdrop-blur-md">
                Nenhuma empresa cadastrada ainda.
                <br />
                <span className="text-xs text-white/40">Crie empresas em Estoque para vê-las na cidade.</span>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Detail panel */}
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
                    <SheetDescription className="text-white/50">Painel da operação</SheetDescription>
                  </div>
                </div>
              </SheetHeader>

              <div className="mt-6 grid grid-cols-2 gap-3">
                <Stat icon={ListChecks} label="Tarefas ativas" value={stats[selected.name]?.activeTasks ?? 0} color={selected.color} />
                <Stat icon={Activity} label="Produtividade" value={formatHours(stats[selected.name]?.productiveMs ?? 0)} color={selected.color} />
                <Stat icon={Layers} label="Projetos" value={stats[selected.name]?.projects ?? 0} color={selected.color} />
                <Stat icon={Users2} label="Colaboradores" value={stats[selected.name]?.collaborators.length ?? 0} color={selected.color} />
              </div>

              <div className="mt-6">
                <div className="mb-2 text-xs font-semibold uppercase tracking-wider text-white/40">Equipe</div>
                <div className="space-y-1">
                  {(stats[selected.name]?.collaborators ?? []).length === 0 && (
                    <div className="text-xs text-white/40">Nenhuma sessão registrada ainda.</div>
                  )}
                  {(stats[selected.name]?.collaborators ?? []).map((name) => (
                    <div key={name} className="flex items-center gap-2 rounded-md bg-white/5 px-2 py-1.5 text-xs text-white/80">
                      <div className="h-6 w-6 rounded-full text-center text-[10px] leading-6" style={{ background: selected.color }}>
                        {name.slice(0, 1).toUpperCase()}
                      </div>
                      {name}
                    </div>
                  ))}
                </div>
              </div>

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

function Stat({ icon: Icon, label, value, color }: { icon: typeof Building2; label: string; value: number | string; color: string }) {
  return (
    <div className="rounded-lg border border-white/10 bg-white/5 p-3">
      <Icon className="mb-2 h-4 w-4" style={{ color }} />
      <div className="text-xs text-white/50">{label}</div>
      <div className="text-lg font-semibold tabular-nums text-white">{value}</div>
    </div>
  );
}

function Building({ company, x, y, h, stats, onClick }: { company: Company; x: number; y: number; h: number; stats?: CompanyStats; onClick: () => void }) {
  const color = company.color || "oklch(0.72 0.16 220)";
  const w = TILE_W * 0.8;
  const d = TILE_H * 0.8;
  const active = (stats?.activeTasks ?? 0) > 0;

  return (
    <div
      className={cn("group absolute cursor-pointer transition-transform hover:-translate-y-1")}
      style={{ left: x - w / 2, top: y - h }}
      onClick={(e) => { e.stopPropagation(); onClick(); }}
    >
      <svg width={w} height={h + d} style={{ overflow: "visible", filter: "drop-shadow(0 12px 24px rgba(0,0,0,0.6))" }}>
        {/* Left face */}
        <polygon
          points={`0,${d / 2} ${w / 2},${d} ${w / 2},${d + h} 0,${d / 2 + h}`}
          fill={`color-mix(in oklab, ${color} 55%, black)`}
          stroke={color}
          strokeWidth="1"
        />
        {/* Right face */}
        <polygon
          points={`${w / 2},${d} ${w},${d / 2} ${w},${d / 2 + h} ${w / 2},${d + h}`}
          fill={`color-mix(in oklab, ${color} 75%, black)`}
          stroke={color}
          strokeWidth="1"
        />
        {/* Top face */}
        <polygon
          points={`0,${d / 2} ${w / 2},0 ${w},${d / 2} ${w / 2},${d}`}
          fill={color}
          stroke="oklch(0.95 0.02 260 / 0.4)"
          strokeWidth="1"
        />
        {/* Windows */}
        {Array.from({ length: Math.max(2, Math.floor(h / 22)) }).map((_, row) => (
          <g key={row}>
            <rect x={6} y={d / 2 + 10 + row * 22} width={w / 2 - 14} height={10} fill="oklch(0.92 0.12 80 / 0.6)" opacity={active && row % 2 === 0 ? 1 : 0.35} />
            <rect x={w / 2 + 6} y={d / 2 + 10 + row * 22} width={w / 2 - 12} height={10} fill="oklch(0.92 0.12 80 / 0.45)" opacity={active && row % 2 === 1 ? 1 : 0.3} />
          </g>
        ))}
      </svg>

      {/* Label */}
      <div className="pointer-events-none absolute left-1/2 top-[-32px] -translate-x-1/2 whitespace-nowrap">
        <div
          className="rounded-md border px-2 py-0.5 text-[11px] font-semibold backdrop-blur-md"
          style={{ background: "rgba(0,0,0,0.5)", borderColor: color, color }}
        >
          {company.name}
        </div>
      </div>

      {/* Active pulse */}
      {active && (
        <div className="pointer-events-none absolute left-1/2 top-[-8px] h-2 w-2 -translate-x-1/2 rounded-full" style={{ background: color, boxShadow: `0 0 12px ${color}` }} />
      )}
    </div>
  );
}
