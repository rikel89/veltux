import "server-only";
import { connection } from "next/server";
import { addDays, startOfIsoWeek, toLocalDateKey, zonedDayRange, zonedTimeToUtc } from "@/lib/datetime";
import { requireSession } from "@/modules/auth/session";
import { listAppointmentsInRange } from "@/modules/appointments/queries";
import { getMyProfessionalContext } from "@/modules/professionals/queries";
import { averageOccupancy, computeWeekOccupancy } from "@/modules/scheduling/occupancy";
import { getWeeklySchedule } from "@/modules/scheduling/queries";
import { buildDemoDashboard } from "./demo";
import { summarizeDay } from "./summary";
import type { DashboardResult } from "./types";

export async function getProfessionalDashboard(): Promise<DashboardResult> {
  await connection(); // depende de la hora actual: siempre en tiempo de petición
  const now = new Date();
  const session = await requireSession();

  if (session.mode === "demo") {
    return { kind: "ready", data: buildDemoDashboard(now) };
  }

  const { supabase, user } = session;
  const ctx = await getMyProfessionalContext(supabase, user.id);
  if (!ctx) return { kind: "no-professional", email: user.email };

  const tz = ctx.timeZone;
  const todayKey = toLocalDateKey(now, tz);
  const today = zonedDayRange(todayKey, tz);
  const weekStartKey = startOfIsoWeek(todayKey);
  const weekStart = zonedTimeToUtc(weekStartKey, "00:00", tz);
  const weekEnd = zonedTimeToUtc(addDays(weekStartKey, 7), "00:00", tz);
  const monthStart = zonedTimeToUtc(`${todayKey.slice(0, 8)}01`, "00:00", tz);

  const [weekAppointments, schedule, newClients] = await Promise.all([
    listAppointmentsInRange(supabase, ctx.professionalId, weekStart, weekEnd),
    getWeeklySchedule(supabase, ctx.professionalId, todayKey),
    supabase
      .from("clients")
      .select("id", { count: "exact", head: true })
      .eq("professional_id", ctx.professionalId)
      .gte("created_at", monthStart.toISOString()),
  ]);
  if (newClients.error) throw newClients.error;

  const agenda = weekAppointments.filter((a) => {
    const t = new Date(a.startsAt);
    return t >= today.start && t < today.end;
  });
  const week = computeWeekOccupancy(
    weekStartKey,
    schedule,
    weekAppointments.filter((a) => a.status !== "no_show"),
    tz,
  );
  const summary = summarizeDay(agenda, now);

  return {
    kind: "ready",
    data: {
      mode: "live",
      professional: {
        displayName: ctx.displayName,
        salonName: ctx.salonName,
        salonSlug: ctx.salonSlug,
        timeZone: tz,
        hasActiveLicense: ctx.hasActiveLicense,
      },
      now: now.toISOString(),
      todayKey,
      stats: {
        appointmentsToday: summary.appointmentsToday,
        revenueTodayCents: summary.revenueTodayCents,
        occupancyWeekPct: averageOccupancy(week),
        newClientsMonth: newClients.count ?? 0,
      },
      agenda,
      nextAppointment: summary.nextAppointment,
      week,
    },
  };
}
