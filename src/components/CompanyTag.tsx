import { COMPANY_COLORS, type Company } from "@/lib/mock-data";

export function CompanyTag({ company }: { company: Company }) {
  const color = COMPANY_COLORS[company];
  return (
    <span
      className="inline-flex items-center gap-1.5 rounded-md px-2 py-0.5 text-[10px] font-semibold tracking-wide"
      style={{
        backgroundColor: `color-mix(in oklab, ${color} 15%, transparent)`,
        color,
        border: `1px solid color-mix(in oklab, ${color} 30%, transparent)`,
      }}
    >
      <span className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: color }} />
      {company}
    </span>
  );
}
