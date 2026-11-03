"use client";

import { DemoTag } from "@/components/dashboard/demo-tag";
import { cn } from "@/lib/utils";
import { type AgendaAppointment, type AgendaDay, layoutColumns, type Span } from "@/modules/appointments/agenda";
import { EXCEPTION_LABEL } from "@/modules/scheduling/format";
import type { AppointmentStatus } from "@/types/database";

const STATUS_STYLE: Record<AppointmentStatus, string> = {
  confirmed: "border-lime-ink bg-lime-soft text-graphite hover:brightness-95",
  pending: "border-amber-500 bg-amber-50 text-amber-900 hover:bg-amber-100",
  completed: "border-slate-400 bg-slate-100 text-slate-600 hover:bg-slate-200",
  no_show: "border-slate-300 bg-white text-slate-400 line-through hover:bg-slate-50",
  cancelled: "hidden",
};

const hhmm = (min: number) => `${String(Math.floor(min / 60)).padStart(2, "0")}:${String(min % 60).padStart(2, "0")}`;

type Props = {
  days: AgendaDay[];
  startHour: number;
  endHour: number;
  hourPx: number;
  todayKey: string;
  nowMin: number;
  demo?: boolean;
  /** Clic en un hueco vacío: fecha y hora redondeada a 15 min. */
  onPickTime?: (dateKey: string, time: string) => void;
  onOpenAppointment: (appointment: AgendaAppointment) => void;
};

/** Rejilla horaria de uno o varios días con horario, excepciones y citas. */
export function TimeGrid({ days, startHour, endHour, hourPx, todayKey, nowMin, demo, onPickTime, onOpenAppointment }: Props) {
  const hours = Array.from({ length: endHour - startHour }, (_, i) => startHour + i);
  const height = hours.length * hourPx;
  const y = (min: number) => ((min - startHour * 60) * hourPx) / 60;
  const h = (s: Span) => Math.max(((s.endMin - s.startMin) * hourPx) / 60, 18);

  return (
    <div className="flex" style={{ height }}>
      <div className="relative w-12 shrink-0 select-none" aria-hidden>
        {hours.map((hour) => (
          <span key={hour} className="absolute right-2 -translate-y-1/2 text-[11px] text-muted-foreground tabular-nums" style={{ top: y(hour * 60) }}>
            {hour > startHour && hhmm(hour * 60)}
          </span>
        ))}
      </div>

      {days.map((day) => (
        <div
          key={day.dateKey}
          className="relative flex-1 border-l border-border bg-surface first:border-l-0 sm:first:border-l"
          onClick={(e) => {
            const onFreeArea = e.target === e.currentTarget || (e.target as HTMLElement).dataset.slot !== undefined;
            if (!onPickTime || !onFreeArea) return;
            const rect = e.currentTarget.getBoundingClientRect();
            const minute = startHour * 60 + Math.floor(((e.clientY - rect.top) / hourPx) * 4) * 15;
            onPickTime(day.dateKey, hhmm(Math.min(minute, 23 * 60 + 45)));
          }}
        >
          {/* Horario laboral */}
          {day.windows.map((w, i) => (
            <div key={i} data-slot className="absolute inset-x-0 bg-white" style={{ top: y(w.startMin), height: h(w) }} />
          ))}
          {/* Líneas de hora */}
          {hours.map((hour) => (
            <div key={hour} className="pointer-events-none absolute inset-x-0 border-t border-border/70" style={{ top: y(hour * 60) }} />
          ))}
          {/* Excepciones */}
          {day.blocks.map((b) =>
            b.type === "extra_availability" ? (
              <div key={b.id} data-slot className="absolute inset-x-0 border-l-2 border-lime bg-white" style={{ top: y(b.startMin), height: h(b) }} />
            ) : (
              <div
                key={b.id}
                className="pointer-events-none absolute inset-x-0 flex items-start bg-[repeating-linear-gradient(135deg,var(--color-muted)_0_6px,transparent_6px_12px)] px-2 py-1"
                style={{ top: y(b.startMin), height: h(b) }}
              >
                <span className="rounded bg-white/90 px-1.5 text-[10px] font-semibold text-muted-foreground">{EXCEPTION_LABEL[b.type]}</span>
              </div>
            ),
          )}
          {/* Citas */}
          {layoutColumns(day.appointments).map((a) => (
            <button
              key={a.id}
              type="button"
              onClick={() => onOpenAppointment(a)}
              className={cn(
                "absolute overflow-hidden rounded-lg border-l-4 px-2 py-1 text-left text-xs shadow-sm transition focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none",
                STATUS_STYLE[a.status],
              )}
              style={{
                top: y(a.startMin) + 1,
                height: h(a) - 2,
                left: `calc(${(a.column / a.columns) * 100}% + 3px)`,
                width: `calc(${100 / a.columns}% - 6px)`,
              }}
            >
              <span className="flex items-center gap-1 font-semibold tabular-nums">
                {hhmm(a.startMin)}
                {demo && <DemoTag className="ml-auto" />}
              </span>
              <span className="block truncate font-semibold">{a.clientName}</span>
              <span className="block truncate opacity-75">{a.serviceName}</span>
            </button>
          ))}
          {/* Ahora */}
          {day.dateKey === todayKey && nowMin >= startHour * 60 && nowMin <= endHour * 60 && (
            <div className="pointer-events-none absolute inset-x-0 z-10 flex items-center" style={{ top: y(nowMin) }} aria-hidden>
              <span className="-ml-1 size-2 rounded-full bg-red-500" />
              <span className="h-px flex-1 bg-red-500" />
            </div>
          )}
        </div>
      ))}
    </div>
  );
}
