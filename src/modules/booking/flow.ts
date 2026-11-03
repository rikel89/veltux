import { addDays, formatTime, isoWeekday, LOCALE } from "@/lib/datetime";

export type DayChip = { dateKey: string; weekday: string; day: number; month: string };

/** Días seleccionables: desde hoy hasta el horizonte del profesional (máximo `max`). */
export function bookableDays(todayKey: string, horizonDays: number, max = 21): DayChip[] {
  const count = Math.max(1, Math.min(horizonDays, max));
  return Array.from({ length: count }, (_, i) => {
    const dateKey = addDays(todayKey, i);
    const date = new Date(`${dateKey}T12:00:00Z`);
    return {
      dateKey,
      weekday: new Intl.DateTimeFormat(LOCALE, { timeZone: "UTC", weekday: "short" }).format(date).replace(".", ""),
      day: date.getUTCDate(),
      month: new Intl.DateTimeFormat(LOCALE, { timeZone: "UTC", month: "short" }).format(date).replace(".", ""),
    };
  });
}

export type SlotGroup = { label: "Mañana" | "Tarde" | "Noche"; slots: { startsAt: string; time: string }[] };

/** Agrupa los huecos por franja del día (hora local del salón). */
export function groupSlots(slots: { startsAt: string }[], timeZone: string): SlotGroup[] {
  const groups: SlotGroup[] = [
    { label: "Mañana", slots: [] },
    { label: "Tarde", slots: [] },
    { label: "Noche", slots: [] },
  ];
  for (const s of slots) {
    const time = formatTime(s.startsAt, timeZone);
    const hour = Number(time.slice(0, 2));
    groups[hour < 14 ? 0 : hour < 20 ? 1 : 2].slots.push({ startsAt: s.startsAt, time });
  }
  return groups.filter((g) => g.slots.length > 0);
}

/** "1 h", "2 días"… para explicar la antelación mínima. */
export function describeNotice(minutes: number): string {
  if (minutes < 60) return `${minutes} min`;
  if (minutes < 1440) return `${Math.round(minutes / 60)} h`;
  const days = Math.round(minutes / 1440);
  return days === 1 ? "1 día" : `${days} días`;
}

export const isWeekend = (dateKey: string) => isoWeekday(dateKey) >= 6;
