import { isoWeekday, toLocalDateKey } from "@/lib/datetime";
import type { WeeklyScheduleSlot } from "@/modules/scheduling/occupancy";
import { toMinutes } from "@/modules/scheduling/schemas";
import type { AppointmentStatus, ScheduleExceptionType } from "@/types/database";

export type AgendaAppointment = {
  id: string;
  startsAt: string;
  endsAt: string;
  status: AppointmentStatus;
  serviceName: string;
  priceCents: number;
  currency: string;
  clientId: string;
  clientName: string;
  clientPhone: string;
  notes: string | null;
};

export type AgendaException = { id: string; type: ScheduleExceptionType; startsAt: string; endsAt: string };

export type Span = { startMin: number; endMin: number };

export type AgendaDay = {
  dateKey: string;
  weekday: number;
  windows: Span[];
  appointments: (AgendaAppointment & Span)[];
  blocks: (Span & { id: string; type: ScheduleExceptionType })[];
};

/**
 * Minuto del día civil `dateKey` (0…1440) en que cae un instante, en la zona
 * del salón. Antes del día → 0; después → 1440. Correcto en cambios de hora.
 */
export function minuteOfDay(instant: string | Date, dateKey: string, timeZone: string): number {
  const date = new Date(instant);
  const key = toLocalDateKey(date, timeZone);
  if (key < dateKey) return 0;
  if (key > dateKey) return 1440;
  const time = new Intl.DateTimeFormat("en-GB", { timeZone, hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).format(date);
  return toMinutes(time);
}

const toSpan = (startsAt: string, endsAt: string, dateKey: string, tz: string): Span => ({
  startMin: minuteOfDay(startsAt, dateKey, tz),
  endMin: minuteOfDay(endsAt, dateKey, tz),
});

/** Reparte citas, excepciones y franjas de horario en cada día visible. */
export function buildAgendaDays(
  dayKeys: string[],
  schedule: WeeklyScheduleSlot[],
  appointments: AgendaAppointment[],
  exceptions: AgendaException[],
  timeZone: string,
): AgendaDay[] {
  return dayKeys.map((dateKey) => {
    const weekday = isoWeekday(dateKey);
    const visible = (s: Span) => s.endMin > s.startMin;
    return {
      dateKey,
      weekday,
      windows: schedule
        .filter((slot) => slot.weekday === weekday)
        .map((slot) => ({ startMin: toMinutes(slot.startTime), endMin: toMinutes(slot.endTime) })),
      appointments: appointments
        .map((a) => ({ ...a, ...toSpan(a.startsAt, a.endsAt, dateKey, timeZone) }))
        .filter(visible),
      blocks: exceptions
        .map((e) => ({ id: e.id, type: e.type, ...toSpan(e.startsAt, e.endsAt, dateKey, timeZone) }))
        .filter(visible),
    };
  });
}

/** Horas que muestra la rejilla: cubre horario, citas y excepciones (mínimo 09-20). */
export function visibleHourRange(days: AgendaDay[]): { startHour: number; endHour: number } {
  const spans = days.flatMap((d) => [...d.windows, ...d.appointments, ...d.blocks.filter((b) => b.type === "extra_availability")]);
  const start = Math.min(9 * 60, ...spans.map((s) => s.startMin));
  const end = Math.max(20 * 60, ...spans.map((s) => s.endMin));
  return { startHour: Math.max(0, Math.floor(start / 60)), endHour: Math.min(24, Math.ceil(end / 60)) };
}

/**
 * Columnas para citas que se superponen visualmente (p. ej. una completada y
 * otra nueva en el mismo hueco): cada cita recibe su columna y el total del grupo.
 */
export function layoutColumns<T extends Span>(items: T[]): (T & { column: number; columns: number })[] {
  const sorted = [...items].sort((a, b) => a.startMin - b.startMin || b.endMin - a.endMin);
  const out: (T & { column: number; columns: number })[] = [];
  let group: (T & { column: number; columns: number })[] = [];
  let groupEnd = -1;

  const flush = () => {
    const columns = Math.max(1, ...group.map((g) => g.column + 1));
    for (const g of group) g.columns = columns;
    out.push(...group);
    group = [];
  };

  for (const item of sorted) {
    if (item.startMin >= groupEnd && group.length) flush();
    const used = new Set(group.filter((g) => g.endMin > item.startMin).map((g) => g.column));
    let column = 0;
    while (used.has(column)) column++;
    group.push({ ...item, column, columns: 1 });
    groupEnd = Math.max(groupEnd, item.endMin);
  }
  if (group.length) flush();
  return out;
}
