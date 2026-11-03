"use server";

import { refresh } from "next/cache";
import { zonedTimeToUtc } from "@/lib/datetime";
import { fieldErrors, type FormState } from "@/lib/validations/common";
import { requireMyProfessional } from "@/modules/professionals/context";
import { newAppointmentSchema, rescheduleSchema, statusChangeSchema } from "./schemas";

/** Mensajes para los errores con nombre de las funciones de citas en PostgreSQL. */
const DB_ERRORS: Record<string, FormState> = {
  OUTSIDE_SCHEDULE: {
    error: "Esa hora está fuera de tu horario o en un día libre o bloqueado.",
    fieldErrors: { force: "Márcalo para reservarla igualmente" },
  },
  SLOT_TAKEN: { error: "Ese hueco ya está ocupado (o pisa el margen de otra cita). Elige otra hora." },
  IN_THE_PAST: {
    error: "Esa hora ya ha pasado.",
    fieldErrors: { force: "Márcalo si estás registrando una cita pasada" },
  },
  INVALID_TIME: { fieldErrors: { time: "Usa horas en múltiplos de 5 minutos" } },
  SERVICE_NOT_FOUND: { fieldErrors: { serviceId: "El servicio no existe o está inactivo" } },
  CLIENT_NOT_FOUND: { fieldErrors: { clientId: "El cliente no existe o está archivado" } },
  PROFESSIONAL_WITHOUT_LICENSE: { error: "No tienes licencia activa: pide al propietario que te asigne una." },
  NOT_FOUND: { error: "No se encontró la cita." },
  INVALID_TRANSITION: { error: "Ese cambio no es posible en el estado actual de la cita." },
  NOT_STARTED: { error: "Solo puedes marcarla así cuando la cita ya ha empezado." },
};

const dbError = (message: string, fallback: string): FormState => DB_ERRORS[message] ?? { error: fallback };

const READ_ONLY: FormState = { error: "Tu ficha está desactivada: solo puedes consultar tus datos." };

export async function createAppointment(_prev: FormState, formData: FormData): Promise<FormState> {
  const { supabase, ctx } = await requireMyProfessional();
  if (!ctx) return { error: "No tienes ficha de profesional." };
  if (ctx.status !== "active") return READ_ONLY;

  const parsed = newAppointmentSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { fieldErrors: fieldErrors(parsed.error) };
  const v = parsed.data;

  const { error } = await supabase.rpc("create_my_appointment", {
    p_service_id: v.serviceId,
    p_client_id: v.clientId,
    p_starts_at: zonedTimeToUtc(v.date, v.time, ctx.timeZone).toISOString(),
    p_notes: v.notes ?? undefined,
    p_force: v.force,
  });
  if (error) return dbError(error.message, "No se pudo crear la cita.");

  refresh();
  return { ok: true, message: "Cita creada." };
}

export async function rescheduleAppointment(_prev: FormState, formData: FormData): Promise<FormState> {
  const { supabase, ctx } = await requireMyProfessional();
  if (!ctx) return { error: "No tienes ficha de profesional." };
  if (ctx.status !== "active") return READ_ONLY;

  const parsed = rescheduleSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { fieldErrors: fieldErrors(parsed.error) };
  const v = parsed.data;

  const { error } = await supabase.rpc("reschedule_my_appointment", {
    p_appointment_id: v.appointmentId,
    p_starts_at: zonedTimeToUtc(v.date, v.time, ctx.timeZone).toISOString(),
    p_force: v.force,
  });
  if (error) return dbError(error.message, "No se pudo mover la cita.");

  refresh();
  return { ok: true, message: "Cita movida." };
}

const STATUS_MESSAGE = {
  confirmed: "Cita marcada como pendiente de realizar.",
  completed: "Cita completada.",
  no_show: "Marcada como no presentada.",
  cancelled: "Cita cancelada. El hueco vuelve a estar libre.",
} as const;

export async function changeAppointmentStatus(_prev: FormState, formData: FormData): Promise<FormState> {
  const { supabase, ctx } = await requireMyProfessional();
  if (!ctx) return { error: "No tienes ficha de profesional." };
  if (ctx.status !== "active") return READ_ONLY;

  const parsed = statusChangeSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { fieldErrors: fieldErrors(parsed.error) };
  const v = parsed.data;

  const { error } = await supabase.rpc("set_my_appointment_status", {
    p_appointment_id: v.appointmentId,
    p_status: v.status,
    p_reason: v.reason ?? undefined,
  });
  if (error) return dbError(error.message, "No se pudo cambiar el estado.");

  refresh();
  return { ok: true, message: STATUS_MESSAGE[v.status] };
}
