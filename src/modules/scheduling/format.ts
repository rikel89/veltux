import { formatTime, LOCALE, toLocalDateKey } from "@/lib/datetime";
import type { ScheduleExceptionType } from "@/types/database";

export const EXCEPTION_LABEL: Record<ScheduleExceptionType, string> = {
  day_off: "Día libre",
  block: "Bloqueo",
  break: "Descanso",
  extra_availability: "Horario extra",
};

function shortDate(dateKey: string): string {
  const [y, m, d] = dateKey.split("-").map(Number);
  return new Intl.DateTimeFormat(LOCALE, { timeZone: "UTC", weekday: "short", day: "numeric", month: "short" }).format(
    new Date(Date.UTC(y, m - 1, d)),
  );
}

/** "lun, 1 dic · 10:00–11:00" o "lun, 1 dic – vie, 5 dic" para días completos. */
export function describeExceptionWhen(
  e: { type: ScheduleExceptionType; startsAt: string; endsAt: string },
  timeZone: string,
): string {
  const startKey = toLocalDateKey(new Date(e.startsAt), timeZone);
  if (e.type === "day_off") {
    // El fin es exclusivo (medianoche del día siguiente): el último día es el anterior.
    const lastKey = toLocalDateKey(new Date(new Date(e.endsAt).getTime() - 1), timeZone);
    return lastKey === startKey ? shortDate(startKey) : `${shortDate(startKey)} – ${shortDate(lastKey)}`;
  }
  const endKey = toLocalDateKey(new Date(e.endsAt), timeZone);
  const range = `${formatTime(e.startsAt, timeZone)}–${formatTime(e.endsAt, timeZone)}`;
  return endKey === startKey ? `${shortDate(startKey)} · ${range}` : `${shortDate(startKey)} – ${shortDate(endKey)} · ${range}`;
}
