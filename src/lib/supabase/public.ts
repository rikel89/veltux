import "server-only";
import { createClient as createSupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database.types";
import { getSupabasePublicEnv } from "./env";

/**
 * Cliente anónimo sin cookies para las páginas y la API públicas: nunca
 * actúa con la sesión de quien visita (aunque sea un profesional).
 */
export function createPublicClient() {
  const { url, publishableKey } = getSupabasePublicEnv();
  return createSupabaseClient<Database>(url, publishableKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}
