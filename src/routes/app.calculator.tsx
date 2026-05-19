import { createFileRoute } from "@tanstack/react-router";
import { CalculatorCore } from "@/components/CalculatorCore";
import { Calculator as CalcIcon } from "lucide-react";
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
            <h1 className="font-display text-xl sm:text-2xl md:text-3xl text-foreground">Calculadora</h1>
            <p className="text-xs sm:text-sm text-muted-foreground truncate">Cálculos rápidos, porcentagens e atalhos</p>
          </div>
        </div>
      </header>

      <div className="max-w-md mx-auto md:mx-0 rounded-2xl border border-border/60 bg-card/40 backdrop-blur p-3 sm:p-4 shadow-2xl">
        <CalculatorCore
          onHistoryToggle={() => setShowHistory((v) => !v)}
          showHistoryPanel={showHistory}
        />
      </div>
    </div>
  );
}
