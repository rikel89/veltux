import "server-only";
import { createClient } from "@/lib/supabase/server";
import type { ProfessionalStatus } from "@/types/database";

export type TeamMember = {
  id: string;
  displayName: string;
  email: string | null;
  slug: string;
  status: ProfessionalStatus;
  isSelf: boolean;
  license: { assignmentId: string; assignedAt: string } | null;
};

export type SalonTeam = {
  salonId: string;
  salonSlug: string;
  quantity: number;
  inUse: number;
  members: TeamMember[];
};

/**
 * Equipo y licencias del establecimiento para su propietario.
 * RLS limita la lectura a propietarios del salón: no expone clientes ni citas.
 */
export async function getSalonTeam(salonId: string, currentUserId: string | null): Promise<SalonTeam | null> {
  const supabase = await createClient();
  const [salon, subscription, pros, licenses] = await Promise.all([
    supabase.from("salons").select("slug").eq("id", salonId).maybeSingle(),
    supabase.from("subscriptions").select("license_quantity").eq("salon_id", salonId).maybeSingle(),
    supabase
      .from("professionals")
      .select("id, display_name, email, slug, status, user_id")
      .eq("salon_id", salonId)
      .order("sort_order")
      .order("display_name"),
    supabase
      .from("license_assignments")
      .select("id, professional_id, assigned_at")
      .eq("salon_id", salonId)
      .is("revoked_at", null),
  ]);
  for (const r of [salon, subscription, pros, licenses]) if (r.error) throw r.error;
  if (!salon.data) return null;

  const byPro = new Map((licenses.data ?? []).map((l) => [l.professional_id, l]));
  return {
    salonId,
    salonSlug: salon.data.slug,
    quantity: subscription.data?.license_quantity ?? 0,
    inUse: byPro.size,
    members: (pros.data ?? []).map((p) => {
      const l = byPro.get(p.id);
      return {
        id: p.id,
        displayName: p.display_name,
        email: p.email,
        slug: p.slug,
        status: p.status,
        isSelf: p.user_id !== null && p.user_id === currentUserId,
        license: l ? { assignmentId: l.id, assignedAt: l.assigned_at } : null,
      };
    }),
  };
}

export type LicenseHistoryEntry = {
  id: string;
  professionalName: string;
  assignedAt: string;
  revokedAt: string | null;
  reason: string | null;
};

/** Historial completo de asignaciones (las licencias nunca se borran). */
export async function getLicenseHistory(salonId: string): Promise<LicenseHistoryEntry[]> {
  const supabase = await createClient();
  const [history, pros] = await Promise.all([
    supabase
      .from("license_assignments")
      .select("id, professional_id, assigned_at, revoked_at, revoke_reason")
      .eq("salon_id", salonId)
      .order("assigned_at", { ascending: false })
      .limit(100),
    supabase.from("professionals").select("id, display_name").eq("salon_id", salonId),
  ]);
  if (history.error) throw history.error;
  if (pros.error) throw pros.error;
  const names = new Map((pros.data ?? []).map((p) => [p.id, p.display_name]));

  return (history.data ?? []).map((h) => ({
    id: h.id,
    professionalName: names.get(h.professional_id) ?? "Profesional",
    assignedAt: h.assigned_at,
    revokedAt: h.revoked_at,
    reason: h.revoke_reason,
  }));
}
