import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { AppointmentStatus } from "@/types/database";
import type { Database } from "@/types/database.types";
import { sanitizeSearch } from "./schemas";

type Client = SupabaseClient<Database>;

export type ClientSummary = {
  id: string;
  fullName: string;
  phone: string;
  email: string | null;
  archived: boolean;
  visits: number;
  lastVisit: string | null;
};

export type ClientDetail = ClientSummary & {
  notes: string | null;
  marketingConsent: boolean;
  createdAt: string;
  history: {
    id: string;
    startsAt: string;
    serviceName: string;
    priceCents: number;
    currency: string;
    status: AppointmentStatus;
    cancelReason: string | null;
  }[];
};

/** Cartera privada del profesional (RLS: solo la propia). */
export async function listClients(
  supabase: Client,
  professionalId: string,
  opts: { query?: string; archived?: boolean; limit?: number } = {},
): Promise<ClientSummary[]> {
  let request = supabase
    .from("clients")
    .select("id, full_name, phone, email, archived_at")
    .eq("professional_id", professionalId)
    .order("full_name")
    .limit(opts.limit ?? 100);

  request = opts.archived ? request.not("archived_at", "is", null) : request.is("archived_at", null);

  const q = sanitizeSearch(opts.query);
  if (q) {
    const digits = q.replace(/\D/g, "");
    request = request.or(
      digits.length >= 3 ? `full_name.ilike.*${q}*,phone.like.*${digits}*` : `full_name.ilike.*${q}*`,
    );
  }

  const { data, error } = await request;
  if (error) throw error;
  if (data.length === 0) return [];

  const visits = await visitStats(supabase, data.map((c) => c.id));
  return data.map((c) => ({
    id: c.id,
    fullName: c.full_name,
    phone: c.phone,
    email: c.email,
    archived: c.archived_at !== null,
    visits: visits.get(c.id)?.count ?? 0,
    lastVisit: visits.get(c.id)?.last ?? null,
  }));
}

/** Visitas completadas y fecha de la última por cliente. */
async function visitStats(supabase: Client, clientIds: string[]) {
  const { data, error } = await supabase
    .from("appointments")
    .select("client_id, starts_at")
    .in("client_id", clientIds)
    .eq("status", "completed");
  if (error) throw error;
  const out = new Map<string, { count: number; last: string }>();
  for (const a of data) {
    const prev = out.get(a.client_id);
    out.set(a.client_id, {
      count: (prev?.count ?? 0) + 1,
      last: prev && prev.last > a.starts_at ? prev.last : a.starts_at,
    });
  }
  return out;
}

export async function getClientDetail(
  supabase: Client,
  professionalId: string,
  clientId: string,
): Promise<ClientDetail | null> {
  const { data: c, error } = await supabase
    .from("clients")
    .select("id, full_name, phone, email, notes, marketing_consent, archived_at, created_at")
    .eq("professional_id", professionalId)
    .eq("id", clientId)
    .maybeSingle();
  if (error) throw error;
  if (!c) return null;

  const { data: history, error: historyError } = await supabase
    .from("appointments")
    .select("id, starts_at, service_name, price_cents, currency, status, cancel_reason")
    .eq("client_id", clientId)
    .order("starts_at", { ascending: false })
    .limit(100);
  if (historyError) throw historyError;

  const completed = history.filter((a) => a.status === "completed");
  return {
    id: c.id,
    fullName: c.full_name,
    phone: c.phone,
    email: c.email,
    notes: c.notes,
    marketingConsent: c.marketing_consent,
    archived: c.archived_at !== null,
    createdAt: c.created_at,
    visits: completed.length,
    lastVisit: completed[0]?.starts_at ?? null,
    history: history.map((a) => ({
      id: a.id,
      startsAt: a.starts_at,
      serviceName: a.service_name,
      priceCents: a.price_cents,
      currency: a.currency,
      status: a.status,
      cancelReason: a.cancel_reason,
    })),
  };
}
