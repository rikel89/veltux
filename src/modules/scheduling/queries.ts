import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { ScheduleExceptionType } from "@/types/database";
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

export type ScheduleException = {
  id: string;
  type: ScheduleExceptionType;
  startsAt: string;
  endsAt: string;
  reason: string | null;
};

/** Excepciones que aún no han terminado (RLS: solo las propias). */
export async function listUpcomingExceptions(
  supabase: Client,
  professionalId: string,
  now: Date,
): Promise<ScheduleException[]> {
  const { data, error } = await supabase
    .from("schedule_exceptions")
    .select("id, type, starts_at, ends_at, reason")
    .eq("professional_id", professionalId)
    .gt("ends_at", now.toISOString())
    .order("starts_at")
    .limit(50);
  if (error) throw error;
  return data.map((e) => ({ id: e.id, type: e.type, startsAt: e.starts_at, endsAt: e.ends_at, reason: e.reason }));
}

export type AvailableSlot = { startsAt: string; endsAt: string };

/** Huecos libres calculados en PostgreSQL (get_available_slots). */
export async function getAvailableSlots(
  supabase: Client,
  serviceId: string,
  fromKey: string,
  toKey: string,
): Promise<AvailableSlot[]> {
  const { data, error } = await supabase.rpc("get_available_slots", {
    p_service_id: serviceId,
    p_from: fromKey,
    p_to: toKey,
  });
  if (error) throw error;
  return data.map((s) => ({ startsAt: s.starts_at, endsAt: s.ends_at }));
}
