import type { AppointmentStatus } from "@/types/database";
import { cn } from "@/lib/utils";

const STATUS: Record<AppointmentStatus, { label: string; className: string }> = {
  pending: { label: "Pendiente", className: "bg-amber-50 text-amber-700 ring-amber-200" },
  confirmed: { label: "Confirmada", className: "bg-lime-soft text-lime-ink ring-lime/60" },
  completed: { label: "Completada", className: "bg-slate-100 text-slate-600 ring-slate-200" },
  cancelled: { label: "Cancelada", className: "bg-red-50 text-red-700 ring-red-200" },
  no_show: { label: "No asistió", className: "bg-slate-100 text-slate-500 ring-slate-200" },
};

export function AppointmentStatusBadge({ status }: { status: AppointmentStatus }) {
  const s = STATUS[status];
  return (
    <span className={cn("inline-flex rounded-full px-2 py-0.5 text-[11px] font-semibold ring-1 ring-inset", s.className)}>
      {s.label}
    </span>
  );
}
