import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { zonedDayRange } from "@/lib/datetime";
import { listAgendaAppointments, listAgendaExceptions } from "@/modules/appointments/queries";
import type { AgendaAppointment } from "@/modules/appointments/agenda";
import type { Database } from "@/types/database.types";

type Client = SupabaseClient<Database>;

export type OpenRequest = {
  id: string;
  appointmentId: string;
  type: "reschedule" | "reassignment";
  status: "pending_target" | "pending_client";
  proposedStartsAt: string;
  targetName: string | null;
};

export type IncomingReassignment = Database["public"]["Functions"]["my_incoming_reassignments"]["Returns"][number];

export type IncidentDay = {
  appointments: AgendaAppointment[];
  requests: Record<string, OpenRequest>;
  blocked: boolean;
};

/** Citas activas de la jornada, sus propuestas abiertas y si el día ya está bloqueado. */
export async function getIncidentDay(
  supabase: Client,
  professionalId: string,
  dateKey: string,
  timeZone: string,
): Promise<IncidentDay> {
  const { start, end } = zonedDayRange(dateKey, timeZone);
  const [all, exceptions] = await Promise.all([
    listAgendaAppointments(supabase, professionalId, start, end),
    listAgendaExceptions(supabase, professionalId, start, end),
  ]);
  const appointments = all.filter((a) => a.status === "pending" || a.status === "confirmed");

  const requests: Record<string, OpenRequest> = {};
  if (appointments.length > 0) {
    const { data, error } = await supabase
      .from("appointment_change_requests")
      .select("id, appointment_id, type, status, proposed_starts_at, target_professional_id")
      .in("appointment_id", appointments.map((a) => a.id))
      .in("status", ["pending_target", "pending_client"]);
    if (error) throw error;

    const targetIds = data.flatMap((r) => (r.target_professional_id ? [r.target_professional_id] : []));
    const names = new Map<string, string>();
    if (targetIds.length > 0) {
      const { data: pros, error: prosError } = await supabase.from("professionals").select("id, display_name").in("id", targetIds);
      if (prosError) throw prosError;
      for (const p of pros) names.set(p.id, p.display_name);
    }
    for (const r of data) {
      requests[r.appointment_id] = {
        id: r.id,
        appointmentId: r.appointment_id,
        type: r.type,
        status: r.status as OpenRequest["status"],
        proposedStartsAt: r.proposed_starts_at,
        targetName: r.target_professional_id ? (names.get(r.target_professional_id) ?? null) : null,
      };
    }
  }

  return { appointments, requests, blocked: exceptions.some((e) => e.type === "day_off" && new Date(e.startsAt) <= start && new Date(e.endsAt) >= end) };
}

/** Compañeros activos del establecimiento que pueden recibir una cita. */
export async function listColleagues(supabase: Client, salonId: string, professionalId: string) {
  const { data, error } = await supabase
    .from("professionals")
    .select("id, display_name")
    .eq("salon_id", salonId)
    .eq("status", "active")
    .neq("id", professionalId)
    .order("display_name");
  if (error) throw error;
  return data.map((p) => ({ id: p.id, name: p.display_name }));
}

export async function listIncomingReassignments(supabase: Client): Promise<IncomingReassignment[]> {
  const { data, error } = await supabase.rpc("my_incoming_reassignments");
  if (error) throw error;
  return data;
}
