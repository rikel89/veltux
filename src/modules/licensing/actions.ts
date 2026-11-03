"use server";

import { refresh } from "next/cache";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { getSiteUrl } from "@/lib/site";
import { fieldErrors, type FormState } from "@/lib/validations/common";
import { ownerSalon, requireArea } from "@/modules/auth/access";
import {
  deactivateSchema,
  inviteProfessionalSchema,
  licenseQuantitySchema,
  professionalIdSchema,
  revokeLicenseSchema,
} from "./schemas";

/** Mensajes para los errores con nombre que lanzan las funciones PostgreSQL. */
const DB_ERRORS: Record<string, FormState> = {
  FORBIDDEN: { error: "No tienes permisos para esta acción." },
  USER_NOT_FOUND: { error: "No se pudo preparar la cuenta del profesional. Inténtalo de nuevo." },
  ALREADY_MEMBER: { fieldErrors: { email: "Esta persona ya forma parte del establecimiento" } },
  SLUG_TAKEN: { fieldErrors: { slug: "Esta dirección ya la usa otro profesional" } },
  LICENSE_LIMIT_REACHED: { error: "No quedan licencias libres. Libera una o amplía el plan." },
  PROFESSIONAL_INACTIVE: { error: "Activa al profesional antes de asignarle una licencia." },
  INVALID_TRANSITION: { error: "Ese cambio de estado no es posible." },
  BELOW_IN_USE: { fieldErrors: { quantity: "No puede ser menor que las licencias en uso" } },
  NOT_FOUND: { error: "No se encontró el profesional." },
};

const dbError = (message: string, fallback: string): FormState => DB_ERRORS[message] ?? { error: fallback };

async function requireOwnerSalon() {
  const salon = ownerSalon(await requireArea("owner"));
  if (!salon) throw new Error("Sin establecimiento");
  return salon;
}

/**
 * Invitar a un profesional: envía el email de Supabase Auth (o reutiliza la
 * cuenta si ya existe) y crea ficha, membresía y licencia en una transacción.
 */
export async function inviteProfessional(_prev: FormState, formData: FormData): Promise<FormState> {
  const salon = await requireOwnerSalon();
  const parsed = inviteProfessionalSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { fieldErrors: fieldErrors(parsed.error) };
  const input = parsed.data;

  let admin;
  try {
    admin = createAdminClient();
  } catch {
    return { error: "Falta SUPABASE_SECRET_KEY en el servidor: es necesaria para enviar invitaciones." };
  }

  let emailSent = true;
  const { error: inviteError } = await admin.auth.admin.inviteUserByEmail(input.email, {
    data: { full_name: input.displayName },
    redirectTo: `${getSiteUrl()}/cuenta/contrasena`,
  });
  if (inviteError) {
    if (inviteError.code === "email_exists") emailSent = false;
    else if (inviteError.status === 429) {
      return { error: "Límite de envío de emails alcanzado. Espera unos minutos o configura un SMTP propio." };
    } else return { error: `No se pudo enviar la invitación: ${inviteError.message}` };
  }

  const supabase = await createClient();
  const { error } = await supabase.rpc("invite_professional", {
    p_salon_id: salon.salonId,
    p_email: input.email,
    p_display_name: input.displayName,
    p_slug: input.slug,
    p_assign_license: input.assignLicense,
  });
  if (error) return dbError(error.message, "No se pudo completar la invitación.");

  refresh();
  return {
    ok: true,
    message: emailSent
      ? `Invitación enviada a ${input.email}. Aparecerá como activo cuando cree su contraseña.`
      : `${input.email} ya tenía cuenta en VELTUX: verá el establecimiento la próxima vez que inicie sesión.`,
  };
}

export async function assignLicense(_prev: FormState, formData: FormData): Promise<FormState> {
  const salon = await requireOwnerSalon();
  const parsed = professionalIdSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: "Solicitud no válida." };

  const supabase = await createClient();
  const { error } = await supabase
    .from("license_assignments")
    .insert({ salon_id: salon.salonId, professional_id: parsed.data.professionalId });
  if (error) return dbError(error.message, "No se pudo asignar la licencia.");

  refresh();
  return { ok: true, message: "Licencia asignada." };
}

export async function revokeLicense(_prev: FormState, formData: FormData): Promise<FormState> {
  const salon = await requireOwnerSalon();
  const parsed = revokeLicenseSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { fieldErrors: fieldErrors(parsed.error) };

  const supabase = await createClient();
  const { data: claims } = await supabase.auth.getClaims();
  const { data, error } = await supabase
    .from("license_assignments")
    .update({ revoked_at: new Date().toISOString(), revoked_by: claims?.claims?.sub ?? null, revoke_reason: parsed.data.reason })
    .eq("id", parsed.data.assignmentId)
    .eq("salon_id", salon.salonId)
    .is("revoked_at", null)
    .select("id");
  if (error) return dbError(error.message, "No se pudo liberar la licencia.");
  if (!data?.length) return { error: "La licencia ya estaba liberada." };

  refresh();
  return { ok: true, message: "Licencia liberada." };
}

export async function deactivateProfessional(_prev: FormState, formData: FormData): Promise<FormState> {
  await requireOwnerSalon();
  const parsed = deactivateSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: "Solicitud no válida." };

  const supabase = await createClient();
  const { error } = await supabase.rpc("set_professional_active", {
    p_professional_id: parsed.data.professionalId,
    p_active: false,
    p_reason: parsed.data.reason || undefined,
  });
  if (error) return dbError(error.message, "No se pudo desactivar.");

  refresh();
  return { ok: true, message: "Profesional desactivado y licencia liberada." };
}

export async function reactivateProfessional(_prev: FormState, formData: FormData): Promise<FormState> {
  await requireOwnerSalon();
  const parsed = professionalIdSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: "Solicitud no válida." };

  const supabase = await createClient();
  const { error } = await supabase.rpc("set_professional_active", {
    p_professional_id: parsed.data.professionalId,
    p_active: true,
  });
  if (error) return dbError(error.message, "No se pudo reactivar.");

  refresh();
  return { ok: true, message: "Profesional reactivado. Asígnale una licencia para que reciba reservas." };
}

/** Ajuste manual del cupo contratado (administrador, fase piloto). */
export async function setLicenseQuantity(_prev: FormState, formData: FormData): Promise<FormState> {
  await requireArea("admin");
  const parsed = licenseQuantitySchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { fieldErrors: fieldErrors(parsed.error) };

  const supabase = await createClient();
  const { error } = await supabase.rpc("admin_set_license_quantity", {
    p_salon_id: parsed.data.salonId,
    p_quantity: parsed.data.quantity,
  });
  if (error) return dbError(error.message, "No se pudo actualizar el cupo.");

  refresh();
  return { ok: true, message: `Cupo actualizado a ${parsed.data.quantity} licencias.` };
}
