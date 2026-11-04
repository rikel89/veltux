import { needsClientLink, renderMessage, type NotificationPayload } from "./templates";

export type ClaimedNotification = {
  id: string;
  template: string;
  recipient_email: string | null;
  appointment_id: string | null;
  payload: unknown;
};

type SendResult = { ok: true; messageId?: string } | { ok: false; error: string };

export type QueueDeps = {
  claim: (batch: number) => Promise<ClaimedNotification[]>;
  record: (id: string, result: { ok: boolean; provider: string; messageId?: string; error?: string }) => Promise<void>;
  linkFor: (appointmentId: string) => string | null;
  sender: {
    name: string;
    send: (message: { to: string; subject: string; text: string; actionUrl?: string | null; actionLabel?: string }) => Promise<SendResult>;
  };
};

/**
 * Procesa un lote. Cada mensaje se resuelve por separado: un fallo no detiene
 * a los demás, y PostgreSQL decide si se reintenta o queda como fallido.
 */
export async function processNotificationBatch(deps: QueueDeps, batch = 20) {
  const claimed = await deps.claim(batch);
  let sent = 0;
  let failed = 0;

  for (const n of claimed) {
    const provider = deps.sender.name;
    try {
      if (!n.recipient_email) throw new Error("Sin email de destino");
      const link = needsClientLink(n.template) && n.appointment_id ? deps.linkFor(n.appointment_id) : null;
      if (n.template.startsWith("change.") && !link) throw new Error("No se pudo generar el enlace del cliente");
      const message = renderMessage(n.template, n.payload as NotificationPayload);
      const result = await deps.sender.send({
        to: n.recipient_email,
        subject: message.subject,
        text: message.text,
        actionUrl: link,
        actionLabel: message.actionLabel,
      });
      await deps.record(n.id, result.ok ? { ok: true, provider, messageId: result.messageId } : { ok: false, provider, error: result.error });
      if (result.ok) sent++;
      else failed++;
    } catch (error) {
      failed++;
      await deps.record(n.id, { ok: false, provider, error: error instanceof Error ? error.message : "Error desconocido" });
    }
  }
  return { claimed: claimed.length, sent, failed };
}
