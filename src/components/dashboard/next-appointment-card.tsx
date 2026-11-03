import { Clock3, Scissors, Sparkles } from "lucide-react";
import { formatTime, minutesBetween } from "@/lib/datetime";
import { formatDuration, formatMoney } from "@/lib/format";
import type { DashboardAppointment } from "@/modules/dashboard/types";
import { DemoTag } from "./demo-tag";

type Props = { appointment: DashboardAppointment | null; now: string; timeZone: string; isDemo: boolean };

function relativeStart(startsAt: string, now: string): string {
  const diff = minutesBetween(now, startsAt);
  if (diff <= 0) return "En curso";
  if (diff < 60) return `Empieza en ${diff} min`;
  return `Empieza en ${formatDuration(diff)}`;
}

export function NextAppointmentCard({ appointment, now, timeZone, isDemo }: Props) {
  return (
    <section
      aria-labelledby="proxima-cita"
      className="relative overflow-hidden rounded-2xl bg-graphite p-5 text-white sm:p-6"
    >
      <div aria-hidden className="pointer-events-none absolute -right-16 -bottom-20 size-56 rounded-full bg-lime/15 blur-3xl" />
      <div aria-hidden className="pointer-events-none absolute top-0 right-0 h-full w-24 -skew-x-12 bg-gradient-to-l from-lime/10 to-transparent" />

      <div className="relative flex items-center justify-between">
        <h2 id="proxima-cita" className="flex items-center gap-2 text-sm font-semibold text-neutral-300">
          <Sparkles className="size-4 text-lime" /> Próxima cita
        </h2>
        {isDemo && appointment && <DemoTag className="text-lime" />}
      </div>

      {appointment ? (
        <div className="relative mt-5">
          <p className="text-4xl font-extrabold tracking-tight text-lime tabular-nums">
            {formatTime(appointment.startsAt, timeZone)}
          </p>
          <p className="mt-1 text-xs font-medium text-neutral-400">{relativeStart(appointment.startsAt, now)}</p>
          <p className="mt-5 truncate text-lg font-bold">{appointment.clientName}</p>
          <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-neutral-400">
            <span className="inline-flex items-center gap-1.5">
              <Scissors className="size-3.5" /> {appointment.serviceName}
            </span>
            <span className="inline-flex items-center gap-1.5">
              <Clock3 className="size-3.5" /> {formatDuration(minutesBetween(appointment.startsAt, appointment.endsAt))}
            </span>
            <span className="font-semibold text-white">{formatMoney(appointment.priceCents, appointment.currency)}</span>
          </div>
        </div>
      ) : (
        <div className="relative mt-5">
          <p className="text-lg font-bold">No tienes más citas hoy</p>
          <p className="mt-1 text-sm text-neutral-400">Buen momento para revisar tu agenda de mañana.</p>
        </div>
      )}
    </section>
  );
}
