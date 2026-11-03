import "server-only";
import { addDays, startOfIsoWeek, toLocalDateKey, zonedTimeToUtc } from "@/lib/datetime";
import { createClient } from "@/lib/supabase/server";
import type { OverviewKind, OverviewSpan, ScheduleRow } from "./overview";

export type SalonOverviewData = {
  timeZone: string;
  professionals: { id: string; name: string }[];
  schedule: ScheduleRow[];
  spans: OverviewSpan[];
};

/**
 * Datos de ocupación de un rango de días: horarios (visibles para el
 * establecimiento) y franjas anónimas de get_salon_agenda_overview().
 */
export async function getSalonOverview(salonId: string, dayKeys: string[]): Promise<SalonOverviewData | null> {
  const supabase = await createClient();
  const { data: salon, error: salonError } = await supabase.from("salons").select("timezone").eq("id", salonId).maybeSingle();
  if (salonError) throw salonError;
  if (!salon) return null;

  const tz = salon.timezone;
  const first = dayKeys[0];
  const last = dayKeys[dayKeys.length - 1];

  const [professionals, schedule, spans] = await Promise.all([
    supabase
      .from("professionals")
      .select("id, display_name")
      .eq("salon_id", salonId)
      .eq("status", "active")
      .order("sort_order")
      .order("display_name"),
    supabase
      .from("work_schedules")
      .select("professional_id, weekday, start_time, end_time, valid_from, valid_until")
      .eq("salon_id", salonId)
      .lte("valid_from", last)
      .or(`valid_until.is.null,valid_until.gte.${first}`),
    supabase.rpc("get_salon_agenda_overview", {
      p_salon_id: salonId,
      p_from: zonedTimeToUtc(first, "00:00", tz).toISOString(),
      p_to: zonedTimeToUtc(addDays(last, 1), "00:00", tz).toISOString(),
    }),
  ]);
  for (const r of [professionals, schedule, spans]) if (r.error) throw r.error;

  return {
    timeZone: tz,
    professionals: (professionals.data ?? []).map((p) => ({ id: p.id, name: p.display_name })),
    schedule: (schedule.data ?? []).map((r) => ({
      professionalId: r.professional_id,
      weekday: r.weekday,
      startTime: r.start_time.slice(0, 5),
      endTime: r.end_time.slice(0, 5),
      validFrom: r.valid_from,
      validUntil: r.valid_until,
    })),
    spans: (spans.data ?? []).map((s) => ({
      professionalId: s.professional_id,
      kind: s.kind as OverviewKind,
      startsAt: s.starts_at,
      endsAt: s.ends_at,
    })),
  };
}

/** Días (lunes a domingo) de la semana en curso para un establecimiento. */
export function currentWeekKeys(now: Date, timeZone: string): string[] {
  const monday = startOfIsoWeek(toLocalDateKey(now, timeZone));
  return Array.from({ length: 7 }, (_, i) => addDays(monday, i));
}
