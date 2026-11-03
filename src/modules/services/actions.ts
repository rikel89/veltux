"use server";

import { refresh } from "next/cache";
import { fieldErrors, type FormState } from "@/lib/validations/common";
import { requireMyProfessional } from "@/modules/professionals/context";
import { serviceIdSchema, serviceSchema, type ServiceInput } from "./schemas";

const toRow = (v: ServiceInput) => ({
  name: v.name,
  description: v.description,
  duration_minutes: v.durationMinutes,
  buffer_after_minutes: v.bufferAfterMinutes,
  price_cents: v.price,
  is_public: v.isPublic,
  is_active: v.isActive,
});

const READ_ONLY: FormState = { error: "Tu ficha está desactivada: solo puedes consultar tus datos." };

/** Alta de servicio en el catálogo propio (RLS: solo profesionales activos). */
export async function createService(_prev: FormState, formData: FormData): Promise<FormState> {
  const { supabase, ctx } = await requireMyProfessional();
  if (!ctx) return { error: "No tienes ficha de profesional." };
  if (ctx.status !== "active") return READ_ONLY;

  const parsed = serviceSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { fieldErrors: fieldErrors(parsed.error) };

  const { error } = await supabase
    .from("services")
    .insert({ ...toRow(parsed.data), salon_id: ctx.salonId, professional_id: ctx.professionalId });
  if (error) return { error: "No se pudo crear el servicio." };

  refresh();
  return { ok: true, message: `«${parsed.data.name}» añadido a tus servicios.` };
}

export async function updateService(_prev: FormState, formData: FormData): Promise<FormState> {
  const { supabase, ctx } = await requireMyProfessional();
  if (!ctx) return { error: "No tienes ficha de profesional." };
  if (ctx.status !== "active") return READ_ONLY;

  const id = serviceIdSchema.safeParse(Object.fromEntries(formData));
  const parsed = serviceSchema.safeParse(Object.fromEntries(formData));
  if (!id.success) return { error: "Servicio no válido." };
  if (!parsed.success) return { fieldErrors: fieldErrors(parsed.error) };

  const { data, error } = await supabase
    .from("services")
    .update(toRow(parsed.data))
    .eq("id", id.data.serviceId)
    .eq("professional_id", ctx.professionalId)
    .select("id");
  if (error) return { error: "No se pudieron guardar los cambios." };
  if (!data?.length) return { error: "No tienes permisos para modificar este servicio." };

  refresh();
  return { ok: true, message: "Servicio actualizado." };
}

/**
 * Eliminar un servicio. Si ya tiene citas (la FK lo impide para conservar el
 * histórico), se desactiva en su lugar.
 */
export async function deleteService(_prev: FormState, formData: FormData): Promise<FormState> {
  const { supabase, ctx } = await requireMyProfessional();
  if (!ctx) return { error: "No tienes ficha de profesional." };
  if (ctx.status !== "active") return READ_ONLY;

  const id = serviceIdSchema.safeParse(Object.fromEntries(formData));
  if (!id.success) return { error: "Servicio no válido." };

  const { data, error } = await supabase
    .from("services")
    .delete()
    .eq("id", id.data.serviceId)
    .eq("professional_id", ctx.professionalId)
    .select("id");

  if (error?.code === "23503") {
    const { error: deactivateError } = await supabase
      .from("services")
      .update({ is_active: false })
      .eq("id", id.data.serviceId)
      .eq("professional_id", ctx.professionalId);
    if (deactivateError) return { error: "No se pudo desactivar el servicio." };
    refresh();
    return { ok: true, message: "Tiene citas registradas: lo hemos desactivado para conservar el historial." };
  }
  if (error) return { error: "No se pudo eliminar el servicio." };
  if (!data?.length) return { error: "No tienes permisos para eliminar este servicio." };

  refresh();
  return { ok: true, message: "Servicio eliminado." };
}
