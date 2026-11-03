import { formatLongDate, formatTime, toLocalDateKey } from "@/lib/datetime";
import { formatMoney } from "@/lib/format";
import type { NotificationStatus } from "@/types/database";

export type NotificationPayload = {
  starts_at?: string;
  service_name?: string;
  salon_name?: string;
  professional_name?: string;
  timezone?: string;
  proposed_starts_at?: string;
  target_name?: string;
  proposed_service_name?: string;
  proposed_price_cents?: number;
  currency?: string;
};

const NEEDS_LINK = new Set([
  "appointment.created",
  "appointment.reminder",
  "appointment.rescheduled",
  "appointment.reassigned",
  "change.reschedule_proposed",
  "change.reassignment_proposed",
]);

export const needsClientLink = (template: string) => NEEDS_LINK.has(template);

export const TEMPLATE_LABEL: Record<string, string> = {
  "appointment.created": "Nueva reserva",
  "appointment.reminder": "Recordatorio",
  "appointment.cancelled": "Cancelación",
  "appointment.rescheduled": "Cambio confirmado",
  "appointment.reassigned": "Cambio confirmado",
  "change.reschedule_proposed": "Reprogramación propuesta",
  "change.reassignment_proposed": "Reasignación propuesta",
};

export const NOTIFICATION_STATUS_LABEL: Record<NotificationStatus, string> = {
  pending: "Pendiente",
  processing: "Pendiente",
  sent: "Enviada",
  delivered: "Entregada",
  failed: "Fallida",
};

function when(instant: string | undefined, tz: string): string {
  if (!instant) return "";
  return `${formatLongDate(toLocalDateKey(new Date(instant), tz)).toLowerCase()} a las ${formatTime(instant, tz)}`;
}

/** Texto del SMS. No incluye datos privados: ni notas ni motivos. */
export function renderSms(template: string, p: NotificationPayload, link?: string | null): string {
  const tz = p.timezone ?? "Europe/Madrid";
  const at = when(p.starts_at, tz);
  const salon = p.salon_name ?? "Tu establecimiento";
  const tail = link ? ` Gestiónala: ${link}` : "";

  switch (template) {
    case "appointment.created":
      return `${salon}: cita confirmada el ${at} con ${p.professional_name} (${p.service_name}).${tail}`;
    case "appointment.reminder":
      return `${salon}: te recordamos tu cita el ${at} con ${p.professional_name}.${tail}`;
    case "appointment.cancelled":
      return `${salon}: tu cita del ${at} ha sido cancelada.`;
    case "appointment.rescheduled":
      return `${salon}: tu cita ha cambiado al ${at} con ${p.professional_name}.${tail}`;
    case "appointment.reassigned":
      return `${salon}: tu cita será el ${at} con ${p.professional_name} (${p.service_name}).${tail}`;
    case "change.reschedule_proposed":
      return `${salon}: ${p.professional_name} te propone cambiar tu cita al ${when(p.proposed_starts_at, tz)}. Responde aquí: ${link ?? ""}`.trim();
    case "change.reassignment_proposed": {
      const price = p.proposed_price_cents === undefined ? "" : `, ${formatMoney(p.proposed_price_cents, p.currency)}`;
      return `${salon}: te proponemos tu cita del ${when(p.proposed_starts_at, tz)} con ${p.target_name} (${p.proposed_service_name}${price}). Responde aquí: ${link ?? ""}`.trim();
    }
    default:
      throw new Error(`Plantilla desconocida: ${template}`);
  }
}
