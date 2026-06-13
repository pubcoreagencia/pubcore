import { createFileRoute } from "@tanstack/react-router";
import { useCallback, useEffect, useMemo, useState } from "react";
import { Building2, Plus, Pencil, Copy, Archive, ArchiveRestore, Trash2, AlertTriangle, MoreVertical, Search } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useWorkspace } from "@/lib/workspace";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogDescription,
} from "@/components/ui/dialog";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";
import { DEFAULT_COMPANY_COLOR } from "@/lib/mock-data";

export const Route = createFileRoute("/app/companies")({
  component: CompaniesPage,
});

interface Company {
  id: string;
  workspace_id: string;
  name: string;
  color: string | null;
  segment: string | null;
  responsible: string | null;
  status: string;
  notes: string | null;
  position: number;
  archived_at: string | null;
  parent_company_id: string | null;
  description: string | null;
}

type ImpactReport = Record<string, number>;

const IMPACT_LABELS: Record<string, string> = {
  checklist_tasks: "Checklists",
  checklist_completions: "Conclusões de checklist",
  ponto_sessions: "Sessões de ponto",
  finance_transactions: "Movimentações financeiras",
  finance_products: "Produtos financeiros",
  finance_costs: "Custos",
  stock_items: "Itens de estoque",
  kanban_funnels: "Funis Kanban",
  kanban_cards: "Cards Kanban",
  crm_leads: "Clientes CRM",
  calendar_events: "Eventos do calendário",
  notes: "Notas",
};

const PRESET_COLORS = [
  "oklch(0.72 0.16 220)", // blue
  "oklch(0.78 0.15 75)",  // amber
  "oklch(0.72 0.18 145)", // green
  "oklch(0.68 0.20 25)",  // red
  "oklch(0.70 0.20 300)", // violet
  "oklch(0.75 0.15 195)", // teal
  "oklch(0.72 0.15 340)", // pink
  "oklch(0.65 0.10 260)", // slate
];

function CompaniesPage() {
  const { activeWorkspaceId, isWorkspaceAdmin, isMaster } = useWorkspace();
  const canManage = isWorkspaceAdmin || isMaster;
  const [companies, setCompanies] = useState<Company[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [showArchived, setShowArchived] = useState(false);

  // Dialog states
  const [editing, setEditing] = useState<Company | null>(null);
  const [creating, setCreating] = useState<{ parentId: string | null } | null>(null);
  const [deleting, setDeleting] = useState<Company | null>(null);

  const load = useCallback(async (wsId: string) => {
    const { data, error } = await supabase
      .from("checklist_companies")
      .select("*")
      .eq("workspace_id", wsId)
      .order("position", { ascending: true });
    if (error) { console.error(error); return []; }
    return (data ?? []) as unknown as Company[];
  }, []);

  useEffect(() => {
    if (!activeWorkspaceId) { setCompanies([]); setLoading(false); return; }
    let cancelled = false;
    setLoading(true);
    (async () => {
      const list = await load(activeWorkspaceId);
      if (!cancelled) { setCompanies(list); setLoading(false); }
    })();
    const ch = supabase
      .channel(`companies-page:${activeWorkspaceId}`)
      .on("postgres_changes",
        { event: "*", schema: "public", table: "checklist_companies", filter: `workspace_id=eq.${activeWorkspaceId}` },
        async () => { const list = await load(activeWorkspaceId); if (!cancelled) setCompanies(list); })
      .subscribe();
    return () => { cancelled = true; supabase.removeChannel(ch); };
  }, [activeWorkspaceId, load]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return companies.filter((c) => {
      if (!showArchived && c.status === "archived") return false;
      if (showArchived && c.status !== "archived") return false;
      if (!q) return true;
      return c.name.toLowerCase().includes(q)
        || (c.segment ?? "").toLowerCase().includes(q)
        || (c.responsible ?? "").toLowerCase().includes(q);
    });
  }, [companies, search, showArchived]);

  const handleArchive = async (c: Company) => {
    const next = c.status === "archived" ? "active" : "archived";
    const { error } = await supabase.from("checklist_companies")
      .update({ status: next, archived_at: next === "archived" ? new Date().toISOString() : null } as never)
      .eq("id", c.id);
    if (error) { toast.error("Erro ao arquivar"); return; }
    toast.success(next === "archived" ? "Empresa arquivada" : "Empresa restaurada");
  };

  const handleDuplicate = async (c: Company) => {
    if (!activeWorkspaceId) return;
    const base = `${c.name} (cópia)`;
    let name = base;
    let n = 2;
    while (companies.some((x) => x.name === name)) { name = `${base} ${n++}`; }
    const { error } = await supabase.from("checklist_companies").insert({
      workspace_id: activeWorkspaceId,
      name,
      color: c.color,
      segment: c.segment,
      responsible: c.responsible,
      status: "active",
      notes: c.notes,
      description: c.description,
      parent_company_id: c.parent_company_id,
      position: companies.length,
    } as never);
    if (error) { toast.error("Erro ao duplicar"); return; }
    toast.success("Empresa duplicada");
  };

  // Build parent/children groupings (only 1 level)
  const { parents, childrenByParent } = useMemo(() => {
    const ps: Company[] = [];
    const map = new Map<string, Company[]>();
    for (const c of filtered) {
      if (c.parent_company_id) {
        const arr = map.get(c.parent_company_id) ?? [];
        arr.push(c);
        map.set(c.parent_company_id, arr);
      } else {
        ps.push(c);
      }
    }
    // If a child's parent is filtered out (e.g. archived view), promote it so it still shows
    const parentIds = new Set(ps.map((p) => p.id));
    for (const [pid, kids] of map.entries()) {
      if (!parentIds.has(pid)) ps.push(...kids);
    }
    return { parents: ps, childrenByParent: map };
  }, [filtered]);


  return (
    <div className="p-3 sm:p-6 lg:p-10 max-w-7xl mx-auto">
      <header className="mb-6 flex flex-col sm:flex-row sm:items-end sm:justify-between gap-3">
        <div>
          <div className="text-[10px] sm:text-xs uppercase tracking-[0.2em] text-muted-foreground">Núcleo da plataforma</div>
          <h1 className="font-display text-2xl sm:text-3xl md:text-4xl font-bold tracking-tight mt-1 flex items-center gap-3">
            <Building2 className="h-7 w-7 text-primary" /> Empresas
          </h1>
          <p className="text-sm text-muted-foreground mt-1.5 max-w-xl">
            Empresas cadastradas alimentam automaticamente todos os módulos: Checklists, Ponto, Financeiro, Estoque, Kanban e CRM.
          </p>
        </div>
        {canManage && (
          <Button onClick={() => setCreating({ parentId: null })} className="gap-2 self-start sm:self-auto">
            <Plus className="h-4 w-4" /> Nova empresa
          </Button>
        )}
      </header>

      <div className="flex flex-col sm:flex-row gap-2 mb-5">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar por nome, segmento ou responsável…"
            className="pl-9"
          />
        </div>
        <div className="flex rounded-lg border border-border overflow-hidden text-sm">
          <button
            onClick={() => setShowArchived(false)}
            className={`px-4 py-2 transition ${!showArchived ? "bg-primary text-primary-foreground" : "hover:bg-surface"}`}
          >Ativas</button>
          <button
            onClick={() => setShowArchived(true)}
            className={`px-4 py-2 transition ${showArchived ? "bg-primary text-primary-foreground" : "hover:bg-surface"}`}
          >Arquivadas</button>
        </div>
      </div>

      {loading ? (
        <div className="text-sm text-muted-foreground">Carregando…</div>
      ) : filtered.length === 0 ? (
        <div className="rounded-xl border border-dashed border-border p-12 text-center">
          <Building2 className="h-10 w-10 mx-auto text-muted-foreground/40 mb-3" />
          <div className="text-sm text-muted-foreground">
            {showArchived ? "Nenhuma empresa arquivada." : "Nenhuma empresa cadastrada ainda."}
          </div>
          {canManage && !showArchived && (
            <Button variant="outline" onClick={() => setCreating({ parentId: null })} className="mt-4 gap-2">
              <Plus className="h-4 w-4" /> Cadastrar primeira empresa
            </Button>
          )}
        </div>
      ) : (
        <div className="space-y-4">
          {parents.map((p) => {
            const kids = childrenByParent.get(p.id) ?? [];
            const isSub = !!p.parent_company_id;
            return (
              <div key={p.id} className="space-y-2">
                <CompanyCard
                  company={p}
                  canManage={canManage}
                  isSub={isSub}
                  childCount={kids.length}
                  onEdit={() => setEditing(p)}
                  onDuplicate={() => handleDuplicate(p)}
                  onArchive={() => handleArchive(p)}
                  onDelete={() => setDeleting(p)}
                  onAddSub={!isSub && canManage ? () => setCreating({ parentId: p.id }) : undefined}
                />
                {kids.length > 0 && (
                  <div className="ml-6 pl-4 border-l-2 border-border/60 space-y-2">
                    {kids.map((k) => (
                      <CompanyCard
                        key={k.id}
                        company={k}
                        canManage={canManage}
                        isSub
                        onEdit={() => setEditing(k)}
                        onDuplicate={() => handleDuplicate(k)}
                        onArchive={() => handleArchive(k)}
                        onDelete={() => setDeleting(k)}
                      />
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {(creating || editing) && (
        <CompanyDialog
          workspaceId={activeWorkspaceId!}
          existing={editing}
          existingNames={companies.map((c) => c.name)}
          position={companies.length}
          defaultParentId={creating?.parentId ?? null}
          parentOptions={companies.filter((c) => !c.parent_company_id && c.status !== "archived" && c.id !== editing?.id)}
          onClose={() => { setCreating(null); setEditing(null); }}
        />
      )}

      {deleting && (
        <DeleteCompanyDialog
          workspaceId={activeWorkspaceId!}
          company={deleting}
          others={companies.filter((c) => c.id !== deleting.id && c.status !== "archived")}
          onClose={() => setDeleting(null)}
        />
      )}
    </div>
  );
}

function CompanyCard({
  company, canManage, onEdit, onDuplicate, onArchive, onDelete,
}: {
  company: Company;
  canManage: boolean;
  onEdit: () => void;
  onDuplicate: () => void;
  onArchive: () => void;
  onDelete: () => void;
}) {
  const color = company.color ?? DEFAULT_COMPANY_COLOR;
  const archived = company.status === "archived";
  return (
    <div className={`group relative rounded-xl border border-border bg-card shadow-card p-4 transition hover:border-primary/40 ${archived ? "opacity-60" : ""}`}>
      <div className="absolute top-0 left-0 right-0 h-1 rounded-t-xl" style={{ backgroundColor: color }} />
      <div className="flex items-start justify-between gap-2 mt-1">
        <div className="flex items-center gap-2.5 min-w-0">
          <div className="h-9 w-9 shrink-0 rounded-lg flex items-center justify-center" style={{ backgroundColor: `color-mix(in oklch, ${color} 25%, transparent)` }}>
            <Building2 className="h-4 w-4" style={{ color }} />
          </div>
          <div className="min-w-0">
            <div className="font-semibold truncate text-sm">{company.name}</div>
            <div className="text-[11px] text-muted-foreground truncate">
              {company.segment || "Sem segmento"}
            </div>
          </div>
        </div>
        {canManage && (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button className="h-8 w-8 rounded-md flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-surface transition" aria-label="Ações">
                <MoreVertical className="h-4 w-4" />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-44">
              <DropdownMenuItem onClick={onEdit}><Pencil className="h-3.5 w-3.5 mr-2" /> Editar</DropdownMenuItem>
              <DropdownMenuItem onClick={onDuplicate}><Copy className="h-3.5 w-3.5 mr-2" /> Duplicar</DropdownMenuItem>
              <DropdownMenuItem onClick={onArchive}>
                {archived ? <><ArchiveRestore className="h-3.5 w-3.5 mr-2" /> Restaurar</> : <><Archive className="h-3.5 w-3.5 mr-2" /> Arquivar</>}
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={onDelete} className="text-destructive focus:text-destructive">
                <Trash2 className="h-3.5 w-3.5 mr-2" /> Excluir
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        )}
      </div>
      <div className="mt-3 space-y-1.5 text-xs text-muted-foreground">
        {company.responsible && <div><span className="text-foreground/80">Responsável:</span> {company.responsible}</div>}
        {company.notes && <div className="line-clamp-2 italic">{company.notes}</div>}
      </div>
    </div>
  );
}

function CompanyDialog({
  workspaceId, existing, existingNames, position, onClose,
}: {
  workspaceId: string;
  existing: Company | null;
  existingNames: string[];
  position: number;
  onClose: () => void;
}) {
  const [name, setName] = useState(existing?.name ?? "");
  const [segment, setSegment] = useState(existing?.segment ?? "");
  const [responsible, setResponsible] = useState(existing?.responsible ?? "");
  const [color, setColor] = useState(existing?.color ?? PRESET_COLORS[0]);
  const [status, setStatus] = useState<string>(existing?.status ?? "active");
  const [notes, setNotes] = useState(existing?.notes ?? "");
  const [saving, setSaving] = useState(false);

  const onSave = async () => {
    const trimmed = name.trim();
    if (!trimmed) { toast.error("Informe um nome"); return; }
    const collides = existingNames.some((n) => n.toLowerCase() === trimmed.toLowerCase() && n !== existing?.name);
    if (collides) { toast.error("Já existe uma empresa com este nome"); return; }
    setSaving(true);
    try {
      if (existing) {
        if (trimmed !== existing.name) {
          // Rename + cascade
          const { error } = await supabase.from("checklist_companies")
            .update({ name: trimmed } as never).eq("id", existing.id);
          if (error) throw error;
          const { error: rpcErr } = await supabase.rpc("rename_checklist_company", {
            _workspace_id: workspaceId, _old_name: existing.name, _new_name: trimmed,
          } as never);
          if (rpcErr) throw rpcErr;
        }
        const { error } = await supabase.from("checklist_companies")
          .update({ segment, responsible, color, status, notes,
            archived_at: status === "archived" ? (existing.archived_at ?? new Date().toISOString()) : null,
          } as never)
          .eq("id", existing.id);
        if (error) throw error;
        toast.success("Empresa atualizada");
      } else {
        const { error } = await supabase.from("checklist_companies").insert({
          workspace_id: workspaceId,
          name: trimmed, segment, responsible, color, status, notes,
          position,
        } as never);
        if (error) throw error;
        toast.success("Empresa criada");
      }
      onClose();
    } catch (e) {
      console.error(e);
      toast.error("Erro ao salvar empresa");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>{existing ? "Editar empresa" : "Nova empresa"}</DialogTitle>
          <DialogDescription>
            Empresas alimentam todos os módulos da plataforma. Alterações no nome se propagam automaticamente.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-3 py-2">
          <div>
            <Label className="text-xs">Nome</Label>
            <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Ex: Acme Marketing" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label className="text-xs">Segmento</Label>
              <Input value={segment} onChange={(e) => setSegment(e.target.value)} placeholder="Ex: Marketing digital" />
            </div>
            <div>
              <Label className="text-xs">Responsável</Label>
              <Input value={responsible} onChange={(e) => setResponsible(e.target.value)} placeholder="Ex: Maria Silva" />
            </div>
          </div>
          <div>
            <Label className="text-xs">Cor identificadora</Label>
            <div className="flex flex-wrap gap-1.5 mt-1.5">
              {PRESET_COLORS.map((c) => (
                <button
                  key={c}
                  type="button"
                  onClick={() => setColor(c)}
                  className={`h-7 w-7 rounded-full border-2 transition ${color === c ? "border-foreground scale-110" : "border-transparent hover:scale-105"}`}
                  style={{ backgroundColor: c }}
                  aria-label="Selecionar cor"
                />
              ))}
            </div>
          </div>
          <div>
            <Label className="text-xs">Status</Label>
            <Select value={status} onValueChange={setStatus}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="active">Ativa</SelectItem>
                <SelectItem value="archived">Arquivada</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label className="text-xs">Observações</Label>
            <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={3} placeholder="Notas internas, contatos, descrição…" />
          </div>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={onClose} disabled={saving}>Cancelar</Button>
          <Button onClick={onSave} disabled={saving}>{saving ? "Salvando…" : "Salvar"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function DeleteCompanyDialog({
  workspaceId, company, others, onClose,
}: {
  workspaceId: string;
  company: Company;
  others: Company[];
  onClose: () => void;
}) {
  const [impact, setImpact] = useState<ImpactReport | null>(null);
  const [loading, setLoading] = useState(true);
  const [transferTo, setTransferTo] = useState<string>("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    (async () => {
      const { data, error } = await supabase.rpc("company_impact_report", {
        _workspace_id: workspaceId, _name: company.name,
      } as never);
      if (error) { console.error(error); toast.error("Erro ao calcular impacto"); }
      setImpact((data as ImpactReport | null) ?? {});
      setLoading(false);
    })();
  }, [workspaceId, company.name]);

  const totalImpact = useMemo(() => {
    if (!impact) return 0;
    return Object.values(impact).reduce((a, b) => a + (b ?? 0), 0);
  }, [impact]);

  const impactRows = useMemo(() => {
    if (!impact) return [];
    return Object.entries(impact).filter(([, v]) => v > 0);
  }, [impact]);

  const doDelete = async () => {
    setBusy(true);
    const { error } = await supabase.rpc("delete_checklist_company_cascade", {
      _workspace_id: workspaceId, _name: company.name,
    } as never);
    setBusy(false);
    if (error) { toast.error("Erro ao excluir"); return; }
    toast.success("Empresa e registros vinculados excluídos");
    onClose();
  };

  const doTransfer = async () => {
    if (!transferTo) { toast.error("Selecione a empresa de destino"); return; }
    setBusy(true);
    const { error: tErr } = await supabase.rpc("transfer_company_records", {
      _workspace_id: workspaceId, _from: company.name, _to: transferTo,
    } as never);
    if (tErr) { setBusy(false); toast.error("Erro ao transferir registros"); return; }
    const { error: dErr } = await supabase.from("checklist_companies").delete().eq("id", company.id);
    setBusy(false);
    if (dErr) { toast.error("Registros transferidos, mas falhou ao excluir a empresa"); return; }
    toast.success(`Registros transferidos para "${transferTo}" e empresa excluída`);
    onClose();
  };

  return (
    <Dialog open onOpenChange={(v) => !v && !busy && onClose()}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-destructive" />
            Excluir empresa "{company.name}"
          </DialogTitle>
          <DialogDescription>
            Esta ação é permanente. Revise o impacto antes de continuar.
          </DialogDescription>
        </DialogHeader>

        {loading ? (
          <div className="py-6 text-center text-sm text-muted-foreground">Calculando impacto…</div>
        ) : totalImpact === 0 ? (
          <div className="rounded-lg bg-surface/60 p-4 text-sm">
            Nenhum registro vinculado. A empresa pode ser excluída com segurança.
          </div>
        ) : (
          <div className="space-y-3">
            <div className="rounded-lg border border-destructive/30 bg-destructive/5 p-4">
              <div className="text-sm font-medium mb-2">
                Esta empresa possui {totalImpact} registro{totalImpact === 1 ? "" : "s"} vinculado{totalImpact === 1 ? "" : "s"}:
              </div>
              <ul className="text-xs space-y-0.5 text-muted-foreground">
                {impactRows.map(([k, v]) => (
                  <li key={k}>• {IMPACT_LABELS[k] ?? k}: <span className="text-foreground font-medium">{v}</span></li>
                ))}
              </ul>
            </div>

            {others.length > 0 && (
              <div className="rounded-lg border border-border p-3 space-y-2">
                <Label className="text-xs">Transferir registros para outra empresa</Label>
                <Select value={transferTo} onValueChange={setTransferTo}>
                  <SelectTrigger><SelectValue placeholder="Selecione uma empresa de destino" /></SelectTrigger>
                  <SelectContent>
                    {others.map((c) => (
                      <SelectItem key={c.id} value={c.name}>{c.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
          </div>
        )}

        <DialogFooter className="flex-col sm:flex-row gap-2">
          <Button variant="ghost" onClick={onClose} disabled={busy}>Cancelar</Button>
          {totalImpact > 0 && others.length > 0 && (
            <Button variant="outline" onClick={doTransfer} disabled={busy || !transferTo}>
              Transferir e excluir
            </Button>
          )}
          <Button variant="destructive" onClick={doDelete} disabled={busy}>
            {busy ? "Processando…" : totalImpact > 0 ? "Excluir tudo" : "Excluir"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
