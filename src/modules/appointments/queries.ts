import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database.types";
import type { DashboardAppointment } from "@/modules/dashboard/types";
import type { AgendaAppointment, AgendaException } from "./agenda";

type Client = SupabaseClient<Database>;

/** Citas no canceladas del profesional en el rango [from, to). */
export async function listAppointmentsInRange(
  supabase: Client,
  professionalId: string,
  from: Date,
  to: Date,
): Promise<DashboardAppointment[]> {
  const { data, error } = await supabase
    .from("appointments")
    .select("id, starts_at, ends_at, status, service_name, price_cents, currency, client_id")
    .eq("professional_id", professionalId)
    .neq("status", "cancelled")
    .gte("starts_at", from.toISOString())
    .lt("starts_at", to.toISOString())
    .order("starts_at");
  if (error) throw error;
  if (data.length === 0) return [];

  const clientIds = [...new Set(data.map((a) => a.client_id))];
  const { data: clients, error: clientsError } = await supabase
    .from("clients")
    .select("id, full_name")
    .in("id", clientIds);
  if (clientsError) throw clientsError;
  const names = new Map(clients.map((c) => [c.id, c.full_name]));

  return data.map((a) => ({
    id: a.id,
    startsAt: a.starts_at,
    endsAt: a.ends_at,
    clientName: names.get(a.client_id) ?? "Cliente",
    serviceName: a.service_name,
    priceCents: a.price_cents,
    currency: a.currency,
    status: a.status,
  }));
}

/** Citas activas o cerradas (no canceladas) del rango, con datos de cliente para la agenda. */
export async function listAgendaAppointments(
  supabase: Client,
  professionalId: string,
  from: Date,
  to: Date,
): Promise<AgendaAppointment[]> {
  const { data, error } = await supabase
    .from("appointments")
    .select("id, starts_at, ends_at, status, service_name, price_cents, currency, client_id, notes")
    .eq("professional_id", professionalId)
    .neq("status", "cancelled")
    .lt("starts_at", to.toISOString())
    .gt("ends_at", from.toISOString())
    .order("starts_at");
  if (error) throw error;
  if (data.length === 0) return [];

  const { data: clients, error: clientsError } = await supabase
    .from("clients")
    .select("id, full_name, phone")
    .in("id", [...new Set(data.map((a) => a.client_id))]);
  if (clientsError) throw clientsError;
  const byId = new Map(clients.map((c) => [c.id, c]));

  return data.map((a) => ({
    id: a.id,
    startsAt: a.starts_at,
    endsAt: a.ends_at,
    status: a.status,
    serviceName: a.service_name,
    priceCents: a.price_cents,
    currency: a.currency,
    clientId: a.client_id,
    clientName: byId.get(a.client_id)?.full_name ?? "Cliente",
    clientPhone: byId.get(a.client_id)?.phone ?? "",
    notes: a.notes,
  }));
}

/** Excepciones que tocan el rango (RLS: solo las propias). */
export async function listAgendaExceptions(
  supabase: Client,
  professionalId: string,
  from: Date,
  to: Date,
): Promise<AgendaException[]> {
  const { data, error } = await supabase
    .from("schedule_exceptions")
    .select("id, type, starts_at, ends_at")
    .eq("professional_id", professionalId)
    .lt("starts_at", to.toISOString())
    .gt("ends_at", from.toISOString());
  if (error) throw error;
  return data.map((e) => ({ id: e.id, type: e.type, startsAt: e.starts_at, endsAt: e.ends_at }));
}
