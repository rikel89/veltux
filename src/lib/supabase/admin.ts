import "server-only";
import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database.types";
import { getSupabasePublicEnv } from "./env";

/**
 * Cliente privilegiado (omite RLS). Uso exclusivo en servidor para procesos
 * de sistema: cola de notificaciones, webhooks de Stripe, tareas programadas.
 * `server-only` hace fallar el build si se importa desde el navegador.
 */
export function createAdminClient() {
  const secretKey = process.env.SUPABASE_SECRET_KEY;
  if (!secretKey) {
    throw new Error("SUPABASE_SECRET_KEY no está definida");
  }
  const { url } = getSupabasePublicEnv();
  return createClient<Database>(url, secretKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}
