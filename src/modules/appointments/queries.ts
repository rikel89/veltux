import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database.types";
import type { DashboardAppointment } from "@/modules/dashboard/types";

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
