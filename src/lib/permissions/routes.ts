/** Prefijos de las áreas privadas de VELTUX. */
export const PROTECTED_PREFIXES = ["/panel", "/profesional", "/propietario", "/admin", "/cuenta"] as const;

export function isProtectedPath(pathname: string): boolean {
  return PROTECTED_PREFIXES.some((prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`));
}

/** Evita redirecciones abiertas tras el login: solo rutas internas. */
export function safeRedirectPath(next: string | null | undefined, fallback = "/panel"): string {
  if (!next || !next.startsWith("/") || next.startsWith("//") || next.startsWith("/\\")) {
    return fallback;
  }
  return next;
}
