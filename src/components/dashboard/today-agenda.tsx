import Link from "next/link";
import { CalendarPlus, ChevronRight } from "lucide-react";
import { formatTime, minutesBetween } from "@/lib/datetime";
import { formatDuration, formatMoney } from "@/lib/format";
import { cn } from "@/lib/utils";
import type { DashboardAppointment } from "@/modules/dashboard/types";
import { AppointmentStatusBadge } from "./appointment-status";
import { DemoTag } from "./demo-tag";

type Props = {
  agenda: DashboardAppointment[];
  nextId: string | null;
  now: string;
  timeZone: string;
  isDemo: boolean;
};

export function TodayAgenda({ agenda, nextId, now, timeZone, isDemo }: Props) {
  const nowMs = new Date(now).getTime();

  return (
    <section className="rounded-2xl border border-border bg-card shadow-card" aria-labelledby="agenda-hoy">
      <header className="flex items-center justify-between gap-3 border-b border-border px-5 py-4 sm:px-6">
        <div>
          <h2 id="agenda-hoy" className="text-base font-bold">
            Agenda de hoy
          </h2>
          <p className="text-xs text-muted-foreground">
            {agenda.length === 0 ? "Sin citas programadas" : `${agenda.length} citas programadas`}
          </p>
        </div>
        <Link
          href="/profesional/agenda"
          className="inline-flex items-center gap-1 rounded-lg px-2 py-1 text-sm font-semibold text-lime-ink hover:bg-lime-soft"
        >
          Ver agenda <ChevronRight className="size-4" />
        </Link>
      </header>

      {agenda.length === 0 ? (
        <div className="flex flex-col items-center gap-3 px-6 py-12 text-center">
          <span className="grid size-12 place-items-center rounded-2xl bg-lime-soft text-lime-ink">
            <CalendarPlus className="size-6" />
          </span>
          <div>
            <p className="font-semibold">Tu agenda de hoy está libre</p>
            <p className="mt-1 max-w-xs text-sm text-muted-foreground">
              Las citas aparecerán aquí cuando las crees o cuando tus clientes reserven online.
            </p>
          </div>
        </div>
      ) : (
        <ol className="divide-y divide-border">
          {agenda.map((a) => {
            const isNext = a.id === nextId;
            const isPast = new Date(a.endsAt).getTime() <= nowMs;
            return (
              <li
                key={a.id}
                className={cn(
                  "relative flex items-center gap-4 px-5 py-3.5 sm:px-6",
                  isNext && "bg-lime-soft/60",
                  isPast && "opacity-55",
                )}
              >
                {isNext && <span aria-hidden className="absolute inset-y-2 left-0 w-1 rounded-r-full bg-lime" />}
                <div className="w-14 shrink-0 text-right">
                  <p className="text-sm font-bold tabular-nums">{formatTime(a.startsAt, timeZone)}</p>
                  <p className="text-[11px] text-muted-foreground">{formatDuration(minutesBetween(a.startsAt, a.endsAt))}</p>
                </div>
                <div className="h-10 w-px bg-border" aria-hidden />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold">{a.clientName}</p>
                  <p className="truncate text-xs text-muted-foreground">{a.serviceName}</p>
                </div>
                <div className="flex shrink-0 flex-col items-end gap-1">
                  <p className="text-sm font-bold tabular-nums">{formatMoney(a.priceCents, a.currency)}</p>
                  {isDemo ? <DemoTag className="text-muted-foreground" /> : <AppointmentStatusBadge status={a.status} />}
                </div>
              </li>
            );
          })}
        </ol>
      )}
    </section>
  );
}
