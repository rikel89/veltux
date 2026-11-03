import type { DashboardAppointment } from "./types";

const ACTIVE = new Set(["pending", "confirmed", "completed"]);

/** Indicadores del día a partir de las citas (función pura, testeable). */
export function summarizeDay(agenda: DashboardAppointment[], now: Date) {
  const active = agenda.filter((a) => ACTIVE.has(a.status));
  const nextAppointment =
    active
      .filter((a) => (a.status === "pending" || a.status === "confirmed") && new Date(a.endsAt) > now)
      .sort((a, b) => a.startsAt.localeCompare(b.startsAt))[0] ?? null;

  return {
    appointmentsToday: active.length,
    revenueTodayCents: active.reduce((sum, a) => sum + a.priceCents, 0),
    nextAppointment,
  };
}
