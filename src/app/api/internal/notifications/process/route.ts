import { timingSafeEqual } from "node:crypto";
import { runNotificationQueue } from "@/modules/notifications/queue";

function authorized(request: Request): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) return false;
  const given = Buffer.from(request.headers.get("authorization") ?? "");
  const expected = Buffer.from(`Bearer ${secret}`);
  return given.length === expected.length && timingSafeEqual(given, expected);
}

/** Tarea programada: recordatorios y reintentos. Los demás avisos salen al momento. */
export async function GET(request: Request) {
  if (!authorized(request)) return Response.json({ error: "UNAUTHORIZED" }, { status: 401 });
  return Response.json(await runNotificationQueue());
}
