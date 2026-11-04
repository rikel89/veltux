"use server";

import { refresh } from "next/cache";
import { createAdminClient } from "@/lib/supabase/admin";
import type { FormState } from "@/lib/validations/common";
import { verifyAppointmentToken } from "./links";
import { flushNotificationsLater } from "./queue";

/**
 * Acciones de la persona que abre el enlace firmado del email. No hay sesión: la
 * firma identifica la cita y las funciones solo las ejecuta el servidor.
 */
function appointmentFrom(formData: FormData): string | null {
  return verifyAppointmentToken(String(formData.get("token") ?? ""));
}

export async function respondAsClient(_prev: FormState, formData: FormData): Promise<FormState> {
  const id = appointmentFrom(formData);
  if (!id) return { error: "El enlace no es válido." };
  const accept = formData.get("decision") === "accept";

  const { data, error } = await createAdminClient().rpc("respond_change_request_as_client", {
    p_appointment_id: id,
    p_accept: accept,
  });
  if (error?.message === "SLOT_UNAVAILABLE") return { error: "Esa hora ya no está disponible. Tu cita sigue como estaba." };
  if (error?.message === "NO_OPEN_REQUEST") return { error: "Esta propuesta ya no está abierta." };
  if (error) return { error: "No se pudo registrar tu respuesta. Inténtalo de nuevo." };

  flushNotificationsLater();
  refresh();
  if (data === "expired") return { error: "La propuesta ha caducado. Tu cita sigue como estaba." };
  return { ok: true, message: data === "applied" ? "Cambio confirmado." : "Propuesta rechazada. Tu cita sigue como estaba." };
}

export async function cancelAsClient(_prev: FormState, formData: FormData): Promise<FormState> {
  const id = appointmentFrom(formData);
  if (!id) return { error: "El enlace no es válido." };

  const { data, error } = await createAdminClient().rpc("cancel_appointment_as_client", { p_appointment_id: id });
  if (error) return { error: "No se pudo cancelar la cita. Inténtalo de nuevo." };
  if (!data) return { error: "Esta cita ya no se puede cancelar." };

  flushNotificationsLater();
  refresh();
  return { ok: true, message: "Cita cancelada." };
}
