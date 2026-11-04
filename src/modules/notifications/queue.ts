import "server-only";
import { after } from "next/server";
import { getRealEmailSender } from "@/lib/email";
import { createAdminClient } from "@/lib/supabase/admin";
import { appointmentLink } from "./links";
import { processNotificationBatch } from "./processor";

/** Envía lo pendiente. Sin proveedor no toca la cola: los mensajes siguen pendientes. */
export async function runNotificationQueue() {
  const sender = getRealEmailSender();
  if (!sender || !process.env.SUPABASE_SECRET_KEY) {
    return { claimed: 0, sent: 0, failed: 0, skipped: "NO_EMAIL_PROVIDER" as const };
  }

  const admin = createAdminClient();
  return processNotificationBatch({
    sender,
    linkFor: appointmentLink,
    claim: async (batch) => {
      const { data, error } = await admin.rpc("claim_pending_notifications", { p_batch_size: batch });
      if (error) throw error;
      return data;
    },
    record: async (id, r) => {
      const { error } = await admin.rpc("record_notification_result", {
        p_id: id,
        p_ok: r.ok,
        p_provider: r.provider,
        p_message_id: r.messageId,
        p_error: r.error,
      });
      if (error) throw error;
    },
  });
}

/**
 * Tras una acción con aviso, lo envía sin hacer esperar a la persona. Si falla,
 * sigue en la cola para los reintentos de la tarea programada.
 */
export function flushNotificationsLater() {
  after(async () => {
    try {
      await runNotificationQueue();
    } catch (error) {
      console.error("Cola de notificaciones", error);
    }
  });
}
