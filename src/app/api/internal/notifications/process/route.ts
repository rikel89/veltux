import { timingSafeEqual } from "node:crypto";
import { getRealSmsSender } from "@/lib/sms";
import { createAdminClient } from "@/lib/supabase/admin";
import { appointmentLink } from "@/modules/notifications/links";
import { processNotificationBatch } from "@/modules/notifications/processor";

function authorized(request: Request): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) return false;
  const given = Buffer.from(request.headers.get("authorization") ?? "");
  const expected = Buffer.from(`Bearer ${secret}`);
  return given.length === expected.length && timingSafeEqual(given, expected);
}

/** Lo invoca una tarea programada. Sin proveedor no toca la cola: los mensajes siguen pendientes. */
export async function GET(request: Request) {
  if (!authorized(request)) return Response.json({ error: "UNAUTHORIZED" }, { status: 401 });

  const sender = getRealSmsSender();
  if (!sender) return Response.json({ claimed: 0, sent: 0, failed: 0, skipped: "NO_SMS_PROVIDER" });

  const admin = createAdminClient();
  const result = await processNotificationBatch({
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
  return Response.json(result);
}
