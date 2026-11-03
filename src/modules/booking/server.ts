import "server-only";
import { createHmac } from "node:crypto";
import { isSupabaseConfigured } from "@/lib/supabase/env";
import { createPublicClient } from "@/lib/supabase/public";
import { PUBLIC_ERRORS, publicSalonSchema, type PublicErrorCode, type PublicSalon } from "./schemas";

/** Datos públicos de un establecimiento (null si no existe o no está activo). */
export async function getPublicSalon(slug: string): Promise<PublicSalon | null> {
  if (!isSupabaseConfigured()) return null;
  const { data, error } = await createPublicClient().rpc("get_public_salon", { p_slug: slug });
  if (error) throw error;
  if (!data) return null;
  return publicSalonSchema.parse(data);
}

export function errorResponse(code: PublicErrorCode, fieldErrors?: Record<string, string>) {
  const { status, message } = PUBLIC_ERRORS[code];
  return Response.json({ error: code, message, ...(fieldErrors ? { fieldErrors } : {}) }, { status });
}

/**
 * Las peticiones de escritura deben venir de la propia web (protección CSRF
 * básica para una API sin sesión).
 */
export function isSameOrigin(request: Request): boolean {
  const origin = request.headers.get("origin");
  if (!origin) return false;
  try {
    return new URL(origin).host === request.headers.get("host");
  } catch {
    return false;
  }
}

/** Huella de la IP (HMAC): sirve para limitar abusos sin guardar la IP. */
export function ipHash(request: Request): string | null {
  const forwarded = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim();
  const ip = forwarded || request.headers.get("x-real-ip");
  const secret = process.env.SUPABASE_SECRET_KEY;
  if (!ip || !secret) return null;
  return createHmac("sha256", secret).update(ip).digest("hex").slice(0, 32);
}

export async function readJson(request: Request): Promise<unknown> {
  try {
    return await request.json();
  } catch {
    return null;
  }
}
