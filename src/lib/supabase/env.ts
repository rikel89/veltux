import { z } from "zod";

/**
 * Variables públicas de Supabase. Se leen con acceso estático a `process.env`
 * para que Next.js pueda incrustarlas en el bundle del navegador.
 */
const publicEnvSchema = z.object({
  NEXT_PUBLIC_SUPABASE_URL: z.url(),
  NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: z.string().min(20),
});

export type SupabasePublicEnv = { url: string; publishableKey: string };

export function readSupabasePublicEnv(
  source: Record<string, string | undefined> = {
    NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL,
    NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
  },
): SupabasePublicEnv | null {
  const parsed = publicEnvSchema.safeParse(source);
  if (!parsed.success) return null;
  return {
    url: parsed.data.NEXT_PUBLIC_SUPABASE_URL,
    publishableKey: parsed.data.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
  };
}

/** Sin Supabase configurado la app arranca en modo demostración. */
export function isSupabaseConfigured(): boolean {
  return readSupabasePublicEnv() !== null;
}

export function getSupabasePublicEnv(): SupabasePublicEnv {
  const env = readSupabasePublicEnv();
  if (!env) {
    throw new Error(
      "Supabase no está configurado: define NEXT_PUBLIC_SUPABASE_URL y NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY en .env.local",
    );
  }
  return env;
}
