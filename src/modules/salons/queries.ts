import "server-only";
import { createClient } from "@/lib/supabase/server";
import type { Database } from "@/types/database.types";
import { requireArea } from "@/modules/auth/access";

export type SalonOverviewRow = Database["public"]["Functions"]["admin_salon_overview"]["Returns"][number];

/** Vista global de establecimientos (solo administradores; la función lo comprueba). */
export async function listSalonOverview(): Promise<SalonOverviewRow[]> {
  await requireArea("admin");
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("admin_salon_overview");
  if (error) throw error;
  return data ?? [];
}

export async function isSalonSlugTaken(slug: string): Promise<boolean> {
  const supabase = await createClient();
  const { count, error } = await supabase.from("salons").select("id", { count: "exact", head: true }).eq("slug", slug);
  if (error) throw error;
  return (count ?? 0) > 0;
}

export type OwnerSalonSummary = {
  salon: Database["public"]["Tables"]["salons"]["Row"];
  subscription: Database["public"]["Tables"]["subscriptions"]["Row"] | null;
  licensesInUse: number;
  professionals: Array<{ id: string; displayName: string; status: string; hasLicense: boolean }>;
};

/** Resumen del establecimiento para su propietario (RLS: solo si es owner). */
export async function getOwnerSalonSummary(salonId: string): Promise<OwnerSalonSummary | null> {
  const supabase = await createClient();
  const [salon, subscription, professionals, licenses] = await Promise.all([
    supabase.from("salons").select("*").eq("id", salonId).maybeSingle(),
    supabase.from("subscriptions").select("*").eq("salon_id", salonId).maybeSingle(),
    supabase
      .from("professionals")
      .select("id, display_name, status")
      .eq("salon_id", salonId)
      .order("sort_order")
      .order("display_name"),
    supabase.from("license_assignments").select("professional_id").eq("salon_id", salonId).is("revoked_at", null),
  ]);
  for (const r of [salon, subscription, professionals, licenses]) if (r.error) throw r.error;
  if (!salon.data) return null;

  const licensed = new Set((licenses.data ?? []).map((l) => l.professional_id));
  return {
    salon: salon.data,
    subscription: subscription.data,
    licensesInUse: licensed.size,
    professionals: (professionals.data ?? []).map((p) => ({
      id: p.id,
      displayName: p.display_name,
      status: p.status,
      hasLicense: licensed.has(p.id),
    })),
  };
}
