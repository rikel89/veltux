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

export type RenderedMessage = { subject: string; text: string; actionLabel?: string };

/** Asunto y texto del email. No incluye datos privados: ni notas ni motivos. */
export function renderMessage(template: string, p: NotificationPayload): RenderedMessage {
  const tz = p.timezone ?? "Europe/Madrid";
  const at = when(p.starts_at, tz);
  const salon = p.salon_name ?? "Tu establecimiento";

  switch (template) {
    case "appointment.created":
      return {
        subject: `Cita confirmada en ${salon}`,
        text: `Tu cita es el ${at} con ${p.professional_name} (${p.service_name}).`,
        actionLabel: "Ver o cancelar mi cita",
      };
    case "appointment.reminder":
      return {
        subject: `Recordatorio de tu cita en ${salon}`,
        text: `Te recordamos tu cita del ${at} con ${p.professional_name}.`,
        actionLabel: "Ver o cancelar mi cita",
      };
    case "appointment.cancelled":
      return { subject: `Cita cancelada en ${salon}`, text: `Tu cita del ${at} ha sido cancelada.` };
    case "appointment.rescheduled":
      return {
        subject: `Tu cita en ${salon} ha cambiado`,
        text: `Tu cita ha cambiado al ${at} con ${p.professional_name}.`,
        actionLabel: "Ver o cancelar mi cita",
      };
    case "appointment.reassigned":
      return {
        subject: `Tu cita en ${salon} ha cambiado`,
        text: `Tu cita será el ${at} con ${p.professional_name} (${p.service_name}).`,
        actionLabel: "Ver o cancelar mi cita",
      };
    case "change.reschedule_proposed":
      return {
        subject: `${p.professional_name} te propone otra hora`,
        text: `Te propone cambiar tu cita en ${salon} al ${when(p.proposed_starts_at, tz)}. Si no respondes, tu cita seguirá como está.`,
        actionLabel: "Responder",
      };
    case "change.reassignment_proposed": {
      const price = p.proposed_price_cents === undefined ? "" : `, ${formatMoney(p.proposed_price_cents, p.currency)}`;
      return {
        subject: `Propuesta de cambio para tu cita en ${salon}`,
        text: `Te proponemos tu cita del ${when(p.proposed_starts_at, tz)} con ${p.target_name} (${p.proposed_service_name}${price}). Si no respondes, tu cita seguirá como está.`,
        actionLabel: "Responder",
      };
    }
    default:
      throw new Error(`Plantilla desconocida: ${template}`);
  }
}
