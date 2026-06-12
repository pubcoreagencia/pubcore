import { useChecklistCompanies } from "@/lib/checklist-companies";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";

interface Props {
  value: string | null | undefined;
  onChange: (name: string | null) => void;
  placeholder?: string;
  allowNone?: boolean;
  includeArchived?: boolean;
  className?: string;
}

/**
 * Reusable company picker. Always reads the live list from
 * useChecklistCompanies so any module that uses it stays in sync with the
 * Empresas module — no hardcoded lists allowed.
 */
export function CompanyPicker({
  value, onChange, placeholder = "Selecionar empresa…",
  allowNone = true, includeArchived = false, className,
}: Props) {
  const { companies, loading } = useChecklistCompanies();
  const list = includeArchived
    ? companies
    : companies.filter((c) => (c as unknown as { status?: string }).status !== "archived");

  return (
    <Select
      value={value ?? "__none__"}
      onValueChange={(v) => onChange(v === "__none__" ? null : v)}
    >
      <SelectTrigger className={className}>
        <SelectValue placeholder={loading ? "Carregando…" : placeholder} />
      </SelectTrigger>
      <SelectContent>
        {allowNone && <SelectItem value="__none__">Sem empresa</SelectItem>}
        {list.map((c) => (
          <SelectItem key={c.id} value={c.name}>
            <span className="inline-flex items-center gap-2">
              <span
                className="inline-block h-2 w-2 rounded-full"
                style={{ backgroundColor: c.color ?? "currentColor" }}
              />
              {c.name}
            </span>
          </SelectItem>
        ))}
        {list.length === 0 && !loading && (
          <div className="px-2 py-3 text-xs text-muted-foreground">
            Nenhuma empresa cadastrada. Crie em <strong>Empresas</strong>.
          </div>
        )}
      </SelectContent>
    </Select>
  );
}
