"use server";

import { refresh } from "next/cache";
import { redirect } from "next/navigation";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { getSiteUrl } from "@/lib/site";
import { fieldErrors, type FormState } from "@/lib/validations/common";
import { getAccess, ownerSalon, requireArea } from "@/modules/auth/access";
import { isSalonSlugTaken } from "./queries";
import { createSalonSchema, salonSettingsSchema } from "./schemas";

const DB_ERRORS: Record<string, FormState> = {
  SLUG_TAKEN: { fieldErrors: { salonSlug: "Esta dirección ya está en uso" } },
  OWNER_NOT_FOUND: { error: "No se encontró el usuario propietario tras invitarlo. Inténtalo de nuevo." },
  PROFESSIONAL_SLUG_REQUIRED: { fieldErrors: { professionalSlug: "Necesario si el propietario atiende con agenda" } },
  FORBIDDEN: { error: "No tienes permisos para dar de alta establecimientos." },
};

/**
 * Alta de establecimiento por el administrador (piloto con alta cerrada):
 * 1) invita al propietario por email (o reutiliza su cuenta si ya existe),
 * 2) crea salón, suscripción, membresías y licencia en una única transacción.
 */
export async function createSalon(_prev: FormState, formData: FormData): Promise<FormState> {
  await requireArea("admin");

  const parsed = createSalonSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { fieldErrors: fieldErrors(parsed.error) };
  const input = parsed.data;

  if (await isSalonSlugTaken(input.salonSlug)) return DB_ERRORS.SLUG_TAKEN;

  let admin;
  try {
    admin = createAdminClient();
  } catch {
    return { error: "Falta SUPABASE_SECRET_KEY en el servidor: es necesaria para enviar invitaciones." };
  }

  let invited = true;
  const { error: inviteError } = await admin.auth.admin.inviteUserByEmail(input.ownerEmail, {
    data: { full_name: input.ownerFullName },
    redirectTo: `${getSiteUrl()}/cuenta/contrasena`,
  });
  if (inviteError) {
    if (inviteError.code === "email_exists") {
      invited = false; // ya tiene cuenta: se le vincula sin reenviar invitación
    } else if (inviteError.status === 429) {
      return { error: "Límite de envío de emails alcanzado. Configura un SMTP propio o espera unos minutos." };
    } else {
      return { error: `No se pudo enviar la invitación: ${inviteError.message}` };
    }
  }

  const supabase = await createClient();
  const { error } = await supabase.rpc("create_salon_with_owner", {
    p_owner_email: input.ownerEmail,
    p_owner_full_name: input.ownerFullName,
    p_salon_name: input.salonName,
    p_salon_slug: input.salonSlug,
    p_salon_kind: input.salonKind,
    p_salon_city: input.salonCity ?? undefined,
    p_salon_phone: input.salonPhone ?? undefined,
    p_license_quantity: input.licenseQuantity,
    p_owner_works: input.ownerWorks,
    p_professional_slug: input.professionalSlug ?? undefined,
  });
  if (error) {
    return DB_ERRORS[error.message] ?? { error: "No se pudo crear el establecimiento. Revisa los datos." };
  }

  redirect(`/admin/establecimientos?creado=${encodeURIComponent(input.salonSlug)}&invitado=${invited ? 1 : 0}`);
}

/** Actualiza los datos del establecimiento del propietario (RLS + GRANT por columna). */
export async function updateSalonSettings(_prev: FormState, formData: FormData): Promise<FormState> {
  await requireArea("owner");
  const salon = ownerSalon(await getAccess());
  if (!salon) return { error: "No eres propietario de ningún establecimiento." };

  const parsed = salonSettingsSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { fieldErrors: fieldErrors(parsed.error) };
  const v = parsed.data;

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("salons")
    .update({
      name: v.name,
      kind: v.kind,
      timezone: v.timezone,
      phone: v.phone,
      email: v.email,
      address_line: v.addressLine,
      city: v.city,
      postal_code: v.postalCode,
    })
    .eq("id", salon.salonId)
    .select("id");
  if (error) return { error: "No se pudieron guardar los cambios." };
  if (!data?.length) return { error: "No tienes permisos para modificar este establecimiento." };

  refresh(); // actualiza el nombre en el sidebar
  return { ok: true, message: "Datos del establecimiento guardados." };
}
