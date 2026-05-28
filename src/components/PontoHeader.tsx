import { Timer, Pause, Radio } from "lucide-react";
import { usePonto, fmtTime } from "@/lib/ponto";
import { Link } from "@tanstack/react-router";

export function PontoHeader() {
  const { activeCompany, sessions, computeFor } = usePonto();

  if (!activeCompany) return null;
  const session = sessions[activeCompany];
  if (!session || session.status === "off") return null;
  const { liveWorkMs } = computeFor(activeCompany);

  const working = session.status === "working";
  const paused = session.status === "paused";
  const ended = session.status === "ended";

  return (
    <Link
      to="/app/checklists"
      className="fixed top-[60px] right-2 md:top-3 md:right-3 z-40 group"
      aria-label="Abrir Bater Ponto"
    >
      <div className={`flex items-center gap-2 md:gap-3 rounded-full border px-2 py-1 md:px-3 md:py-1.5 backdrop-blur-md shadow-card transition ${
        working ? "border-success/30 bg-success/10"
          : paused ? "border-warning/30 bg-warning/10"
          : "border-border bg-card/80"
      }`}>
        <span className="relative flex h-2 w-2">
          {working && <span className="absolute inset-0 rounded-full bg-success animate-ping opacity-60" />}
          <span className={`relative inline-flex h-2 w-2 rounded-full ${
            working ? "bg-success" : paused ? "bg-warning" : "bg-muted-foreground"
          }`} />
        </span>
        <span className="text-[10px] uppercase tracking-[0.18em] font-bold hidden sm:inline">
          {activeCompany}
        </span>
        <span className="flex items-center gap-1 md:gap-1.5 font-mono tabular-nums text-[11px] md:text-sm font-semibold">
          {paused ? <Pause className="h-3 w-3 md:h-3.5 md:w-3.5 text-warning" /> :
           ended ? <Timer className="h-3 w-3 md:h-3.5 md:w-3.5 text-muted-foreground" /> :
           <Radio className="h-3 w-3 md:h-3.5 md:w-3.5 text-success" />}
          {fmtTime(liveWorkMs)}
        </span>
      </div>
    </Link>
  );
}
