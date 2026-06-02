import { createFileRoute } from "@tanstack/react-router";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Building2, X, ListChecks, Activity, Layers, Users2, MapPin,
  DoorOpen, ArrowLeft, Anchor, Trees, UtensilsCrossed, Cpu, Factory,
  ShoppingBag, Coins, Music, Keyboard, Circle, Wifi,
  Megaphone, Briefcase, Wrench, DollarSign, Coffee, Send, MessageSquare,
  Sparkles, Clock,
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

interface ActivityItem {
  id: string;
  kind: "task" | "session";
  text: string;
  ts: number;
}

interface CompanyStats {
  activeTasks: number;
  pendingTasks: number;
  productiveMs: number;
  projects: number;
  collaborators: string[];
  recentTasks: { id: string; title: string; status: string }[];
  recentActivities: ActivityItem[];
}

interface ChatMsg {
  text: string;
  ts: number;
}

interface PresencePayload {
  id: string;
  name: string;
  role: string;
  email: string;
  x: number;        // world x in outdoor
  y: number;
  ix: number;       // interior x
  iy: number;
  company: string | null;
  sector: string | null;
  color: string;
  msg: ChatMsg | null;
  ts: number;
}

// ============ MAP CONSTANTS ============
const WORLD_W = 3200;
const WORLD_H = 2200;
const TILE_W = 128;
const TILE_H = 64;
const INTERIOR_W = 1040;
const INTERIOR_H = 640;
const CHAT_TTL = 6000;
const PROX_RADIUS_OUT = 180;
const PROX_RADIUS_IN = 200;

function formatHours(ms: number) {
  const h = Math.floor(ms / 3_600_000);
  const m = Math.floor((ms % 3_600_000) / 60_000);
  return h > 0 ? `${h}h ${m}m` : `${m}m`;
}

function timeAgo(ts: number) {
  const s = Math.max(1, Math.floor((Date.now() - ts) / 1000));
  if (s < 60) return `${s}s`;
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h`;
  return `${Math.floor(h / 24)}d`;
}

function hashStr(s: string) {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0;
  return Math.abs(h);
}

function colorForUser(id: string) {
  const palette = [
    "oklch(0.72 0.18 250)", "oklch(0.72 0.18 30)", "oklch(0.72 0.18 140)",
    "oklch(0.72 0.18 330)", "oklch(0.72 0.18 80)", "oklch(0.72 0.18 200)",
    "oklch(0.72 0.18 280)", "oklch(0.72 0.18 10)",
  ];
  return palette[hashStr(id) % palette.length];
}

// ============ DISTRICTS (Búzios-inspired) ============
type District = {
  id: string;
  name: string;
  subtitle: string;
  icon: typeof Building2;
  companies: string[];
  color: string;
  x: number; y: number; w: number; h: number;
};

const DISTRICTS: District[] = [
  { id: "admin", name: "Centro Administrativo", subtitle: "Praça Santos Dumont", icon: Building2, color: "oklch(0.72 0.14 250)", companies: ["PUB CORE", "PUB"], x: 1300, y: 950, w: 600, h: 400 },
  { id: "tech", name: "Vale Tech", subtitle: "Morro do Humaitá", icon: Cpu, color: "oklch(0.70 0.18 200)", companies: ["PUB IA", "PUB 3D", "PUB ADSENSE"], x: 1100, y: 250, w: 900, h: 450 },
  { id: "finance", name: "Distrito Financeiro", subtitle: "Centro-Oeste", icon: Coins, color: "oklch(0.78 0.16 90)", companies: ["PUB CRYPTO", "PUB IMÓVEIS"], x: 600, y: 900, w: 550, h: 380 },
  { id: "ent", name: "Rua das Pedras", subtitle: "Entretenimento", icon: Music, color: "oklch(0.65 0.22 330)", companies: ["PUB RECORDS", "PUB FILMS", "PUB CASSINO", "PUB LANÇAMENTOS"], x: 1100, y: 1450, w: 1100, h: 380 },
  { id: "food", name: "Orla Bardot", subtitle: "Gastronômico", icon: UtensilsCrossed, color: "oklch(0.72 0.18 40)", companies: ["PUB FOOD"], x: 350, y: 1380, w: 480, h: 280 },
  { id: "industrial", name: "Zona Industrial", subtitle: "Manguinhos", icon: Factory, color: "oklch(0.55 0.10 50)", companies: ["PUB BRICKS", "PUB TÊXTIL"], x: 180, y: 480, w: 520, h: 380 },
  { id: "commerce", name: "Marina & Comércio", subtitle: "Porto Búzios", icon: ShoppingBag, color: "oklch(0.70 0.16 160)", companies: ["PUB ECOM", "PUB FISHING"], x: 2200, y: 750, w: 550, h: 480 },
];

function districtOf(companyName: string): District | undefined {
  return DISTRICTS.find((d) => d.companies.includes(companyName));
}

// ============ STANDARD WORKSTATIONS ============
// Each company shares the same operational layout so users always know where to go.
const STANDARD_SECTORS = [
  "Marketing",
  "Comercial",
  "Sala de Reunião",
  "Produção",
  "Financeiro",
  "Operação",
  "Recepção",
] as const;
type SectorName = (typeof STANDARD_SECTORS)[number];

const SECTOR_ICON: Record<SectorName, typeof Building2> = {
  "Marketing": Megaphone,
  "Comercial": Briefcase,
  "Sala de Reunião": Users2,
  "Produção": Wrench,
  "Financeiro": DollarSign,
  "Operação": Activity,
  "Recepção": Coffee,
};

const SECTOR_HINT: Record<SectorName, string> = {
  "Marketing": "Campanhas, conteúdo e branding",
  "Comercial": "Pipeline, propostas e fechamentos",
  "Sala de Reunião": "Encontros e alinhamentos",
  "Produção": "Execução, entregas e operações criativas",
  "Financeiro": "Receita, despesas e fluxo",
  "Operação": "Processos, suporte e bastidores",
  "Recepção": "Boas-vindas e visão geral",
};

function sectorsOf(_name: string): SectorName[] {
  return [...STANDARD_SECTORS];
}

// 3x2 + bottom strip (Recepção). Returns rects keyed by sector name.
function sectorRects(sectors: SectorName[]): Array<{ x: number; y: number; w: number; h: number; name: SectorName }> {
  const pad = 22;
  const recH = 70;
  const usableH = INTERIOR_H - pad * 3 - 60 - recH; // 60 for "saída" strip
  const colW = (INTERIOR_W - pad * 4) / 3;
  const rowH = (usableH - pad) / 2;
  const pos = (col: number, row: number) => ({
    x: pad + col * (colW + pad),
    y: pad + row * (rowH + pad),
    w: colW,
    h: rowH,
  });
  const slots: Record<SectorName, { x: number; y: number; w: number; h: number }> = {
    "Marketing":       pos(0, 0),
    "Comercial":       pos(1, 0),
    "Sala de Reunião": pos(2, 0),
    "Produção":        pos(0, 1),
    "Financeiro":      pos(1, 1),
    "Operação":        pos(2, 1),
    "Recepção":        { x: pad, y: pad * 2 + rowH * 2, w: INTERIOR_W - pad * 2, h: recH },
  };
  return sectors.map((name) => ({ ...slots[name], name }));
}

// ============ COMPANY AMBIENCE THEME ============
// Subtle per-company personality without changing data — pattern angle & accent.
function themeOf(name: string) {
  const h = hashStr(name);
  const angle = (h % 8) * 22; // 0..154°
  const tile = 14 + (h % 12);
  const accent = h % 3; // emoji-like accent decoration
  return { angle, tile, accent };
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
  const [remote, setRemote] = useState<PresencePayload[]>([]);
  const [proximityUser, setProximityUser] = useState<PresencePayload | null>(null);
  const [selfSector, setSelfSector] = useState<SectorName | null>(null);

  // Chat state
  const [chatOpen, setChatOpen] = useState(false);
  const [chatText, setChatText] = useState("");
  const [myMsg, setMyMsg] = useState<ChatMsg | null>(null);
  const [chatTick, setChatTick] = useState(0); // forces re-render to expire bubbles

  // ===== Refresh aggregated company data =====
  const refresh = useCallback(async () => {
    if (!activeWorkspaceId) return;
    const [co, tasks, sessions, archive] = await Promise.all([
      supabase.from("stock_companies").select("id,name,color,slug").eq("workspace_id", activeWorkspaceId).order("position"),
      supabase.from("checklist_tasks").select("id,title,company,status,created_at,done_at").eq("workspace_id", activeWorkspaceId).is("funnel_id", null).order("created_at", { ascending: false }).limit(400),
      supabase.from("ponto_sessions").select("company,productive_ms,user_name,owner_email,started_at,ended_at").eq("workspace_id", activeWorkspaceId).order("started_at", { ascending: false }).limit(200),
      supabase.from("kanban_cards_archive").select("company").eq("workspace_id", activeWorkspaceId),
    ]);
    const cs = (co.data ?? []) as Company[];
    setCompanies(cs);
    const agg: Record<string, CompanyStats> = {};
    for (const c of cs) agg[c.name] = {
      activeTasks: 0, pendingTasks: 0, productiveMs: 0, projects: 0,
      collaborators: [], recentTasks: [], recentActivities: [],
    };
    for (const t of (tasks.data ?? []) as Array<{ id: string; title: string; company: string; status: string; created_at: string; done_at: string | null }>) {
      const a = agg[t.company]; if (!a) continue;
      if (t.status !== "done") { a.activeTasks++; if (t.status === "pending") a.pendingTasks++; }
      if (a.recentTasks.length < 6) a.recentTasks.push({ id: t.id, title: t.title, status: t.status });
      a.recentActivities.push({
        id: `t-${t.id}`,
        kind: "task",
        text: t.status === "done" ? `Tarefa concluída: ${t.title}` : `Nova tarefa: ${t.title}`,
        ts: new Date(t.done_at || t.created_at).getTime(),
      });
    }
    for (const s of (sessions.data ?? []) as Array<{ company: string | null; productive_ms: number; user_name: string | null; owner_email: string; started_at: string; ended_at: string | null }>) {
      if (!s.company || !agg[s.company]) continue;
      agg[s.company].productiveMs += Number(s.productive_ms || 0);
      const who = s.user_name || s.owner_email;
      if (who && !agg[s.company].collaborators.includes(who)) agg[s.company].collaborators.push(who);
      agg[s.company].recentActivities.push({
        id: `s-${s.started_at}-${s.owner_email}`,
        kind: "session",
        text: `${who} ${s.ended_at ? "fechou ponto" : "iniciou ponto"}`,
        ts: new Date(s.ended_at || s.started_at).getTime(),
      });
    }
    for (const k of (archive.data ?? []) as Array<{ company: string }>) {
      if (!agg[k.company]) continue;
      agg[k.company].projects++;
    }
    // sort activities & cap
    for (const k of Object.keys(agg)) {
      agg[k].recentActivities.sort((a, b) => b.ts - a.ts);
      agg[k].recentActivities = agg[k].recentActivities.slice(0, 8);
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

  // ===== Game state =====
  const viewportRef = useRef<HTMLDivElement | null>(null);
  const worldRef = useRef<HTMLDivElement | null>(null);
  const avatarOutRef = useRef<HTMLDivElement | null>(null);
  const avatarInRef = useRef<HTMLDivElement | null>(null);
  const promptRef = useRef<HTMLDivElement | null>(null);
  const interiorRef = useRef<Company | null>(null);
  interiorRef.current = interior;

  const gs = useRef({
    avatar: { x: 1600, y: 1150 },
    target: null as { x: number; y: number } | null,
    cam: { x: 0, y: 0, scale: 0.9 },
    keys: { up: false, down: false, left: false, right: false },
    joy: { dx: 0, dy: 0, active: false },
    manualPan: false,
    nearest: null as null | { c: Company; dist: number; sx: number; sy: number },
    interior: { x: INTERIOR_W / 2, y: INTERIOR_H - 60 },
    interiorTarget: null as { x: number; y: number } | null,
  });

  const [nearestUI, setNearestUI] = useState<{ name: string; color: string } | null>(null);

  // chat bubble expiration tick
  useEffect(() => {
    const t = setInterval(() => setChatTick((v) => v + 1), 1000);
    return () => clearInterval(t);
  }, []);

  // expire myMsg locally so I broadcast a cleared msg
  useEffect(() => {
    if (!myMsg) return;
    const t = setTimeout(() => setMyMsg(null), CHAT_TTL + 50);
    return () => clearTimeout(t);
  }, [myMsg]);

  // ===== keyboard =====
  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement)?.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA") return;
      const k = e.key.toLowerCase();
      if (k === "w" || k === "arrowup") gs.current.keys.up = true;
      else if (k === "s" || k === "arrowdown") gs.current.keys.down = true;
      else if (k === "a" || k === "arrowleft") gs.current.keys.left = true;
      else if (k === "d" || k === "arrowright") gs.current.keys.right = true;
      else if (k === "e") {
        const n = gs.current.nearest;
        if (n && !interiorRef.current) enterBuilding(n.c);
      } else if (k === "t") { e.preventDefault(); setChatOpen((v) => !v); }
      else if (k === "escape") { if (chatOpen) setChatOpen(false); else if (interiorRef.current) exitBuilding(); }
      if (["w","a","s","d","arrowup","arrowdown","arrowleft","arrowright"].includes(k)) {
        gs.current.target = null;
        gs.current.interiorTarget = null;
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
  }, [chatOpen]);

  // ===== Realtime presence =====
  const channelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);
  const lastTrackRef = useRef(0);
  const myMsgRef = useRef<ChatMsg | null>(null);
  myMsgRef.current = myMsg;

  useEffect(() => {
    if (!activeWorkspaceId || !user) return;
    const myColor = colorForUser(user.id);
    const ch = supabase.channel(`pub-city:${activeWorkspaceId}`, {
      config: { presence: { key: user.id } },
    });
    channelRef.current = ch;

    ch.on("presence", { event: "sync" }, () => {
      const state = ch.presenceState() as Record<string, PresencePayload[]>;
      const others: PresencePayload[] = [];
      for (const [uid, arr] of Object.entries(state)) {
        if (uid === user.id) continue;
        const last = arr[arr.length - 1];
        if (last) others.push(last);
      }
      setRemote(others);
    });

    ch.subscribe(async (status) => {
      if (status === "SUBSCRIBED") {
        await ch.track({
          id: user.id, name: user.name, role: user.role || "Membro", email: user.email,
          x: gs.current.avatar.x, y: gs.current.avatar.y,
          ix: gs.current.interior.x, iy: gs.current.interior.y,
          company: null, sector: null, color: myColor, msg: null, ts: Date.now(),
        } satisfies PresencePayload);
      }
    });

    return () => { ch.unsubscribe(); channelRef.current = null; };
  }, [activeWorkspaceId, user]);

  const computeSelfSector = useCallback((): SectorName | null => {
    const cur = interiorRef.current;
    if (!cur) return null;
    const rects = sectorRects([...STANDARD_SECTORS]);
    const ix = gs.current.interior.x;
    const iy = gs.current.interior.y;
    for (const r of rects) {
      if (ix >= r.x && ix <= r.x + r.w && iy >= r.y && iy <= r.y + r.h) return r.name;
    }
    return null;
  }, []);

  const trackPresence = useCallback((force = false) => {
    const ch = channelRef.current;
    if (!ch || !user) return;
    const now = Date.now();
    if (!force && now - lastTrackRef.current < 300) return;
    lastTrackRef.current = now;
    const cur = interiorRef.current;
    const sector = computeSelfSector();
    const msg = myMsgRef.current && now - myMsgRef.current.ts < CHAT_TTL ? myMsgRef.current : null;
    ch.track({
      id: user.id, name: user.name, role: user.role || "Membro", email: user.email,
      x: gs.current.avatar.x, y: gs.current.avatar.y,
      ix: gs.current.interior.x, iy: gs.current.interior.y,
      company: cur?.name ?? null, sector, color: colorForUser(user.id), msg, ts: now,
    } satisfies PresencePayload);
  }, [user, computeSelfSector]);

  // re-track immediately when myMsg changes (send/clear)
  useEffect(() => { trackPresence(true); }, [myMsg, trackPresence]);

  // ===== animation loop =====
  useEffect(() => {
    let raf = 0;
    let last = performance.now();
    const SPEED = 230;
    const loop = (t: number) => {
      const dt = Math.min(0.05, (t - last) / 1000);
      last = t;
      const s = gs.current;
      const inInterior = !!interiorRef.current;

      let vx = 0, vy = 0;
      if (s.keys.up) vy -= 1;
      if (s.keys.down) vy += 1;
      if (s.keys.left) vx -= 1;
      if (s.keys.right) vx += 1;
      if (s.joy.active) { vx += s.joy.dx; vy += s.joy.dy; }

      const tgt = inInterior ? s.interiorTarget : s.target;
      if (tgt && vx === 0 && vy === 0) {
        const pos = inInterior ? s.interior : s.avatar;
        const dx = tgt.x - pos.x;
        const dy = tgt.y - pos.y;
        const d = Math.hypot(dx, dy);
        if (d < 4) { if (inInterior) s.interiorTarget = null; else s.target = null; }
        else { vx = dx / d; vy = dy / d; }
      }
      const mag = Math.hypot(vx, vy);
      if (mag > 1) { vx /= mag; vy /= mag; }

      if (inInterior) {
        s.interior.x = Math.max(20, Math.min(INTERIOR_W - 20, s.interior.x + vx * SPEED * dt));
        s.interior.y = Math.max(20, Math.min(INTERIOR_H - 20, s.interior.y + vy * SPEED * dt));
        if (avatarInRef.current) {
          avatarInRef.current.style.transform = `translate(${s.interior.x - 16}px, ${s.interior.y - 16}px)`;
        }
      } else {
        s.avatar.x = Math.max(40, Math.min(WORLD_W - 40, s.avatar.x + vx * SPEED * dt));
        s.avatar.y = Math.max(40, Math.min(WORLD_H - 40, s.avatar.y + vy * SPEED * dt));

        if (!s.manualPan || mag > 0) {
          const vp = viewportRef.current?.getBoundingClientRect();
          if (vp) {
            const tx = vp.width / 2 - s.avatar.x * s.cam.scale;
            const ty = vp.height / 2 - s.avatar.y * s.cam.scale;
            s.cam.x += (tx - s.cam.x) * Math.min(1, dt * 6);
            s.cam.y += (ty - s.cam.y) * Math.min(1, dt * 6);
          }
          s.manualPan = false;
        }

        let best: typeof s.nearest = null;
        for (const b of buildings) {
          const d = Math.hypot(b.x - s.avatar.x, b.y - s.avatar.y);
          if (!best || d < best.dist) best = { c: b.c, dist: d, sx: b.x, sy: b.y };
        }
        s.nearest = best && best.dist < 110 ? best : null;

        if (worldRef.current) worldRef.current.style.transform = `translate(${s.cam.x}px, ${s.cam.y}px) scale(${s.cam.scale})`;
        if (avatarOutRef.current) avatarOutRef.current.style.transform = `translate(${s.avatar.x - 16}px, ${s.avatar.y - 16}px)`;
        if (promptRef.current) {
          if (s.nearest) {
            promptRef.current.style.display = "block";
            promptRef.current.style.transform = `translate(${s.nearest.sx - 70}px, ${s.nearest.sy - 130}px)`;
          } else {
            promptRef.current.style.display = "none";
          }
        }
      }

      const cur = s.nearest?.c.name ?? null;
      const prev = avatarOutRef.current?.dataset.near ?? null;
      if (cur !== prev) {
        if (avatarOutRef.current) avatarOutRef.current.dataset.near = cur ?? "";
        setNearestUI(s.nearest ? { name: s.nearest.c.name, color: s.nearest.c.color } : null);
      }

      if (mag > 0 || s.target || s.interiorTarget) trackPresence();

      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, [buildings, trackPresence]);

  // heartbeat & self-sector + proximity polling
  useEffect(() => {
    const t = setInterval(() => {
      trackPresence();
      setSelfSector(computeSelfSector());
      const s = gs.current;
      const inInterior = !!interiorRef.current;
      const curCo = interiorRef.current?.name ?? null;
      let best: PresencePayload | null = null;
      let bestD = inInterior ? PROX_RADIUS_IN : PROX_RADIUS_OUT;
      for (const r of remote) {
        if (inInterior) {
          if (r.company !== curCo) continue;
          const d = Math.hypot(r.ix - s.interior.x, r.iy - s.interior.y);
          if (d < bestD) { bestD = d; best = r; }
        } else {
          if (r.company) continue;
          const d = Math.hypot(r.x - s.avatar.x, r.y - s.avatar.y);
          if (d < bestD) { bestD = d; best = r; }
        }
      }
      setProximityUser((prev) => (prev?.id === best?.id ? prev : best));
    }, 300);
    return () => clearInterval(t);
  }, [remote, trackPresence, computeSelfSector]);

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
  const onPointerUp = (e: React.PointerEvent) => {
    const wasDrag = dragRef.current?.moved;
    dragRef.current = null;
    if (wasDrag) return;
    const vp = viewportRef.current?.getBoundingClientRect();
    if (!vp) return;
    const wx = (e.clientX - vp.left - gs.current.cam.x) / gs.current.cam.scale;
    const wy = (e.clientY - vp.top - gs.current.cam.y) / gs.current.cam.scale;
    gs.current.target = { x: wx, y: wy };
  };

  const onWheel = (e: React.WheelEvent) => {
    const delta = -e.deltaY * 0.0015;
    gs.current.cam.scale = Math.min(1.8, Math.max(0.45, gs.current.cam.scale + delta));
  };

  // ===== joystick =====
  const joyRef = useRef<HTMLDivElement | null>(null);
  const joyKnobRef = useRef<HTMLDivElement | null>(null);
  const onJoyDown = (e: React.PointerEvent) => {
    if (!joyRef.current) return;
    (e.target as Element).setPointerCapture?.(e.pointerId);
    gs.current.joy.active = true;
    gs.current.target = null; gs.current.interiorTarget = null;
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

  function enterBuilding(c: Company) {
    gs.current.interior = { x: INTERIOR_W / 2, y: INTERIOR_H - 60 };
    gs.current.interiorTarget = null;
    setInterior(c);
    setTimeout(() => trackPresence(true), 50);
  }
  function exitBuilding() {
    setInterior(null);
    setTimeout(() => trackPresence(true), 50);
  }

  const handleBuildingClick = (c: Company) => {
    if (dragRef.current?.moved) return;
    setSelected(c);
  };

  const sendChat = () => {
    const text = chatText.trim().slice(0, 140);
    if (!text) return;
    setMyMsg({ text, ts: Date.now() });
    setChatText("");
  };

  const userInitial = (user?.name || user?.email || "?").trim().charAt(0).toUpperCase();
  const myColor = user ? colorForUser(user.id) : "oklch(0.72 0.18 250)";

  const onlineList = useMemo(() => {
    const list: Array<{ id: string; name: string; role: string; company: string | null; sector: string | null; color: string; self?: boolean }> = [];
    if (user) list.push({ id: user.id, name: user.name + " (você)", role: user.role || "Membro", company: interior?.name ?? null, sector: selfSector, color: myColor, self: true });
    for (const r of remote) list.push({ id: r.id, name: r.name, role: r.role, company: r.company, sector: r.sector, color: r.color });
    return list;
  }, [remote, user, interior, myColor, selfSector]);

  const remoteOutdoor = remote.filter((r) => !r.company);
  const remoteIndoor = remote.filter((r) => interior && r.company === interior.name);

  // proximity chat: only show bubbles from users near me
  const visibleBubbles = useMemo(() => {
    const now = Date.now();
    const s = gs.current;
    const inInterior = !!interior;
    return remote.filter((r) => {
      if (!r.msg || now - r.msg.ts > CHAT_TTL) return false;
      if (inInterior) {
        if (r.company !== interior?.name) return false;
        return Math.hypot(r.ix - s.interior.x, r.iy - s.interior.y) < 280;
      }
      if (r.company) return false;
      return Math.hypot(r.x - s.avatar.x, r.y - s.avatar.y) < 260;
    });
    // chatTick re-renders every 1s to expire bubbles
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [remote, interior, chatTick]);

  return (
    <div className="relative h-[calc(100dvh-120px)] w-full overflow-hidden rounded-xl border border-white/10 bg-gradient-to-br from-[oklch(0.14_0.02_260)] via-[oklch(0.10_0.02_240)] to-[oklch(0.07_0.02_220)]">
      {/* Header */}
      <div className="pointer-events-none absolute left-0 right-0 top-0 z-20 flex items-center justify-between p-3">
        <div className="pointer-events-auto rounded-xl border border-white/10 bg-black/50 px-3 py-2 backdrop-blur-md">
          <div className="flex items-center gap-2 text-sm font-semibold text-white">
            <MapPin className="h-4 w-4 text-primary" />
            PUB CITY · Búzios
          </div>
          <div className="text-[10px] text-white/50">
            {loading ? "Carregando cidade…" : `${companies.length} empresas · ${onlineList.length} online`}
          </div>
        </div>
        <div className="pointer-events-auto flex items-center gap-1 rounded-xl border border-white/10 bg-black/50 p-1 backdrop-blur-md">
          <Button size="sm" variant="ghost" className="h-7 text-white/70 hover:text-white" onClick={() => { gs.current.cam.scale = Math.max(0.45, gs.current.cam.scale - 0.15); }}>−</Button>
          <span className="px-1 text-[10px] text-white/50 tabular-nums">zoom</span>
          <Button size="sm" variant="ghost" className="h-7 text-white/70 hover:text-white" onClick={() => { gs.current.cam.scale = Math.min(1.8, gs.current.cam.scale + 0.15); }}>+</Button>
          <Button size="sm" variant="ghost" className="h-7 text-white/70 hover:text-white" onClick={() => setChatOpen((v) => !v)} title="Chat (T)">
            <MessageSquare className="h-3.5 w-3.5" />
          </Button>
          <Button size="sm" variant="ghost" className="h-7 text-white/70 hover:text-white" onClick={() => setHelpOpen((v) => !v)}>
            <Keyboard className="h-3.5 w-3.5" />
          </Button>
        </div>
      </div>

      {helpOpen && (
        <div className="absolute right-3 top-16 z-20 w-64 rounded-xl border border-white/10 bg-black/70 p-3 text-xs text-white/80 backdrop-blur-md">
          <div className="mb-2 font-semibold text-white">Controles</div>
          <div className="space-y-1">
            <div><kbd className="rounded bg-white/10 px-1.5">W A S D</kbd> ou setas — andar</div>
            <div><span className="rounded bg-white/10 px-1.5">Clique</span> no mapa — mover até o ponto</div>
            <div><kbd className="rounded bg-white/10 px-1.5">E</kbd> — entrar no prédio próximo</div>
            <div><kbd className="rounded bg-white/10 px-1.5">T</kbd> — abrir chat de proximidade</div>
            <div><kbd className="rounded bg-white/10 px-1.5">Esc</kbd> — sair / fechar</div>
          </div>
        </div>
      )}

      {/* Online panel */}
      <div className="pointer-events-none absolute left-3 top-20 z-20 hidden md:block">
        <div className="pointer-events-auto w-56 rounded-xl border border-white/10 bg-black/50 p-2 backdrop-blur-md">
          <div className="mb-1.5 flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wider text-white/70">
            <Wifi className="h-3 w-3 text-emerald-400" /> Online · {onlineList.length}
          </div>
          <div className="max-h-64 space-y-1 overflow-auto pr-1">
            {onlineList.map((u) => (
              <div key={u.id} className={cn("flex items-center gap-2 rounded-md px-1.5 py-1 text-[11px]", u.self ? "bg-white/10" : "hover:bg-white/5")}>
                <div className="relative">
                  <div className="flex h-5 w-5 items-center justify-center rounded-full text-[9px] font-bold text-white" style={{ background: u.color }}>{u.name.charAt(0).toUpperCase()}</div>
                  <Circle className="absolute -bottom-0.5 -right-0.5 h-2 w-2 fill-emerald-400 text-emerald-400" />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="truncate text-white">{u.name}</div>
                  <div className="truncate text-[9px] text-white/40">
                    {u.company ? <>em <span style={{ color: "oklch(0.85 0.10 200)" }}>{u.company}</span>{u.sector ? ` · ${u.sector}` : ""}</> : <>{u.role} · na cidade</>}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Viewport */}
      <div
        ref={viewportRef}
        className="absolute inset-0 cursor-grab touch-none active:cursor-grabbing"
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={() => { dragRef.current = null; }}
        onWheel={onWheel}
      >
        <div ref={worldRef} className="absolute left-0 top-0 will-change-transform" style={{ width: WORLD_W, height: WORLD_H, transformOrigin: "0 0" }}>
          <Terrain />

          {DISTRICTS.map((d) => <DistrictZone key={d.id} d={d} />)}

          {buildings.slice().sort((a, b) => a.y - b.y).map(({ c, x, y, h }) => (
            <Building key={c.id} company={c} x={x} y={y} h={h} stats={stats[c.name]} onClick={() => handleBuildingClick(c)} />
          ))}

          <ClickMarker getTarget={() => gs.current.target} />

          {/* Remote bubbles outdoor */}
          {visibleBubbles.filter((r) => !r.company).map((r) => (
            <SpeechBubbleAt key={`b-${r.id}`} x={r.x} y={r.y - 36} text={r.msg!.text} color={r.color} />
          ))}

          {/* Remote avatars outdoor */}
          {remoteOutdoor.map((r) => (
            <RemoteAvatar key={r.id} payload={r} />
          ))}

          {/* My avatar */}
          <div ref={avatarOutRef} className="pointer-events-none absolute left-0 top-0 z-30 h-8 w-8 will-change-transform" style={{ transform: `translate(${gs.current.avatar.x - 16}px, ${gs.current.avatar.y - 16}px)` }}>
            <AvatarChip name={user?.name ?? "Você"} initial={userInitial} color={myColor} self bubble={!interior && myMsg && Date.now() - myMsg.ts < CHAT_TTL ? myMsg.text : null} />
          </div>

          <div ref={promptRef} className="pointer-events-none absolute left-0 top-0 z-30 hidden">
            <div className="rounded-md border border-white/20 bg-black/80 px-2 py-1 text-[11px] text-white shadow-lg backdrop-blur">
              <span className="font-semibold" style={{ color: nearestUI?.color }}>{nearestUI?.name}</span>
              <span className="ml-2 text-white/70">• <kbd className="rounded bg-white/10 px-1">E</kbd> entrar</span>
            </div>
          </div>
        </div>
      </div>

      {/* Joystick */}
      <div data-joystick className="absolute bottom-4 left-4 z-20 select-none touch-none md:hidden">
        <div ref={joyRef} onPointerDown={onJoyDown} onPointerMove={onJoyMove} onPointerUp={onJoyUp} onPointerCancel={onJoyUp} className="relative h-28 w-28 rounded-full border border-white/20 bg-black/40 backdrop-blur-md">
          <div ref={joyKnobRef} className="absolute left-1/2 top-1/2 h-12 w-12 -translate-x-1/2 -translate-y-1/2 rounded-full bg-white/80 shadow-lg" />
        </div>
      </div>

      {/* Enter button */}
      {nearestUI && !interior && (
        <button
          onClick={() => { const n = gs.current.nearest; if (n) enterBuilding(n.c); }}
          className="absolute bottom-6 right-6 z-20 flex items-center gap-2 rounded-full px-4 py-2 text-sm font-semibold text-white shadow-2xl backdrop-blur-md transition-all hover:scale-105"
          style={{ background: `linear-gradient(135deg, ${nearestUI.color}, color-mix(in oklab, ${nearestUI.color} 50%, black))` }}
        >
          <DoorOpen className="h-4 w-4" />
          Entrar em {nearestUI.name}
        </button>
      )}

      {/* Proximity card */}
      {proximityUser && (
        <div className="pointer-events-none absolute bottom-20 left-1/2 z-30 -translate-x-1/2 rounded-xl border border-white/20 bg-black/80 px-4 py-2 text-xs text-white shadow-2xl backdrop-blur-md">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-full text-sm font-bold text-white" style={{ background: proximityUser.color }}>
              {proximityUser.name.charAt(0).toUpperCase()}
            </div>
            <div>
              <div className="font-semibold">{proximityUser.name}</div>
              <div className="text-[10px] text-white/60">
                {proximityUser.role}
                {proximityUser.company && <> · em <span style={{ color: "oklch(0.85 0.10 200)" }}>{proximityUser.company}</span>{proximityUser.sector ? ` · ${proximityUser.sector}` : ""}</>}
              </div>
              <div className="mt-1 flex gap-1.5 text-[9px] uppercase tracking-wider text-white/40">
                <span className="rounded bg-emerald-400/10 px-1.5 py-0.5 text-emerald-300">chat ativo · T</span>
                <span className="rounded bg-white/5 px-1.5 py-0.5">voz (em breve)</span>
                <span className="rounded bg-white/5 px-1.5 py-0.5">reunião (em breve)</span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Chat input — proximity local */}
      {chatOpen && (
        <div className="absolute bottom-6 left-1/2 z-40 w-[min(440px,90vw)] -translate-x-1/2 rounded-2xl border border-white/15 bg-black/80 p-2 shadow-2xl backdrop-blur-xl">
          <div className="mb-1 flex items-center justify-between px-1 text-[10px] uppercase tracking-wider text-white/50">
            <span className="flex items-center gap-1"><MessageSquare className="h-3 w-3" /> Chat local · alcança quem está por perto</span>
            <button onClick={() => setChatOpen(false)} className="text-white/40 hover:text-white"><X className="h-3 w-3" /></button>
          </div>
          <div className="flex items-center gap-2">
            <input
              autoFocus
              value={chatText}
              onChange={(e) => setChatText(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); sendChat(); } if (e.key === "Escape") setChatOpen(false); }}
              maxLength={140}
              placeholder="Diga algo… (Enter envia)"
              className="flex-1 rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-white placeholder:text-white/30 focus:border-white/30 focus:outline-none"
            />
            <Button size="sm" onClick={sendChat} className="bg-primary text-primary-foreground hover:bg-primary/90">
              <Send className="h-3.5 w-3.5" />
            </Button>
          </div>
        </div>
      )}

      {/* Interior overlay */}
      {interior && (
        <BuildingInterior
          company={interior}
          stats={stats[interior.name]}
          onExit={exitBuilding}
          avatarRef={avatarInRef}
          avatarInitial={userInitial}
          avatarColor={myColor}
          myMsg={myMsg && Date.now() - myMsg.ts < CHAT_TTL ? myMsg : null}
          remote={remoteIndoor}
          visibleBubbles={visibleBubbles.filter((r) => r.company === interior.name)}
          onClickFloor={(x, y) => { gs.current.interiorTarget = { x, y }; }}
          selfSector={selfSector}
        />
      )}

      {/* Detail Sheet */}
      <Sheet open={!!selected} onOpenChange={(o) => !o && setSelected(null)}>
        <SheetContent className="w-[420px] border-l border-white/10 bg-[oklch(0.12_0.02_260)] text-white sm:max-w-[420px]">
          {selected && (
            <>
              <SheetHeader>
                <div className="flex items-center gap-3">
                  <div className="flex h-12 w-12 items-center justify-center rounded-lg" style={{ background: `color-mix(in oklab, ${selected.color} 35%, transparent)`, border: `1px solid ${selected.color}` }}>
                    <Building2 className="h-6 w-6" style={{ color: selected.color }} />
                  </div>
                  <div>
                    <SheetTitle className="text-white">{selected.name}</SheetTitle>
                    <SheetDescription className="text-white/50">{districtOf(selected.name)?.name ?? "PUB City"}</SheetDescription>
                  </div>
                </div>
              </SheetHeader>

              <div className="mt-6 grid grid-cols-2 gap-3">
                <Stat icon={ListChecks} label="Tarefas ativas" value={stats[selected.name]?.activeTasks ?? 0} color={selected.color} />
                <Stat icon={Activity} label="Produtividade" value={formatHours(stats[selected.name]?.productiveMs ?? 0)} color={selected.color} />
                <Stat icon={Layers} label="Projetos ativos" value={stats[selected.name]?.projects ?? 0} color={selected.color} />
                <Stat icon={Users2} label="Colaboradores" value={stats[selected.name]?.collaborators.length ?? 0} color={selected.color} />
              </div>

              {/* Tarefas pendentes */}
              <div className="mt-5">
                <div className="mb-1.5 text-[10px] font-semibold uppercase tracking-wider text-white/40">Tarefas pendentes</div>
                <div className="space-y-1 rounded-lg border border-white/5 bg-white/[0.02] p-2">
                  {(stats[selected.name]?.recentTasks ?? []).filter((t) => t.status !== "done").slice(0, 5).map((t) => (
                    <div key={t.id} className="flex items-center gap-2 text-xs">
                      <Circle className="h-2 w-2 fill-current" style={{ color: selected.color }} />
                      <span className="truncate text-white/80">{t.title}</span>
                      <span className="ml-auto text-[9px] uppercase tracking-wider text-white/30">{t.status}</span>
                    </div>
                  ))}
                  {!(stats[selected.name]?.recentTasks ?? []).some((t) => t.status !== "done") && (
                    <div className="text-center text-[11px] text-white/30">Nenhuma tarefa pendente</div>
                  )}
                </div>
              </div>

              {/* Últimas atividades */}
              <div className="mt-4">
                <div className="mb-1.5 text-[10px] font-semibold uppercase tracking-wider text-white/40">Últimas atividades</div>
                <div className="space-y-1 rounded-lg border border-white/5 bg-white/[0.02] p-2">
                  {(stats[selected.name]?.recentActivities ?? []).slice(0, 6).map((a) => (
                    <div key={a.id} className="flex items-start gap-2 text-[11px]">
                      <Clock className="mt-0.5 h-3 w-3 shrink-0 text-white/40" />
                      <span className="flex-1 text-white/70">{a.text}</span>
                      <span className="shrink-0 text-[9px] text-white/30">{timeAgo(a.ts)}</span>
                    </div>
                  ))}
                  {(stats[selected.name]?.recentActivities ?? []).length === 0 && (
                    <div className="text-center text-[11px] text-white/30">Sem atividades recentes</div>
                  )}
                </div>
              </div>

              <div className="mt-4">
                <div className="mb-1.5 text-[10px] font-semibold uppercase tracking-wider text-white/40">Estações de trabalho</div>
                <div className="flex flex-wrap gap-1.5">
                  {sectorsOf(selected.name).map((s) => {
                    const Icon = SECTOR_ICON[s];
                    return (
                      <span key={s} className="flex items-center gap-1 rounded-md border border-white/10 bg-white/5 px-2 py-0.5 text-[10px] text-white/70">
                        <Icon className="h-3 w-3" /> {s}
                      </span>
                    );
                  })}
                </div>
              </div>

              <Button className="mt-5 w-full" style={{ background: selected.color, color: "white" }} onClick={() => { enterBuilding(selected); setSelected(null); }}>
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

// ============ Avatar chip ============
function AvatarChip({ name, initial, color, self, bubble }: { name: string; initial: string; color: string; self?: boolean; bubble?: string | null }) {
  return (
    <div className="relative">
      {bubble && (
        <div className="pointer-events-none absolute left-1/2 -top-12 z-40 max-w-[200px] -translate-x-1/2 whitespace-pre-wrap break-words rounded-2xl border bg-white px-2.5 py-1.5 text-[11px] font-medium text-black shadow-lg"
          style={{ borderColor: color }}>
          {bubble}
          <div className="absolute left-1/2 top-full h-2 w-2 -translate-x-1/2 -translate-y-1 rotate-45 border-b border-r bg-white" style={{ borderColor: color }} />
        </div>
      )}
      <div className="absolute -bottom-1 left-1/2 h-2 w-7 -translate-x-1/2 rounded-full bg-black/50 blur-sm" />
      <div
        className={cn("relative flex h-8 w-8 items-center justify-center rounded-full text-[11px] font-bold text-white shadow-lg", self ? "ring-2 ring-white/70" : "ring-2 ring-white/30")}
        style={{ background: `linear-gradient(135deg, ${color}, color-mix(in oklab, ${color} 40%, black))` }}
      >
        {initial}
      </div>
      <div className="pointer-events-none absolute left-1/2 top-[-18px] -translate-x-1/2 whitespace-nowrap rounded bg-black/70 px-1.5 py-0.5 text-[9px] font-medium text-white/90 backdrop-blur">
        {name}
      </div>
    </div>
  );
}

function RemoteAvatar({ payload }: { payload: PresencePayload }) {
  const bubble = payload.msg && Date.now() - payload.msg.ts < CHAT_TTL ? payload.msg.text : null;
  return (
    <div className="pointer-events-none absolute left-0 top-0 z-20 h-8 w-8 transition-transform duration-300 ease-linear will-change-transform" style={{ transform: `translate(${payload.x - 16}px, ${payload.y - 16}px)` }}>
      <AvatarChip name={payload.name} initial={payload.name.charAt(0).toUpperCase()} color={payload.color} bubble={bubble} />
    </div>
  );
}

function SpeechBubbleAt({ x, y, text, color }: { x: number; y: number; text: string; color: string }) {
  // standalone bubble (used for outdoor world coords)
  return (
    <div className="pointer-events-none absolute left-0 top-0 z-30 max-w-[220px] -translate-x-1/2 rounded-2xl border bg-white px-2.5 py-1.5 text-[11px] font-medium text-black shadow-xl"
      style={{ borderColor: color, transform: `translate(${x}px, ${y}px) translate(-50%, -100%)` }}
    >
      {text}
    </div>
  );
}

function ClickMarker({ getTarget }: { getTarget: () => { x: number; y: number } | null }) {
  const ref = useRef<HTMLDivElement | null>(null);
  useEffect(() => {
    let raf = 0;
    const tick = () => {
      const t = getTarget();
      if (ref.current) {
        if (t) { ref.current.style.display = "block"; ref.current.style.transform = `translate(${t.x - 14}px, ${t.y - 14}px)`; }
        else { ref.current.style.display = "none"; }
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [getTarget]);
  return (
    <div ref={ref} className="pointer-events-none absolute left-0 top-0 z-10 h-7 w-7 hidden">
      <div className="h-7 w-7 animate-ping rounded-full border-2 border-white/80" />
      <div className="absolute inset-2 rounded-full bg-white/80" />
    </div>
  );
}

// ============ TERRAIN ============
function Terrain() {
  return (
    <svg width={WORLD_W} height={WORLD_H} className="pointer-events-none absolute left-0 top-0">
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
          <path d={`M 0 ${TILE_H / 2} L ${TILE_W / 2} 0 L ${TILE_W} ${TILE_H / 2} L ${TILE_W / 2} ${TILE_H} Z`} fill="none" stroke="oklch(0.4 0.02 130 / 0.18)" strokeWidth="1" />
        </pattern>
      </defs>

      <path d={`M ${WORLD_W * 0.62} 0 L ${WORLD_W} 0 L ${WORLD_W} ${WORLD_H} L ${WORLD_W * 0.28} ${WORLD_H} 
                Q ${WORLD_W * 0.45} ${WORLD_H * 0.78}, ${WORLD_W * 0.55} ${WORLD_H * 0.65}
                Q ${WORLD_W * 0.66} ${WORLD_H * 0.5}, ${WORLD_W * 0.62} 0 Z`} fill="url(#sea-grad)" />
      <path d={`M 0 ${WORLD_H * 0.32} L ${WORLD_W * 0.13} ${WORLD_H * 0.34}
                Q ${WORLD_W * 0.18} ${WORLD_H * 0.5}, ${WORLD_W * 0.10} ${WORLD_H * 0.62}
                L 0 ${WORLD_H * 0.66} Z`} fill="url(#sea-grad)" opacity={0.95} />
      <path d={`M 0 0 L ${WORLD_W * 0.62} 0
                Q ${WORLD_W * 0.66} ${WORLD_H * 0.5}, ${WORLD_W * 0.55} ${WORLD_H * 0.65}
                Q ${WORLD_W * 0.45} ${WORLD_H * 0.78}, ${WORLD_W * 0.28} ${WORLD_H}
                L 0 ${WORLD_H}
                L 0 ${WORLD_H * 0.66}
                Q ${WORLD_W * 0.10} ${WORLD_H * 0.62}, ${WORLD_W * 0.18} ${WORLD_H * 0.5}
                Q ${WORLD_W * 0.13} ${WORLD_H * 0.34}, 0 ${WORLD_H * 0.32} Z`} fill="url(#ground-grad)" />
      <rect width={WORLD_W} height={WORLD_H} fill="url(#iso-grid-light)" opacity={0.4} />

      <path d={`M ${WORLD_W * 0.30} ${WORLD_H - 8} Q ${WORLD_W * 0.40} ${WORLD_H - 80}, ${WORLD_W * 0.52} ${WORLD_H * 0.78}`} stroke="url(#sand-grad)" strokeWidth="70" strokeLinecap="round" fill="none" />
      <path d={`M ${WORLD_W * 0.60} ${WORLD_H * 0.55} Q ${WORLD_W * 0.52} ${WORLD_H * 0.62}, ${WORLD_W * 0.55} ${WORLD_H * 0.72}`} stroke="url(#sand-grad)" strokeWidth="55" strokeLinecap="round" fill="none" />
      <path d={`M ${WORLD_W * 0.62} ${WORLD_H * 0.08} Q ${WORLD_W * 0.58} ${WORLD_H * 0.18}, ${WORLD_W * 0.62} ${WORLD_H * 0.28}`} stroke="url(#sand-grad)" strokeWidth="50" strokeLinecap="round" fill="none" />

      <g>
        <rect x={WORLD_W * 0.10} y={WORLD_H * 0.46} width={WORLD_W * 0.06} height={14} fill="oklch(0.40 0.04 60)" />
        <rect x={WORLD_W * 0.08} y={WORLD_H * 0.50} width={WORLD_W * 0.04} height={14} fill="oklch(0.40 0.04 60)" />
        {[0, 1, 2].map((i) => (
          <g key={i} transform={`translate(${WORLD_W * 0.06 + i * 30}, ${WORLD_H * 0.55 + i * 12})`}>
            <path d="M 0 0 L 24 0 L 20 8 L 4 8 Z" fill="oklch(0.85 0.02 60)" />
            <rect x="10" y="-12" width="4" height="12" fill="oklch(0.40 0.04 60)" />
          </g>
        ))}
      </g>

      <g opacity={0.85}>
        <path d={`M 200 ${WORLD_H * 0.05} Q 500 ${WORLD_H * 0.01}, 800 ${WORLD_H * 0.06} T 1500 ${WORLD_H * 0.05} T 2400 ${WORLD_H * 0.07}`} fill="url(#hill-grad)" />
        <path d={`M 300 ${WORLD_H * 0.04} Q 600 ${WORLD_H * 0.10}, 900 ${WORLD_H * 0.06} T 1700 ${WORLD_H * 0.08} T 2300 ${WORLD_H * 0.04} L 2300 0 L 300 0 Z`} fill="oklch(0.20 0.04 145)" opacity={0.7} />
        {Array.from({ length: 24 }).map((_, i) => {
          const x = 220 + i * 95 + ((i * 37) % 50);
          const y = WORLD_H * 0.06 + ((i * 19) % 30);
          return <circle key={i} cx={x} cy={y} r={6} fill="oklch(0.38 0.10 150)" />;
        })}
      </g>

      <path d={`M ${WORLD_W * 0.32} ${WORLD_H * 0.74} L ${WORLD_W * 0.70} ${WORLD_H * 0.66}`} stroke="oklch(0.50 0.03 60)" strokeWidth="44" strokeLinecap="round" />
      <path d={`M ${WORLD_W * 0.32} ${WORLD_H * 0.74} L ${WORLD_W * 0.70} ${WORLD_H * 0.66}`} stroke="oklch(0.62 0.04 60 / 0.6)" strokeWidth="40" strokeLinecap="round" strokeDasharray="4 6" />
      <path d={`M ${WORLD_W * 0.10} ${WORLD_H * 0.62} Q ${WORLD_W * 0.25} ${WORLD_H * 0.74}, ${WORLD_W * 0.40} ${WORLD_H * 0.72}`} stroke="oklch(0.55 0.04 80)" strokeWidth="34" fill="none" strokeLinecap="round" />

      <g transform={`translate(${WORLD_W * 0.50}, ${WORLD_H * 0.55})`}>
        <circle r="80" fill="oklch(0.42 0.04 100)" />
        <circle r="80" fill="none" stroke="oklch(0.60 0.05 100 / 0.4)" strokeWidth="2" />
        <circle r="30" fill="oklch(0.50 0.06 130)" />
        <circle r="4" fill="oklch(0.75 0.10 60)" />
      </g>

      {[
        [WORLD_W * 0.50, WORLD_H * 0.55, WORLD_W * 0.50, WORLD_H * 0.20],
        [WORLD_W * 0.50, WORLD_H * 0.55, WORLD_W * 0.25, WORLD_H * 0.50],
        [WORLD_W * 0.50, WORLD_H * 0.55, WORLD_W * 0.18, WORLD_H * 0.28],
        [WORLD_W * 0.50, WORLD_H * 0.55, WORLD_W * 0.78, WORLD_H * 0.50],
        [WORLD_W * 0.50, WORLD_H * 0.55, WORLD_W * 0.50, WORLD_H * 0.72],
        [WORLD_W * 0.50, WORLD_H * 0.55, WORLD_W * 0.20, WORLD_H * 0.68],
      ].map(([x1, y1, x2, y2], i) => (
        <line key={i} x1={x1} y1={y1} x2={x2} y2={y2} stroke="oklch(0.42 0.03 100 / 0.5)" strokeWidth="14" strokeLinecap="round" />
      ))}

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

function DistrictZone({ d }: { d: District }) {
  const Icon = d.icon;
  return (
    <div className="pointer-events-none absolute" style={{ left: d.x, top: d.y, width: d.w, height: d.h }}>
      <div className="absolute inset-0 rounded-[40px]" style={{ background: `radial-gradient(ellipse at center, color-mix(in oklab, ${d.color} 18%, transparent), transparent 70%)`, border: `1px dashed color-mix(in oklab, ${d.color} 40%, transparent)` }} />
      <div className="absolute -top-3 left-4 flex items-center gap-1.5 rounded-full border px-2 py-0.5 text-[10px] font-bold tracking-wider backdrop-blur" style={{ background: "rgba(0,0,0,0.55)", color: d.color, borderColor: `color-mix(in oklab, ${d.color} 60%, transparent)` }}>
        <Icon className="h-3 w-3" />
        {d.name.toUpperCase()}
        <span className="font-normal text-white/40">· {d.subtitle}</span>
      </div>
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
  const w = TILE_W * 0.78;
  const d = TILE_H * 0.78;
  const active = (stats?.activeTasks ?? 0) > 0;

  return (
    <div data-building-click className={cn("group absolute cursor-pointer transition-transform hover:-translate-y-1")} style={{ left: x - w / 2, top: y - h }} onClick={(e) => { e.stopPropagation(); onClick(); }}>
      <svg width={w} height={h + d} style={{ overflow: "visible", filter: "drop-shadow(0 12px 24px rgba(0,0,0,0.6))" }}>
        <polygon points={`0,${d / 2} ${w / 2},${d} ${w / 2},${d + h} 0,${d / 2 + h}`} fill={`color-mix(in oklab, ${color} 55%, black)`} stroke={color} strokeWidth="1" />
        <polygon points={`${w / 2},${d} ${w},${d / 2} ${w},${d / 2 + h} ${w / 2},${d + h}`} fill={`color-mix(in oklab, ${color} 75%, black)`} stroke={color} strokeWidth="1" />
        <polygon points={`0,${d / 2} ${w / 2},0 ${w},${d / 2} ${w / 2},${d}`} fill={color} stroke="oklch(0.95 0.02 260 / 0.4)" strokeWidth="1" />
        {Array.from({ length: Math.max(2, Math.floor(h / 22)) }).map((_, row) => (
          <g key={row}>
            <rect x={6} y={d / 2 + 10 + row * 22} width={w / 2 - 14} height={10} fill="oklch(0.92 0.12 80 / 0.6)" opacity={active && row % 2 === 0 ? 1 : 0.35} />
            <rect x={w / 2 + 6} y={d / 2 + 10 + row * 22} width={w / 2 - 12} height={10} fill="oklch(0.92 0.12 80 / 0.45)" opacity={active && row % 2 === 1 ? 1 : 0.3} />
          </g>
        ))}
        <rect x={w / 2 - 9} y={h + d - 18} width={18} height={18} fill={`color-mix(in oklab, ${color} 30%, black)`} stroke={color} strokeWidth="0.5" />
      </svg>
      <div className="pointer-events-none absolute left-1/2 top-[-30px] -translate-x-1/2 whitespace-nowrap">
        <div className="rounded-md border px-2 py-0.5 text-[10px] font-semibold backdrop-blur-md" style={{ background: "rgba(0,0,0,0.55)", borderColor: color, color }}>
          {company.name}
        </div>
      </div>
      {active && (
        <div className="pointer-events-none absolute left-1/2 top-[-8px] h-2 w-2 -translate-x-1/2 rounded-full" style={{ background: color, boxShadow: `0 0 12px ${color}` }} />
      )}
    </div>
  );
}

// ============ INTERIOR ============
function BuildingInterior({
  company, stats, onExit, avatarRef, avatarInitial, avatarColor, myMsg,
  remote, visibleBubbles, onClickFloor, selfSector,
}: {
  company: Company;
  stats?: CompanyStats;
  onExit: () => void;
  avatarRef: React.RefObject<HTMLDivElement | null>;
  avatarInitial: string;
  avatarColor: string;
  myMsg: ChatMsg | null;
  remote: PresencePayload[];
  visibleBubbles: PresencePayload[];
  onClickFloor: (x: number, y: number) => void;
  selfSector: SectorName | null;
}) {
  const color = company.color || "oklch(0.72 0.16 220)";
  const sectors = sectorsOf(company.name);
  const rects = sectorRects(sectors);
  const theme = themeOf(company.name);

  // Occupancy by sector (remote + self)
  const occupancy: Record<string, number> = {};
  for (const s of STANDARD_SECTORS) occupancy[s] = 0;
  for (const r of remote) if (r.sector) occupancy[r.sector] = (occupancy[r.sector] ?? 0) + 1;
  if (selfSector) occupancy[selfSector] = (occupancy[selfSector] ?? 0) + 1;

  const floorRef = useRef<HTMLDivElement | null>(null);
  const handleFloorClick = (e: React.MouseEvent) => {
    if (!floorRef.current) return;
    const r = floorRef.current.getBoundingClientRect();
    const x = ((e.clientX - r.left) / r.width) * INTERIOR_W;
    const y = ((e.clientY - r.top) / r.height) * INTERIOR_H;
    onClickFloor(x, y);
  };

  // Workstation info panel content
  const stationTasks = (stats?.recentTasks ?? []).slice(0, 4);
  const stationActivities = (stats?.recentActivities ?? []).slice(0, 4);

  return (
    <div
      className="absolute inset-0 z-40 animate-in fade-in zoom-in-95 duration-200"
      style={{ background: `linear-gradient(135deg, color-mix(in oklab, ${color} 12%, oklch(0.08 0.02 260)), oklch(0.06 0.02 260))` }}
    >
      <div className="absolute left-0 right-0 top-0 z-10 flex items-center justify-between p-3">
        <div className="flex items-center gap-2 rounded-xl border border-white/10 bg-black/50 px-3 py-2 backdrop-blur-md">
          <div className="flex h-8 w-8 items-center justify-center rounded-md" style={{ background: color }}>
            <Building2 className="h-4 w-4 text-white" />
          </div>
          <div>
            <div className="text-sm font-semibold text-white">{company.name}</div>
            <div className="text-[10px] text-white/50">Interior · {districtOf(company.name)?.name} · {remote.length + 1} pessoa(s)</div>
          </div>
        </div>
        <Button onClick={onExit} variant="ghost" className="rounded-xl border border-white/10 bg-black/50 text-white/80 backdrop-blur-md hover:text-white">
          <ArrowLeft className="mr-1 h-4 w-4" /> Sair
        </Button>
      </div>

      <div className="absolute inset-0 flex items-center justify-center p-12 pt-20">
        <div
          ref={floorRef}
          onClick={handleFloorClick}
          className="relative cursor-crosshair overflow-hidden rounded-2xl border-2"
          style={{
            width: "min(100%, 1040px)",
            aspectRatio: `${INTERIOR_W} / ${INTERIOR_H}`,
            background: `repeating-linear-gradient(${theme.angle}deg, color-mix(in oklab, ${color} 7%, oklch(0.12 0.02 260)) 0 ${theme.tile}px, color-mix(in oklab, ${color} 11%, oklch(0.10 0.02 260)) ${theme.tile}px ${theme.tile * 2}px)`,
            borderColor: `color-mix(in oklab, ${color} 60%, transparent)`,
            boxShadow: `0 0 80px color-mix(in oklab, ${color} 25%, transparent) inset`,
          }}
        >
          <div className="absolute inset-0" style={{ width: "100%", height: "100%" }}>
            <svg viewBox={`0 0 ${INTERIOR_W} ${INTERIOR_H}`} className="absolute inset-0 h-full w-full">
              {/* corridors */}
              <rect x="0" y={INTERIOR_H / 2 - 18} width={INTERIOR_W} height="36" fill="oklch(0.18 0.02 260 / 0.55)" />
              <rect x={INTERIOR_W / 2 - 18} y="0" width="36" height={INTERIOR_H} fill="oklch(0.18 0.02 260 / 0.4)" />

              {rects.map((r) => {
                const isReception = r.name === "Recepção";
                const isMeeting = r.name === "Sala de Reunião";
                return (
                  <g key={r.name}>
                    <rect x={r.x} y={r.y} width={r.w} height={r.h} rx="14"
                      fill={`color-mix(in oklab, ${color} ${isMeeting ? 22 : isReception ? 18 : 10}%, oklch(0.10 0.02 260))`}
                      stroke={`color-mix(in oklab, ${color} ${selfSector === r.name ? 90 : 55}%, transparent)`}
                      strokeWidth={selfSector === r.name ? 3 : 2}
                    />
                    {/* Decoration per sector */}
                    {isMeeting ? (
                      <>
                        {/* Big round meeting table */}
                        <ellipse cx={r.x + r.w / 2} cy={r.y + r.h * 0.58} rx={r.w * 0.28} ry={r.h * 0.18} fill={`color-mix(in oklab, ${color} 45%, black)`} opacity={0.85} />
                        <ellipse cx={r.x + r.w / 2} cy={r.y + r.h * 0.58} rx={r.w * 0.28} ry={r.h * 0.18} fill="none" stroke={color} strokeWidth="1.5" opacity={0.7} />
                        {/* Chairs around table */}
                        {[0, 60, 120, 180, 240, 300].map((deg) => {
                          const rad = (deg * Math.PI) / 180;
                          const cx2 = r.x + r.w / 2 + Math.cos(rad) * r.w * 0.34;
                          const cy2 = r.y + r.h * 0.58 + Math.sin(rad) * r.h * 0.26;
                          return <circle key={deg} cx={cx2} cy={cy2} r="6" fill="oklch(0.30 0.02 260)" stroke={color} strokeWidth="0.5" opacity={0.8} />;
                        })}
                        {/* Screen */}
                        <rect x={r.x + r.w * 0.35} y={r.y + r.h * 0.30} width={r.w * 0.30} height={r.h * 0.06} rx="2" fill="oklch(0.20 0.02 260)" stroke={color} strokeWidth="1" />
                      </>
                    ) : isReception ? (
                      <>
                        {/* Reception desk strip */}
                        <rect x={r.x + r.w * 0.30} y={r.y + r.h * 0.30} width={r.w * 0.40} height={r.h * 0.30} rx="6" fill={`color-mix(in oklab, ${color} 35%, black)`} opacity={0.8} />
                        {/* Plants */}
                        <circle cx={r.x + 22} cy={r.y + r.h - 18} r="8" fill="oklch(0.45 0.12 150)" />
                        <circle cx={r.x + r.w - 22} cy={r.y + r.h - 18} r="8" fill="oklch(0.45 0.12 150)" />
                      </>
                    ) : (
                      <>
                        {/* Workstation: 3 desks with chairs and "occupied" dots */}
                        {[0, 1, 2].map((i) => {
                          const dx = r.x + r.w * (0.20 + i * 0.28);
                          const dy = r.y + r.h * 0.58;
                          const dw = r.w * 0.22;
                          const dh = r.h * 0.16;
                          const seated = i < occupancy[r.name];
                          return (
                            <g key={i}>
                              <rect x={dx} y={dy} width={dw} height={dh} rx="4" fill={`color-mix(in oklab, ${color} 30%, black)`} opacity={0.75} />
                              {/* Monitor */}
                              <rect x={dx + dw * 0.35} y={dy - dh * 0.45} width={dw * 0.30} height={dh * 0.40} rx="1.5" fill="oklch(0.22 0.02 260)" stroke={seated ? "oklch(0.85 0.18 145)" : color} strokeWidth={seated ? 1.2 : 0.6} />
                              {/* Chair */}
                              <circle cx={dx + dw / 2} cy={dy + dh + 10} r="6" fill={seated ? color : "oklch(0.25 0.02 260)"} stroke={seated ? "oklch(0.95 0.05 145)" : "transparent"} strokeWidth="1" />
                            </g>
                          );
                        })}
                        <circle cx={r.x + 18} cy={r.y + r.h - 18} r="6" fill="oklch(0.45 0.12 150)" />
                      </>
                    )}
                    {/* Label */}
                    <text x={r.x + 14} y={r.y + 22} fill={color} fontSize="13" fontWeight={700} letterSpacing="2">{r.name.toUpperCase()}</text>
                  </g>
                );
              })}

              {/* Reception decoration (lobby zone) bottom */}
              <rect x={INTERIOR_W / 2 - 70} y={INTERIOR_H - 50} width="140" height="14" rx="4" fill={color} opacity={0.7} />
              <text x={INTERIOR_W / 2} y={INTERIOR_H - 16} textAnchor="middle" fill="white" fontSize="10" fontWeight={700} letterSpacing="3" opacity={0.6}>SAÍDA</text>
            </svg>

            {/* Sector occupancy badges (HTML overlay aligned to % coords) */}
            {rects.map((r) => {
              const Icon = SECTOR_ICON[r.name];
              const occ = occupancy[r.name];
              const here = selfSector === r.name;
              return (
                <div
                  key={`badge-${r.name}`}
                  className="pointer-events-none absolute"
                  style={{ left: `${((r.x + r.w - 6) / INTERIOR_W) * 100}%`, top: `${((r.y + 6) / INTERIOR_H) * 100}%`, transform: "translate(-100%, 0)" }}
                >
                  <div className={cn("flex items-center gap-1 rounded-full border px-1.5 py-0.5 text-[9px] font-semibold backdrop-blur",
                    here ? "border-emerald-400/60 bg-emerald-400/20 text-emerald-200" : "border-white/15 bg-black/50 text-white/70")}>
                    <Icon className="h-2.5 w-2.5" />
                    <span>{occ}</span>
                  </div>
                </div>
              );
            })}

            {/* Remote bubbles indoor */}
            {visibleBubbles.map((r) => (
              <div key={`ib-${r.id}`} className="pointer-events-none absolute"
                style={{ left: `${(r.ix / INTERIOR_W) * 100}%`, top: `${(r.iy / INTERIOR_H) * 100}%`, transform: "translate(-50%, -120%)" }}>
                <div className="max-w-[180px] rounded-2xl border bg-white px-2 py-1 text-[10px] font-medium text-black shadow-lg" style={{ borderColor: r.color }}>
                  {r.msg!.text}
                </div>
              </div>
            ))}

            {/* Remote avatars inside */}
            {remote.map((r) => (
              <div
                key={r.id}
                className="pointer-events-none absolute h-8 w-8 transition-transform duration-300 ease-linear will-change-transform"
                style={{ left: 0, top: 0, transform: `translate(calc(${(r.ix / INTERIOR_W) * 100}% - 16px), calc(${(r.iy / INTERIOR_H) * 100}% - 16px))` }}
              >
                <AvatarChip name={r.name} initial={r.name.charAt(0).toUpperCase()} color={r.color} />
              </div>
            ))}

            {/* My avatar inside */}
            <div
              ref={avatarRef}
              className="pointer-events-none absolute left-0 top-0 h-8 w-8 will-change-transform"
              style={{ transform: `translate(calc(${(INTERIOR_W / 2 / INTERIOR_W) * 100}% - 16px), calc(${((INTERIOR_H - 60) / INTERIOR_H) * 100}% - 16px))` }}
            >
              <AvatarChip name="Você" initial={avatarInitial} color={avatarColor} self bubble={myMsg?.text ?? null} />
            </div>
          </div>
        </div>
      </div>

      <div className="pointer-events-none absolute bottom-3 left-1/2 -translate-x-1/2 rounded-full border border-white/10 bg-black/60 px-3 py-1 text-[10px] text-white/60 backdrop-blur">
        <kbd className="rounded bg-white/10 px-1.5">W A S D</kbd> andar · <span className="rounded bg-white/10 px-1.5">clique</span> mover · <kbd className="rounded bg-white/10 px-1.5">T</kbd> chat · <kbd className="rounded bg-white/10 px-1.5">Esc</kbd> sair
      </div>

      {/* Workstation info panel (right) */}
      <div className="absolute right-3 top-20 hidden w-64 space-y-2 md:block">
        <div className="rounded-xl border border-white/10 bg-black/60 p-3 backdrop-blur-md">
          <div className="mb-1 text-[10px] font-semibold uppercase tracking-wider text-white/40">Operação · {company.name}</div>
          <div className="grid grid-cols-2 gap-2 text-xs">
            <Mini label="Tarefas" value={stats?.activeTasks ?? 0} />
            <Mini label="Projetos" value={stats?.projects ?? 0} />
            <Mini label="Tempo" value={formatHours(stats?.productiveMs ?? 0)} />
            <Mini label="Colab." value={stats?.collaborators.length ?? 0} />
          </div>
        </div>

        {/* Nearest station info */}
        <div className="rounded-xl border bg-black/70 p-3 backdrop-blur-md transition-all"
          style={{ borderColor: selfSector ? `color-mix(in oklab, ${color} 55%, transparent)` : "rgba(255,255,255,0.10)" }}>
          {selfSector ? (() => {
            const Icon = SECTOR_ICON[selfSector];
            return (
              <>
                <div className="mb-1 flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wider" style={{ color }}>
                  <Icon className="h-3 w-3" /> Estação · {selfSector}
                </div>
                <div className="mb-2 text-[10px] text-white/50">{SECTOR_HINT[selfSector]}</div>
                {selfSector === "Sala de Reunião" ? (
                  <div className="space-y-1.5 text-[11px] text-white/70">
                    <div className="flex items-center gap-1.5"><Users2 className="h-3 w-3" /> {occupancy[selfSector]} pessoa(s) na sala</div>
                    <div className="rounded-md bg-white/5 p-2 text-[10px] text-white/50">
                      Pronto para alinhamentos. Chamadas de voz e reunião em breve.
                    </div>
                  </div>
                ) : selfSector === "Recepção" ? (
                  <div className="space-y-1.5 text-[11px] text-white/70">
                    <div>Bem-vindo(a) à <span className="font-semibold text-white">{company.name}</span>.</div>
                    <div className="text-[10px] text-white/50">{districtOf(company.name)?.name}</div>
                  </div>
                ) : (
                  <>
                    <div className="mb-1 text-[10px] font-semibold uppercase tracking-wider text-white/40">Tarefas</div>
                    <div className="space-y-1">
                      {stationTasks.length === 0 && <div className="text-[11px] text-white/40">Sem tarefas registradas</div>}
                      {stationTasks.map((t) => (
                        <div key={t.id} className="flex items-center gap-1.5 text-[11px]">
                          <Circle className="h-2 w-2 fill-current" style={{ color }} />
                          <span className="flex-1 truncate text-white/80">{t.title}</span>
                        </div>
                      ))}
                    </div>
                    <div className="mt-2 mb-1 text-[10px] font-semibold uppercase tracking-wider text-white/40">Atividades</div>
                    <div className="space-y-1">
                      {stationActivities.slice(0, 3).map((a) => (
                        <div key={a.id} className="flex items-start gap-1.5 text-[10px]">
                          <Sparkles className="mt-0.5 h-2.5 w-2.5 text-white/40" />
                          <span className="flex-1 text-white/60">{a.text}</span>
                        </div>
                      ))}
                    </div>
                  </>
                )}
              </>
            );
          })() : (
            <div className="text-[11px] text-white/40">
              Aproxime-se de uma estação para ver tarefas e projetos relacionados.
            </div>
          )}
        </div>
      </div>

      <DecorativeIcons district={districtOf(company.name)?.id} />
    </div>
  );
}

function Mini({ label, value }: { label: string; value: number | string }) {
  return (
    <div>
      <div className="text-[10px] text-white/50">{label}</div>
      <div className="font-semibold tabular-nums text-white">{value}</div>
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
