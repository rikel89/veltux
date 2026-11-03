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

export type ProfessionalProfile = {
  id: string;
  displayName: string;
  slug: string;
  bio: string | null;
  phone: string | null;
  color: string;
  acceptsOnlineBooking: boolean;
  salonSlug: string;
};

/** Ficha editable del profesional autenticado. */
export async function getMyProfessionalProfile(supabase: Client, userId: string): Promise<ProfessionalProfile | null> {
  const { data, error } = await supabase
    .from("professionals")
    .select("id, display_name, slug, bio, phone, color, accepts_online_booking, salon_id")
    .eq("user_id", userId)
    .order("created_at")
    .limit(1)
    .maybeSingle();
  if (error) throw error;
  if (!data) return null;

  const { data: salon, error: salonError } = await supabase.from("salons").select("slug").eq("id", data.salon_id).single();
  if (salonError) throw salonError;

  return {
    id: data.id,
    displayName: data.display_name,
    slug: data.slug,
    bio: data.bio,
    phone: data.phone,
    color: data.color,
    acceptsOnlineBooking: data.accepts_online_booking,
    salonSlug: salon.slug,
  };
}
