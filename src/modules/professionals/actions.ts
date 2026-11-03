"use server";

import { refresh } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { fieldErrors, type FormState } from "@/lib/validations/common";
import { getAccess, requireArea } from "@/modules/auth/access";
import { getMyProfessionalContext } from "./queries";
import { professionalProfileSchema } from "./schemas";

/** El profesional edita su propia ficha (RLS: user_id = auth.uid(); GRANT por columna). */
export async function updateMyProfessionalProfile(_prev: FormState, formData: FormData): Promise<FormState> {
  await requireArea("professional");
  const access = await getAccess();
  if (!access.userId) return { error: "Sesión no válida." };

  const parsed = professionalProfileSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { fieldErrors: fieldErrors(parsed.error) };
  const v = parsed.data;

  const supabase = await createClient();
  const ctx = await getMyProfessionalContext(supabase, access.userId);
  if (!ctx) return { error: "No tienes ficha de profesional." };

  const { data, error } = await supabase
    .from("professionals")
    .update({
      display_name: v.displayName,
      bio: v.bio,
      phone: v.phone,
      color: v.color,
      accepts_online_booking: v.acceptsOnlineBooking,
      min_notice_minutes: v.minNoticeMinutes,
      booking_horizon_days: v.bookingHorizonDays,
    })
    .eq("id", ctx.professionalId)
    .eq("user_id", access.userId)
    .select("id");
  if (error) return { error: "No se pudieron guardar los cambios." };
  if (!data?.length) return { error: "No tienes permisos para modificar esta ficha." };

  refresh(); // actualiza el nombre en el sidebar
  return { ok: true, message: "Perfil actualizado." };
}
