import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database.types";

type Client = SupabaseClient<Database>;

export type ServiceItem = {
  id: string;
  name: string;
  description: string | null;
  durationMinutes: number;
  bufferAfterMinutes: number;
  priceCents: number;
  currency: string;
  isActive: boolean;
  isPublic: boolean;
};

/** Catálogo del profesional: activos primero, en el orden elegido. */
export async function listServices(supabase: Client, professionalId: string): Promise<ServiceItem[]> {
  const { data, error } = await supabase
    .from("services")
    .select("id, name, description, duration_minutes, buffer_after_minutes, price_cents, currency, is_active, is_public")
    .eq("professional_id", professionalId)
    .order("is_active", { ascending: false })
    .order("sort_order")
    .order("name");
  if (error) throw error;
  return data.map((s) => ({
    id: s.id,
    name: s.name,
    description: s.description,
    durationMinutes: s.duration_minutes,
    bufferAfterMinutes: s.buffer_after_minutes,
    priceCents: s.price_cents,
    currency: s.currency,
    isActive: s.is_active,
    isPublic: s.is_public,
  }));
}
