import "server-only";
import { createHmac, timingSafeEqual } from "node:crypto";
import { z } from "zod";
import { getSiteUrl } from "@/lib/site";

/**
 * Enlace firmado del cliente: /cita/{id}.{firma}. No se guarda en ninguna
 * tabla: los mensajes pendientes y el historial del profesional no contienen el token.
 */
function secret(): string | null {
  return process.env.APPOINTMENT_LINK_SECRET || process.env.SUPABASE_SECRET_KEY || null;
}

function sign(appointmentId: string, key: string): string {
  return createHmac("sha256", key).update(`appointment:${appointmentId}`).digest("base64url").slice(0, 32);
}

export function appointmentToken(appointmentId: string): string | null {
  const key = secret();
  return key ? `${appointmentId}.${sign(appointmentId, key)}` : null;
}

export function appointmentLink(appointmentId: string): string | null {
  const token = appointmentToken(appointmentId);
  return token ? `${getSiteUrl()}/cita/${token}` : null;
}

/** Id de la cita si la firma es válida; null en cualquier otro caso. */
export function verifyAppointmentToken(token: string): string | null {
  const key = secret();
  const [id, signature, ...rest] = token.split(".");
  if (!key || !signature || rest.length > 0 || !z.uuid().safeParse(id).success) return null;
  const expected = Buffer.from(sign(id, key));
  const given = Buffer.from(signature);
  return expected.length === given.length && timingSafeEqual(expected, given) ? id : null;
}
