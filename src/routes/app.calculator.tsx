import { createFileRoute, Link } from "@tanstack/react-router";
import { CalculatorCore } from "@/components/CalculatorCore";
import { Calculator as CalcIcon, Box, ArrowRight } from "lucide-react";
import { useState } from "react";

export const Route = createFileRoute("/app/calculator")({
  component: CalculatorPage,
});

function CalculatorPage() {
  const [showHistory, setShowHistory] = useState(true);

  return (
    <div className="flex-1 p-3 sm:p-4 md:p-8">
      <header className="mb-4 sm:mb-6">
        <div className="flex items-center gap-3">
          <div className="h-9 w-9 sm:h-10 sm:w-10 rounded-xl bg-primary/15 border border-primary/20 grid place-items-center flex-shrink-0">
            <CalcIcon className="h-5 w-5 text-primary" />
          </div>
          <div className="min-w-0">
            <h1 className="font-display text-xl sm:text-2xl md:text-3xl text-foreground">
              Calculadora de Custos
            </h1>
            <p className="text-xs sm:text-sm text-muted-foreground truncate">
              Calculadora padrão e ferramentas avançadas de precificação
            </p>
          </div>
        </div>
      </header>

      <div className="grid grid-cols-1 lg:grid-cols-[1fr_320px] gap-4 md:gap-6 max-w-5xl">
        <div className="rounded-2xl border border-border/60 bg-card/40 backdrop-blur p-3 sm:p-4 shadow-2xl">
          <CalculatorCore
            onHistoryToggle={() => setShowHistory((v) => !v)}
            showHistoryPanel={showHistory}
          />
        </div>

        <aside className="space-y-3">
          <Link
            to="/app/calc3d"
            className="group block rounded-2xl border border-primary/30 bg-gradient-to-br from-primary/15 via-card/60 to-card/40 backdrop-blur p-4 shadow-lg shadow-primary/10 hover:border-primary/50 hover:shadow-primary/20 transition-all"
          >
            <div className="flex items-center gap-3 mb-2">
              <div className="h-10 w-10 rounded-xl bg-gradient-to-br from-primary/30 to-primary/10 border border-primary/30 grid place-items-center flex-shrink-0">
                <Box className="h-5 w-5 text-primary" />
              </div>
              <div className="min-w-0 flex-1">
                <div className="font-display text-base text-foreground">Calculadora 3D</div>
                <div className="text-[11px] text-muted-foreground">Subferramenta</div>
              </div>
              <ArrowRight className="h-4 w-4 text-primary group-hover:translate-x-0.5 transition-transform" />
            </div>
            <p className="text-xs text-muted-foreground leading-relaxed">
              Precificação profissional para impressão 3D: material, energia, máquina, mão de obra,
              margens e impostos.
            </p>
          </Link>

          <div className="rounded-2xl border border-border/60 bg-card/30 backdrop-blur p-4">
            <div className="text-[10px] uppercase tracking-wider text-muted-foreground mb-1.5">
              Dica
            </div>
            <p className="text-xs text-muted-foreground leading-relaxed">
              Use a calculadora padrão para contas rápidas e porcentagens. Para projetos 3D
              completos com custos detalhados, abra a Calculadora 3D.
            </p>
          </div>
        </aside>
      </div>
    </div>
  );
}
