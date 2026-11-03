import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database.types";

type Client = SupabaseClient<Database>;

export type ProfessionalContext = {
  professionalId: string;
  displayName: string;
  salonId: string;
  salonName: string;
  salonSlug: string;
  timeZone: string;
  hasActiveLicense: boolean;
};

/** Ficha profesional del usuario autenticado (RLS limita el alcance al salón). */
export async function getMyProfessionalContext(supabase: Client, userId: string): Promise<ProfessionalContext | null> {
  const { data: professional, error } = await supabase
    .from("professionals")
    .select("id, display_name, salon_id")
    .eq("user_id", userId)
    .order("created_at")
    .limit(1)
    .maybeSingle();
  if (error) throw error;
  if (!professional) return null;

  const [salon, license] = await Promise.all([
    supabase.from("salons").select("name, slug, timezone").eq("id", professional.salon_id).single(),
    supabase
      .from("license_assignments")
      .select("id", { count: "exact", head: true })
      .eq("professional_id", professional.id)
      .is("revoked_at", null),
  ]);
  if (salon.error) throw salon.error;
  if (license.error) throw license.error;

  return {
    professionalId: professional.id,
    displayName: professional.display_name,
    salonId: professional.salon_id,
    salonName: salon.data.name,
    salonSlug: salon.data.slug,
    timeZone: salon.data.timezone,
    hasActiveLicense: (license.count ?? 0) > 0,
  };
}
