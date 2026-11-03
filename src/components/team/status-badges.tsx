import { cn } from "@/lib/utils";
import type { ProfessionalStatus } from "@/types/database";

const STATUS: Record<ProfessionalStatus, { label: string; className: string }> = {
  invited: { label: "Invitación pendiente", className: "bg-amber-50 text-amber-700 ring-amber-200" },
  active: { label: "Activo", className: "bg-lime-soft text-lime-ink ring-lime/60" },
  inactive: { label: "Inactivo", className: "bg-slate-100 text-slate-500 ring-slate-200" },
};

const pill = "inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-semibold ring-1 ring-inset";

export function ProfessionalStatusBadge({ status }: { status: ProfessionalStatus }) {
  const s = STATUS[status];
  return <span className={cn(pill, s.className)}>{s.label}</span>;
}

export function LicenseBadge({ licensed }: { licensed: boolean }) {
  return (
    <span className={cn(pill, licensed ? "bg-graphite text-lime ring-graphite" : "bg-white text-muted-foreground ring-border")}>
      {licensed ? "Con licencia" : "Sin licencia"}
    </span>
  );
}

/** Cupo de licencias: en uso / contratadas, con barra de progreso. */
export function LicenseQuota({ inUse, quantity, tone = "dark" }: { inUse: number; quantity: number; tone?: "dark" | "light" }) {
  const free = Math.max(0, quantity - inUse);
  const pct = quantity === 0 ? 100 : Math.min(100, Math.round((inUse / quantity) * 100));
  const dark = tone === "dark";
  return (
    <div>
      <p className={cn("text-xs font-semibold", dark ? "text-neutral-400" : "text-muted-foreground")}>Licencias en uso</p>
      <p className={cn("mt-1 text-4xl font-extrabold tracking-tight tabular-nums", dark && "text-lime")}>
        {inUse}
        <span className={cn("text-2xl", dark ? "text-neutral-500" : "text-muted-foreground")}>/{quantity}</span>
      </p>
      <div className={cn("mt-3 h-2 overflow-hidden rounded-full", dark ? "bg-white/10" : "bg-muted")}>
        <div
          className={cn("h-full rounded-full", free === 0 ? "bg-amber-400" : dark ? "bg-lime" : "bg-graphite")}
          style={{ width: `${pct}%` }}
        />
      </div>
      <p className={cn("mt-2 text-xs", dark ? "text-neutral-400" : "text-muted-foreground")}>
        {free === 0 ? "Cupo completo" : `${free} ${free === 1 ? "licencia libre" : "licencias libres"}`}
      </p>
    </div>
  );
}
