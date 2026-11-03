import { DEFAULT_TIMEZONE, startOfIsoWeek, toLocalDateKey, zonedTimeToUtc } from "@/lib/datetime";
import { averageOccupancy, computeWeekOccupancy, type WeeklyScheduleSlot } from "@/modules/scheduling/occupancy";
import { summarizeDay } from "./summary";
import type { DashboardAppointment, ProfessionalDashboard } from "./types";

/**
 * DATOS DE DEMOSTRACIÓN · solo se usan cuando Supabase no está configurado.
 * La interfaz los marca siempre con la etiqueta "Demo". No son reservas reales.
 */
const DEMO_AGENDA: Array<[time: string, minutes: number, client: string, service: string, cents: number]> = [
  ["09:30", 30, "Cliente demo A", "Corte clásico", 1500],
  ["10:15", 45, "Cliente demo B", "Corte + barba", 2200],
  ["11:30", 30, "Cliente demo C", "Arreglo de barba", 1000],
  ["12:30", 60, "Cliente demo D", "Corte + color", 3500],
  ["16:00", 30, "Cliente demo E", "Corte clásico", 1500],
  ["17:00", 45, "Cliente demo F", "Corte + barba", 2200],
];

const DEMO_SCHEDULE: WeeklyScheduleSlot[] = [1, 2, 3, 4, 5].flatMap((weekday) => [
  { weekday, startTime: "09:00", endTime: "14:00" },
  { weekday, startTime: "16:00", endTime: "20:00" },
]).concat([{ weekday: 6, startTime: "09:00", endTime: "14:00" }]);

const DEMO_WEEK_LOAD = [0.82, 0.64, 0.9, 0.71, 0.58, 0.95, 0];

export function buildDemoDashboard(now: Date): ProfessionalDashboard {
  const timeZone = DEFAULT_TIMEZONE;
  const todayKey = toLocalDateKey(now, timeZone);

  const agenda: DashboardAppointment[] = DEMO_AGENDA.map(([time, minutes, client, service, cents], i) => {
    const start = zonedTimeToUtc(todayKey, time, timeZone);
    return {
      id: `demo-${i}`,
      startsAt: start.toISOString(),
      endsAt: new Date(start.getTime() + minutes * 60_000).toISOString(),
      clientName: client,
      serviceName: service,
      priceCents: cents,
      currency: "EUR",
      status: "confirmed",
    };
  });

  // Ocupación sintética: carga fija sobre el horario demo de cada día.
  const week = computeWeekOccupancy(startOfIsoWeek(todayKey), DEMO_SCHEDULE, [], timeZone).map((day, i) => {
    const bookedMinutes = Math.round(day.availableMinutes * DEMO_WEEK_LOAD[i]);
    return {
      ...day,
      bookedMinutes,
      percentage: day.availableMinutes === 0 ? null : Math.round((bookedMinutes / day.availableMinutes) * 100),
    };
  });

  const summary = summarizeDay(agenda, now);

  return {
    mode: "demo",
    professional: {
      displayName: "Carlos Martín",
      salonName: "Barbería Elegance",
      salonSlug: "barberia-elegance",
      timeZone,
      hasActiveLicense: true,
    },
    now: now.toISOString(),
    todayKey,
    stats: {
      appointmentsToday: summary.appointmentsToday,
      revenueTodayCents: summary.revenueTodayCents,
      occupancyWeekPct: averageOccupancy(week),
      newClientsMonth: 12,
    },
    agenda,
    nextAppointment: summary.nextAppointment,
    week,
  };
}
