import { isoWeekday, zonedTimeToUtc } from "@/lib/datetime";
import { minuteOfDay, type Span } from "@/modules/appointments/agenda";

export type OverviewKind = "busy" | "unavailable" | "extra";
export type OverviewSpan = { professionalId: string; kind: OverviewKind; startsAt: string; endsAt: string };
export type ScheduleRow = {
  professionalId: string;
  weekday: number;
  startTime: string;
  endTime: string;
  validFrom: string;
  validUntil: string | null;
};

type Range = [start: number, end: number];

function merge(ranges: Range[]): Range[] {
  const sorted = ranges.filter(([s, e]) => e > s).sort((a, b) => a[0] - b[0]);
  const out: Range[] = [];
  for (const [s, e] of sorted) {
    const last = out[out.length - 1];
    if (last && s <= last[1]) last[1] = Math.max(last[1], e);
    else out.push([s, e]);
  }
  return out;
}

function subtract(from: Range[], remove: Range[]): Range[] {
  let result = from;
  for (const [rs, re] of remove) {
    result = result.flatMap<Range>(([s, e]) => {
      if (re <= s || rs >= e) return [[s, e]];
      const parts: Range[] = [];
      if (rs > s) parts.push([s, rs]);
      if (re < e) parts.push([re, e]);
      return parts;
    });
  }
  return result;
}

const totalMinutes = (ranges: Range[]) => Math.round(ranges.reduce((sum, [s, e]) => sum + (e - s), 0) / 60_000);

const toRange = (s: { startsAt: string; endsAt: string }): Range => [new Date(s.startsAt).getTime(), new Date(s.endsAt).getTime()];

export type DayLoad = {
  dateKey: string;
  availableMinutes: number;
  bookedMinutes: number;
  /** null: ese día no hay tiempo de trabajo. */
  percentage: number | null;
};

/**
 * Carga de un profesional en un día: tiempo de trabajo (horario vigente ese día
 * + extra − no disponible) y la parte ocupada por citas.
 */
export function computeDayLoad(
  dateKey: string,
  schedule: ScheduleRow[],
  spans: OverviewSpan[],
  timeZone: string,
): DayLoad {
  const weekday = isoWeekday(dateKey);
  const dayStart = zonedTimeToUtc(dateKey, "00:00", timeZone).getTime();
  const nextDay = new Date(`${dateKey}T12:00:00Z`);
  nextDay.setUTCDate(nextDay.getUTCDate() + 1);
  const dayEnd = zonedTimeToUtc(nextDay.toISOString().slice(0, 10), "00:00", timeZone).getTime();
  const clip = ([s, e]: Range): Range => [Math.max(s, dayStart), Math.min(e, dayEnd)];

  const windows: Range[] = schedule
    .filter((r) => r.weekday === weekday && r.validFrom <= dateKey && (r.validUntil === null || r.validUntil >= dateKey))
    .map((r) => [zonedTimeToUtc(dateKey, r.startTime, timeZone).getTime(), zonedTimeToUtc(dateKey, r.endTime, timeZone).getTime()]);
  const extra = spans.filter((s) => s.kind === "extra").map(toRange).map(clip);
  const unavailable = merge(spans.filter((s) => s.kind === "unavailable").map(toRange).map(clip));
  const working = subtract(merge([...windows, ...extra]), unavailable);

  const busy = merge(spans.filter((s) => s.kind === "busy").map(toRange).map(clip));
  const free = subtract(working, busy);
  const availableMinutes = totalMinutes(working);
  const bookedMinutes = availableMinutes - totalMinutes(free);

  return {
    dateKey,
    availableMinutes,
    bookedMinutes,
    percentage: availableMinutes === 0 ? null : Math.round((bookedMinutes / availableMinutes) * 100),
  };
}

export type ProfessionalLoad = { professionalId: string; name: string; days: DayLoad[]; percentage: number | null };

export type OverviewTotals = { availableMinutes: number; bookedMinutes: number; freeMinutes: number; percentage: number | null };

export function buildLoads(
  professionals: { id: string; name: string }[],
  dayKeys: string[],
  schedule: ScheduleRow[],
  spans: OverviewSpan[],
  timeZone: string,
): { loads: ProfessionalLoad[]; totals: OverviewTotals } {
  const loads = professionals.map((pro) => {
    const days = dayKeys.map((key) =>
      computeDayLoad(
        key,
        schedule.filter((r) => r.professionalId === pro.id),
        spans.filter((s) => s.professionalId === pro.id),
        timeZone,
      ),
    );
    const available = days.reduce((n, d) => n + d.availableMinutes, 0);
    const booked = days.reduce((n, d) => n + d.bookedMinutes, 0);
    return { professionalId: pro.id, name: pro.name, days, percentage: available === 0 ? null : Math.round((booked / available) * 100) };
  });
  const availableMinutes = loads.flatMap((l) => l.days).reduce((n, d) => n + d.availableMinutes, 0);
  const bookedMinutes = loads.flatMap((l) => l.days).reduce((n, d) => n + d.bookedMinutes, 0);
  return {
    loads,
    totals: {
      availableMinutes,
      bookedMinutes,
      freeMinutes: availableMinutes - bookedMinutes,
      percentage: availableMinutes === 0 ? null : Math.round((bookedMinutes / availableMinutes) * 100),
    },
  };
}

export type DayColumn = {
  professionalId: string;
  name: string;
  windows: Span[];
  busy: Span[];
  unavailable: Span[];
};

/** Columnas de un día para la rejilla de solo lectura. */
export function buildDayColumns(
  professionals: { id: string; name: string }[],
  dateKey: string,
  schedule: ScheduleRow[],
  spans: OverviewSpan[],
  timeZone: string,
): DayColumn[] {
  const weekday = isoWeekday(dateKey);
  const span = (s: OverviewSpan): Span => ({
    startMin: minuteOfDay(s.startsAt, dateKey, timeZone),
    endMin: minuteOfDay(s.endsAt, dateKey, timeZone),
  });
  const visible = (s: Span) => s.endMin > s.startMin;
  const minutes = (t: string) => Number(t.slice(0, 2)) * 60 + Number(t.slice(3, 5));

  return professionals.map((pro) => {
    const own = spans.filter((s) => s.professionalId === pro.id);
    return {
      professionalId: pro.id,
      name: pro.name,
      windows: [
        ...schedule
          .filter((r) => r.professionalId === pro.id && r.weekday === weekday && r.validFrom <= dateKey && (r.validUntil === null || r.validUntil >= dateKey))
          .map((r) => ({ startMin: minutes(r.startTime), endMin: minutes(r.endTime) })),
        ...own.filter((s) => s.kind === "extra").map(span).filter(visible),
      ],
      busy: own.filter((s) => s.kind === "busy").map(span).filter(visible),
      unavailable: own.filter((s) => s.kind === "unavailable").map(span).filter(visible),
    };
  });
}

/** Horas de la rejilla: cubre horario y citas de todas las columnas (mínimo 09-20). */
export function columnsHourRange(columns: DayColumn[]): { startHour: number; endHour: number } {
  const spans = columns.flatMap((c) => [...c.windows, ...c.busy]);
  const start = Math.min(9 * 60, ...spans.map((s) => s.startMin));
  const end = Math.max(20 * 60, ...spans.map((s) => s.endMin));
  return { startHour: Math.floor(start / 60), endHour: Math.ceil(end / 60) };
}
