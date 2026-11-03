import { addDays, isoWeekday, minutesBetween, zonedTimeToUtc } from "@/lib/datetime";

export type WeeklyScheduleSlot = { weekday: number; startTime: string; endTime: string };
export type BusyInterval = { startsAt: string; endsAt: string };

export type DayOccupancy = {
  dateKey: string;
  weekday: number;
  availableMinutes: number;
  bookedMinutes: number;
  /** null cuando el profesional no trabaja ese día. */
  percentage: number | null;
};

/**
 * Ocupación diaria de una semana: minutos reservados dentro del horario
 * laboral frente a minutos disponibles. Recorta las citas al horario.
 */
export function computeWeekOccupancy(
  weekStartKey: string,
  schedule: WeeklyScheduleSlot[],
  busy: BusyInterval[],
  timeZone: string,
): DayOccupancy[] {
  return Array.from({ length: 7 }, (_, i) => {
    const dateKey = addDays(weekStartKey, i);
    const weekday = isoWeekday(dateKey);
    const windows = schedule
      .filter((slot) => slot.weekday === weekday)
      .map((slot) => ({
        start: zonedTimeToUtc(dateKey, slot.startTime, timeZone).getTime(),
        end: zonedTimeToUtc(dateKey, slot.endTime, timeZone).getTime(),
      }));

    const availableMinutes = windows.reduce((sum, w) => sum + minutesBetween(new Date(w.start), new Date(w.end)), 0);

    let bookedMs = 0;
    for (const interval of busy) {
      const s = new Date(interval.startsAt).getTime();
      const e = new Date(interval.endsAt).getTime();
      for (const w of windows) {
        bookedMs += Math.max(0, Math.min(e, w.end) - Math.max(s, w.start));
      }
    }
    const bookedMinutes = Math.round(bookedMs / 60_000);

    return {
      dateKey,
      weekday,
      availableMinutes,
      bookedMinutes,
      percentage: availableMinutes === 0 ? null : Math.min(100, Math.round((bookedMinutes / availableMinutes) * 100)),
    };
  });
}

/** Media de ocupación sobre los días laborables (ignora días sin horario). */
export function averageOccupancy(days: DayOccupancy[]): number | null {
  const available = days.reduce((sum, d) => sum + d.availableMinutes, 0);
  if (available === 0) return null;
  const booked = days.reduce((sum, d) => sum + d.bookedMinutes, 0);
  return Math.round((booked / available) * 100);
}
