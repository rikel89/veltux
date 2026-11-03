import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database.types";
import type { WeeklyScheduleSlot } from "./occupancy";

type Client = SupabaseClient<Database>;

/** Horario semanal vigente en la fecha indicada. */
export async function getWeeklySchedule(
  supabase: Client,
  professionalId: string,
  onDateKey: string,
): Promise<WeeklyScheduleSlot[]> {
  const { data, error } = await supabase
    .from("work_schedules")
    .select("weekday, start_time, end_time")
    .eq("professional_id", professionalId)
    .lte("valid_from", onDateKey)
    .or(`valid_until.is.null,valid_until.gte.${onDateKey}`)
    .order("weekday")
    .order("start_time");
  if (error) throw error;
  return data.map((s) => ({ weekday: s.weekday, startTime: s.start_time.slice(0, 5), endTime: s.end_time.slice(0, 5) }));
}
