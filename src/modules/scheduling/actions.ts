"use server";

import { refresh } from "next/cache";
import { z } from "zod";
import { addDays, formatTime, toLocalDateKey } from "@/lib/datetime";
import { fieldErrors, type FormState } from "@/lib/validations/common";
import { requireMyProfessional } from "@/modules/professionals/context";
import { getAvailableSlots } from "./queries";
import { dateKeySchema, exceptionRange, exceptionSchema, weeklyScheduleSchema } from "./schemas";

const DB_ERRORS: Record<string, string> = {
  FORBIDDEN: "No tienes permisos para modificar este horario.",
  SCHEDULE_OVERLAP: "Hay franjas que se solapan en el mismo día.",
  INVALID_SCHEDULE: "Revisa las franjas: alguna hora no es válida.",
  NOT_BOOKABLE: "Este servicio no admite reservas ahora mismo (¿está inactivo o sin licencia?).",
  INVALID_RANGE: "Rango de fechas no válido.",
};

const READ_ONLY: FormState = { error: "Tu ficha está desactivada: solo puedes consultar tus datos." };

/**
 * Guarda el horario semanal. PostgreSQL cierra la versión vigente y abre una
 * nueva desde hoy, así el histórico de ocupación no cambia.
 */
export async function saveWeeklySchedule(_prev: FormState, formData: FormData): Promise<FormState> {
  const { supabase, ctx } = await requireMyProfessional();
  if (!ctx) return { error: "No tienes ficha de profesional." };
  if (ctx.status !== "active") return READ_ONLY;

  let raw: unknown;
  try {
    raw = JSON.parse(String(formData.get("slots") ?? "[]"));
  } catch {
    return { error: "Horario no válido." };
  }
  const parsed = weeklyScheduleSchema.safeParse(raw);
  if (!parsed.success) return { error: "Revisa las franjas marcadas.", fieldErrors: fieldErrors(parsed.error) };

  const { error } = await supabase.rpc("replace_my_weekly_schedule", {
    p_professional_id: ctx.professionalId,
    p_slots: parsed.data.map((s) => ({ weekday: s.weekday, start_time: s.startTime, end_time: s.endTime })),
  });
  if (error) return { error: DB_ERRORS[error.message] ?? "No se pudo guardar el horario." };

  refresh();
  return { ok: true, message: "Horario guardado. Se aplica desde hoy." };
}

export async function createException(_prev: FormState, formData: FormData): Promise<FormState> {
  const { supabase, ctx } = await requireMyProfessional();
  if (!ctx) return { error: "No tienes ficha de profesional." };
  if (ctx.status !== "active") return READ_ONLY;

  const parsed = exceptionSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { fieldErrors: fieldErrors(parsed.error) };

  const { startsAt, endsAt } = exceptionRange(parsed.data, ctx.timeZone);
  if (endsAt.getTime() <= Date.now()) {
    const field = parsed.data.type === "day_off" ? "endDate" : "date";
    return { fieldErrors: { [field]: "Ya ha pasado" } };
  }

  const { error } = await supabase.from("schedule_exceptions").insert({
    salon_id: ctx.salonId,
    professional_id: ctx.professionalId,
    type: parsed.data.type,
    starts_at: startsAt.toISOString(),
    ends_at: endsAt.toISOString(),
    reason: parsed.data.reason,
  });
  if (error) return { error: "No se pudo guardar la excepción." };

  refresh();
  return { ok: true, message: "Excepción añadida a tu agenda." };
}

export async function deleteException(_prev: FormState, formData: FormData): Promise<FormState> {
  const { supabase, ctx } = await requireMyProfessional();
  if (!ctx) return { error: "No tienes ficha de profesional." };
  if (ctx.status !== "active") return READ_ONLY;

  const id = z.uuid().safeParse(formData.get("exceptionId"));
  if (!id.success) return { error: "Excepción no válida." };

  const { data, error } = await supabase
    .from("schedule_exceptions")
    .delete()
    .eq("id", id.data)
    .eq("professional_id", ctx.professionalId)
    .select("id");
  if (error || !data?.length) return { error: "No se pudo eliminar la excepción." };

  refresh();
  return { ok: true, message: "Excepción eliminada." };
}

export type SlotPreview = { dateKey: string; times: string[] } | { error: string };

/** Vista previa de los huecos que verá un cliente para un servicio y un día. */
export async function previewSlots(serviceId: string, dateKey: string): Promise<SlotPreview> {
  const { supabase, ctx } = await requireMyProfessional();
  if (!ctx) return { error: "No tienes ficha de profesional." };

  const id = z.uuid().safeParse(serviceId);
  const day = dateKeySchema.safeParse(dateKey);
  if (!id.success || !day.success) return { error: "Selecciona un servicio y un día." };

  const today = toLocalDateKey(new Date(), ctx.timeZone);
  if (day.data < today || day.data > addDays(today, 90)) return { error: "Elige un día entre hoy y los próximos 3 meses." };

  try {
    const slots = await getAvailableSlots(supabase, id.data, day.data, day.data);
    return { dateKey: day.data, times: slots.map((s) => formatTime(s.startsAt, ctx.timeZone)) };
  } catch (error) {
    const message = (error as { message?: string } | null)?.message ?? "";
    return { error: DB_ERRORS[message] ?? "No se pudo calcular la disponibilidad." };
  }
}
