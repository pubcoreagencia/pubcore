import { useState } from "react";
import { Check, ChevronsUpDown, Plus, Building2 } from "lucide-react";
import { useWorkspace } from "@/lib/workspace";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem,
  DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";

export function WorkspaceSwitcher() {
  const { workspaces, activeWorkspace, setActiveWorkspaceId, createWorkspace, isMaster } = useWorkspace();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);

  const handleCreate = async () => {
    if (!name.trim()) return;
    setBusy(true);
    const ws = await createWorkspace(name.trim());
    setBusy(false);
    if (ws) {
      toast.success(`Workspace "${ws.name}" criado`);
      setOpen(false); setName("");
    } else {
      toast.error("Falha ao criar workspace");
    }
  };

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <button className="w-full flex items-center gap-2 rounded-lg border border-sidebar-border bg-sidebar-accent/40 hover:bg-sidebar-accent px-3 py-2 text-left transition-colors">
            <Building2 className="h-4 w-4 text-primary shrink-0" />
            <div className="flex-1 min-w-0">
              <div className="text-[10px] uppercase tracking-[0.18em] text-muted-foreground/70">Workspace</div>
              <div className="text-sm font-medium truncate text-foreground">
                {activeWorkspace?.name ?? "—"}
              </div>
            </div>
            <ChevronsUpDown className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start" className="w-64">
          <DropdownMenuLabel className="text-xs">Seus workspaces</DropdownMenuLabel>
          {workspaces.length === 0 && (
            <div className="px-2 py-2 text-xs text-muted-foreground">Nenhum workspace</div>
          )}
          {workspaces.map((w) => (
            <DropdownMenuItem key={w.id} onClick={() => setActiveWorkspaceId(w.id)} className="gap-2">
              <Check className={`h-4 w-4 ${w.id === activeWorkspace?.id ? "opacity-100" : "opacity-0"}`} />
              <span className="flex-1 truncate">{w.name}</span>
              <span className="text-[10px] uppercase tracking-wider text-muted-foreground">{w.member_role}</span>
            </DropdownMenuItem>
          ))}
          {isMaster && <DropdownMenuItem disabled className="text-[10px] uppercase tracking-wider text-primary">Modo Master</DropdownMenuItem>}
          <DropdownMenuSeparator />
          <DropdownMenuItem onClick={() => setOpen(true)} className="gap-2">
            <Plus className="h-4 w-4" /> Novo workspace
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Novo workspace</DialogTitle></DialogHeader>
          <Input placeholder="Nome do workspace" value={name} onChange={(e) => setName(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleCreate()} />
          <DialogFooter>
            <Button variant="ghost" onClick={() => setOpen(false)}>Cancelar</Button>
            <Button onClick={handleCreate} disabled={busy || !name.trim()}>
              {busy ? "Criando…" : "Criar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
