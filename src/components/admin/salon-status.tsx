import { cn } from "@/lib/utils";
import type { SalonStatus } from "@/types/database";

const STATUS: Record<SalonStatus, { label: string; className: string }> = {
  trial: { label: "Piloto", className: "bg-lime-soft text-lime-ink ring-lime/60" },
  active: { label: "Activo", className: "bg-emerald-50 text-emerald-700 ring-emerald-200" },
  suspended: { label: "Suspendido", className: "bg-amber-50 text-amber-700 ring-amber-200" },
  cancelled: { label: "Baja", className: "bg-slate-100 text-slate-500 ring-slate-200" },
};

export function SalonStatusBadge({ status }: { status: SalonStatus }) {
  const s = STATUS[status];
  return (
    <span className={cn("inline-flex rounded-full px-2 py-0.5 text-[11px] font-semibold ring-1 ring-inset", s.className)}>
      {s.label}
    </span>
  );
}

/** Barra de uso de licencias: en uso / contratadas. */
export function LicenseUsage({ used, total }: { used: number; total: number }) {
  const pct = total === 0 ? 0 : Math.min(100, Math.round((used / total) * 100));
  return (
    <div className="flex items-center gap-2">
      <div className="h-1.5 w-16 overflow-hidden rounded-full bg-muted">
        <div className={cn("h-full rounded-full", pct >= 100 ? "bg-amber-500" : "bg-graphite")} style={{ width: `${pct}%` }} />
      </div>
      <span className="text-xs font-semibold tabular-nums">
        {used}/{total}
      </span>
    </div>
  );
}
