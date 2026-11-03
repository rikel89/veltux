/** URL pública de la aplicación (enlaces de email, redirecciones de Auth). */
export function getSiteUrl(): string {
  const explicit = process.env.NEXT_PUBLIC_SITE_URL;
  if (explicit) return explicit.replace(/\/+$/, "");
  if (process.env.VERCEL_URL) return `https://${process.env.VERCEL_URL}`;
  return "http://localhost:3000";
}

/** Dirección pública completa de una ruta ("/mi-salon" → "https://…/mi-salon"). */
export function publicUrl(path: string): string {
  return `${getSiteUrl()}${path}`;
}

/** La misma dirección para mostrarla, sin el protocolo. */
export function publicLabel(path: string): string {
  return publicUrl(path).replace(/^https?:\/\//, "");
}
