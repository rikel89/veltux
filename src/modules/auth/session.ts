import "server-only";
import { redirect } from "next/navigation";
import { connection } from "next/server";
import { isSupabaseConfigured } from "@/lib/supabase/env";
import { createClient } from "@/lib/supabase/server";

export type SessionUser = { id: string; email: string | null };

export type Session =
  | { mode: "demo" }
  | { mode: "live"; user: SessionUser; supabase: Awaited<ReturnType<typeof createClient>> };

/**
 * Capa de acceso a la sesión (DAL). Valida el JWT con getClaims() en lugar de
 * confiar en la cookie. Sin Supabase configurado devuelve el modo demostración.
 */
export async function requireSession(): Promise<Session> {
  if (!isSupabaseConfigured()) return { mode: "demo" };

  // getClaims() compara la caducidad del token con la hora actual: debe
  // evaluarse siempre en tiempo de petición, nunca durante el prerender.
  await connection();
  const supabase = await createClient();
  const { data, error } = await supabase.auth.getClaims();
  const sub = data?.claims?.sub;
  if (error || !sub) redirect("/login");

  const email = typeof data.claims.email === "string" ? data.claims.email : null;
  return { mode: "live", user: { id: sub, email }, supabase };
}
