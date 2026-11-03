"use server";

import { refresh } from "next/cache";
import { zonedTimeToUtc } from "@/lib/datetime";
import { fieldErrors, type FormState } from "@/lib/validations/common";
import { requireMyProfessional, type MyProfessional } from "@/modules/professionals/context";
import {
  blockDaySchema,
  cancelDaySchema,
  proposeRescheduleSchema,
  requestIdSchema,
  requestReassignmentSchema,
  respondReassignmentSchema,
} from "./schemas";

const DB_ERRORS: Record<string, FormState> = {
  FORBIDDEN: { error: "No tienes permisos para esta acción." },
  NOT_FOUND: { error: "Ya no está disponible: puede que otra persona haya respondido o que haya cambiado." },
  INVALID_DATE: { fieldErrors: { date: "No puedes bloquear un día pasado" } },
  INVALID_TIME: { fieldErrors: { time: "Elige una hora futura, en múltiplos de 5 minutos" } },
  INVALID_TRANSITION: { error: "Esta cita ya no admite este cambio." },
  OUTSIDE_SCHEDULE: { error: "Esa hora está fuera de tu horario o en un día bloqueado." },
  SLOT_TAKEN: { error: "Esa hora ya está ocupada o pisa el margen de otra cita." },
  REQUEST_ALREADY_OPEN: { error: "Esta cita ya tiene una propuesta abierta. Retírala antes de hacer otra." },
  TARGET_UNAVAILABLE: { error: "Ese profesional no puede recibir citas ahora mismo." },
  REQUEST_EXPIRED: { error: "La solicitud ha caducado." },
  SERVICE_NOT_FOUND: { fieldErrors: { serviceId: "Elige uno de tus servicios activos" } },
  PROFESSIONAL_WITHOUT_LICENSE: { error: "Hace falta una licencia activa." },
};

const dbError = (message: string, fallback: string): FormState => DB_ERRORS[message] ?? { error: fallback };

/** Sesión + ficha activa; `denied` trae el motivo si no puede operar. */
async function activeProfessional(): Promise<
  (MyProfessional & { ctx: NonNullable<MyProfessional["ctx"]>; denied?: undefined }) | { denied: FormState }
> {
  const me = await requireMyProfessional();
  if (!me.ctx) return { denied: { error: "No tienes ficha de profesional." } };
  if (me.ctx.status !== "active") return { denied: { error: "Tu ficha está desactivada: solo puedes consultar tus datos." } };
  return { ...me, ctx: me.ctx };
}

export async function blockDay(_prev: FormState, formData: FormData): Promise<FormState> {
  const me = await activeProfessional();
  if (me.denied) return me.denied;
  const parsed = blockDaySchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { fieldErrors: fieldErrors(parsed.error) };

  const { error } = await me.supabase.rpc("block_my_day", {
    p_professional_id: me.ctx.professionalId,
    p_date: parsed.data.date,
    p_reason: parsed.data.reason ?? undefined,
  });
  if (error) return dbError(error.message, "No se pudo bloquear la jornada.");
  refresh();
  return { ok: true, message: "Jornada bloqueada: ya no se ofrecen huecos ese día. Las citas siguen igual." };
}

/** Una cita (appointmentId) o todas las activas de la jornada. */
export async function cancelDayAppointments(_prev: FormState, formData: FormData): Promise<FormState> {
  const me = await activeProfessional();
  if (me.denied) return me.denied;
  const parsed = cancelDaySchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { fieldErrors: fieldErrors(parsed.error) };
  const v = parsed.data;

  const { data, error } = await me.supabase.rpc("cancel_my_day_appointments", {
    p_professional_id: me.ctx.professionalId,
    p_date: v.date,
    p_ids: v.appointmentId ? [v.appointmentId] : undefined,
    p_reason: v.reason ?? undefined,
  });
  if (error) return dbError(error.message, "No se pudieron cancelar las citas.");
  refresh();
  return { ok: true, message: data === 1 ? "Cita cancelada." : `${data} citas canceladas.` };
}

export async function proposeReschedule(_prev: FormState, formData: FormData): Promise<FormState> {
  const me = await activeProfessional();
  if (me.denied) return me.denied;
  const parsed = proposeRescheduleSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { fieldErrors: fieldErrors(parsed.error) };
  const v = parsed.data;

  const { error } = await me.supabase.rpc("propose_reschedule", {
    p_appointment_id: v.appointmentId,
    p_starts_at: zonedTimeToUtc(v.date, v.time, me.ctx.timeZone).toISOString(),
    p_message: v.message ?? undefined,
  });
  if (error) return dbError(error.message, "No se pudo enviar la propuesta.");
  refresh();
  return { ok: true, message: "Propuesta registrada. La cita no cambia hasta que el cliente acepte." };
}

export async function requestReassignment(_prev: FormState, formData: FormData): Promise<FormState> {
  const me = await activeProfessional();
  if (me.denied) return me.denied;
  const parsed = requestReassignmentSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { fieldErrors: fieldErrors(parsed.error) };
  const v = parsed.data;

  const { error } = await me.supabase.rpc("request_reassignment", {
    p_appointment_id: v.appointmentId,
    p_target_professional_id: v.targetProfessionalId,
    p_message: v.message ?? undefined,
  });
  if (error) return dbError(error.message, "No se pudo enviar la solicitud.");
  refresh();
  return { ok: true, message: "Solicitud enviada. Después de que tu compañero acepte, decidirá el cliente." };
}

export async function respondReassignment(_prev: FormState, formData: FormData): Promise<FormState> {
  const me = await activeProfessional();
  if (me.denied) return me.denied;
  const parsed = respondReassignmentSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { fieldErrors: fieldErrors(parsed.error) };
  const v = parsed.data;

  const { error } = await me.supabase.rpc("respond_my_reassignment", {
    p_request_id: v.requestId,
    p_accept: v.decision === "accept",
    p_service_id: v.serviceId ?? undefined,
  });
  if (error) return dbError(error.message, "No se pudo registrar tu respuesta.");
  refresh();
  return { ok: true, message: v.decision === "accept" ? "Aceptada. Ahora debe confirmarla el cliente." : "Solicitud rechazada." };
}

export async function withdrawRequest(_prev: FormState, formData: FormData): Promise<FormState> {
  const me = await activeProfessional();
  if (me.denied) return me.denied;
  const parsed = requestIdSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: "Solicitud no válida." };

  const { error } = await me.supabase.rpc("cancel_my_change_request", { p_request_id: parsed.data.requestId });
  if (error) return dbError(error.message, "No se pudo retirar la propuesta.");
  refresh();
  return { ok: true, message: "Propuesta retirada." };
}
