/**
 * Utilidades de fecha con zona horaria explícita (Intl, sin dependencias).
 * La base de datos guarda instantes UTC; el salón define su zona horaria.
 */

export const DEFAULT_TIMEZONE = "Europe/Madrid";
export const LOCALE = "es-ES";

/** Desfase (minutos) de `timeZone` respecto a UTC en el instante dado. */
export function getTimeZoneOffsetMinutes(instant: Date, timeZone: string): number {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone,
    hourCycle: "h23",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  }).formatToParts(instant);
  const get = (type: Intl.DateTimeFormatPartTypes) => Number(parts.find((p) => p.type === type)?.value);
  const asUtc = Date.UTC(get("year"), get("month") - 1, get("day"), get("hour"), get("minute"), get("second"));
  return Math.round((asUtc - instant.getTime()) / 60_000);
}

/** Fecha civil (YYYY-MM-DD) de un instante en la zona indicada. */
export function toLocalDateKey(instant: Date, timeZone: string): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone, year: "numeric", month: "2-digit", day: "2-digit" }).format(
    instant,
  );
}

/** Instante UTC correspondiente a una hora local (YYYY-MM-DD + HH:mm) en la zona. */
export function zonedTimeToUtc(dateKey: string, time: string, timeZone: string): Date {
  const [y, m, d] = dateKey.split("-").map(Number);
  const [hh, mm] = time.split(":").map(Number);
  const naiveUtc = Date.UTC(y, m - 1, d, hh, mm);
  const offset = getTimeZoneOffsetMinutes(new Date(naiveUtc), timeZone);
  const candidate = new Date(naiveUtc - offset * 60_000);
  // Reajuste para los días de cambio de hora.
  const correction = getTimeZoneOffsetMinutes(candidate, timeZone);
  return correction === offset ? candidate : new Date(naiveUtc - correction * 60_000);
}

/** Rango [inicio, fin) en UTC de un día civil en la zona del salón. */
export function zonedDayRange(dateKey: string, timeZone: string): { start: Date; end: Date } {
  return {
    start: zonedTimeToUtc(dateKey, "00:00", timeZone),
    end: zonedTimeToUtc(addDays(dateKey, 1), "00:00", timeZone),
  };
}

/** Suma días a una fecha civil YYYY-MM-DD. */
export function addDays(dateKey: string, days: number): string {
  const [y, m, d] = dateKey.split("-").map(Number);
  const date = new Date(Date.UTC(y, m - 1, d + days));
  return date.toISOString().slice(0, 10);
}

/** Día ISO de la semana (1 = lunes … 7 = domingo) de una fecha civil. */
export function isoWeekday(dateKey: string): number {
  const [y, m, d] = dateKey.split("-").map(Number);
  const day = new Date(Date.UTC(y, m - 1, d)).getUTCDay();
  return day === 0 ? 7 : day;
}

/** Lunes de la semana de una fecha civil. */
export function startOfIsoWeek(dateKey: string): string {
  return addDays(dateKey, 1 - isoWeekday(dateKey));
}

export function formatTime(instant: Date | string, timeZone: string): string {
  return new Intl.DateTimeFormat(LOCALE, { timeZone, hour: "2-digit", minute: "2-digit" }).format(new Date(instant));
}

export function formatLongDate(dateKey: string): string {
  const [y, m, d] = dateKey.split("-").map(Number);
  const text = new Intl.DateTimeFormat(LOCALE, {
    timeZone: "UTC",
    weekday: "long",
    day: "numeric",
    month: "long",
  }).format(new Date(Date.UTC(y, m - 1, d)));
  return text.charAt(0).toUpperCase() + text.slice(1);
}

export function greetingFor(instant: Date, timeZone: string): string {
  const hour = Number(
    new Intl.DateTimeFormat("en-US", { timeZone, hour: "2-digit", hourCycle: "h23" }).format(instant),
  );
  if (hour < 6) return "Buenas noches";
  if (hour < 14) return "Buenos días";
  if (hour < 21) return "Buenas tardes";
  return "Buenas noches";
}

export function minutesBetween(start: Date | string, end: Date | string): number {
  return Math.round((new Date(end).getTime() - new Date(start).getTime()) / 60_000);
}
