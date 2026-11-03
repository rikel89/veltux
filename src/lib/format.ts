import { LOCALE } from "./datetime";

export function formatMoney(cents: number, currency = "EUR"): string {
  return new Intl.NumberFormat(LOCALE, {
    style: "currency",
    currency,
    minimumFractionDigits: cents % 100 === 0 ? 0 : 2,
    maximumFractionDigits: 2,
  }).format(cents / 100);
}

export function formatDuration(minutes: number): string {
  if (minutes < 60) return `${minutes} min`;
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return m === 0 ? `${h} h` : `${h} h ${m} min`;
}

export function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  const first = parts[0][0] ?? "";
  const last = parts.length > 1 ? parts[parts.length - 1][0] : "";
  return (first + last).toUpperCase();
}

/** Fecha corta de un instante en la zona del salón ("3 nov 2026"). */
export function formatDate(instant: Date | string, timeZone: string): string {
  return new Intl.DateTimeFormat(LOCALE, { timeZone, day: "numeric", month: "short", year: "numeric" }).format(new Date(instant));
}
