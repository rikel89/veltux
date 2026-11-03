import { describe, expect, it } from "vitest";
import { isProtectedPath, safeRedirectPath } from "@/lib/permissions/routes";
import { readSupabasePublicEnv } from "@/lib/supabase/env";

describe("rutas protegidas", () => {
  it("protege las áreas privadas y deja pública la raíz y el portal", () => {
    expect(isProtectedPath("/profesional")).toBe(true);
    expect(isProtectedPath("/profesional/agenda")).toBe(true);
    expect(isProtectedPath("/propietario")).toBe(true);
    expect(isProtectedPath("/admin/salones")).toBe(true);
    expect(isProtectedPath("/panel")).toBe(true);
    expect(isProtectedPath("/cuenta/contrasena")).toBe(true);
    expect(isProtectedPath("/recuperar")).toBe(false);
    expect(isProtectedPath("/")).toBe(false);
    expect(isProtectedPath("/login")).toBe(false);
    expect(isProtectedPath("/barberia-elegance")).toBe(false);
    expect(isProtectedPath("/profesionales-top")).toBe(false);
  });

  it("evita redirecciones abiertas tras el login", () => {
    expect(safeRedirectPath("/profesional/agenda")).toBe("/profesional/agenda");
    expect(safeRedirectPath("https://evil.example")).toBe("/panel");
    expect(safeRedirectPath("//evil.example")).toBe("/panel");
    expect(safeRedirectPath("/\\evil.example")).toBe("/panel");
    expect(safeRedirectPath(null)).toBe("/panel");
  });
});

describe("variables de entorno de Supabase", () => {
  it("acepta una configuración válida", () => {
    expect(
      readSupabasePublicEnv({
        NEXT_PUBLIC_SUPABASE_URL: "http://127.0.0.1:54321",
        NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: "sb_publishable_xxxxxxxxxxxxxxxx",
      }),
    ).toEqual({ url: "http://127.0.0.1:54321", publishableKey: "sb_publishable_xxxxxxxxxxxxxxxx" });
  });

  it("activa el modo demostración si falta o es inválida", () => {
    expect(readSupabasePublicEnv({})).toBeNull();
    expect(
      readSupabasePublicEnv({ NEXT_PUBLIC_SUPABASE_URL: "no-es-url", NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: "x".repeat(30) }),
    ).toBeNull();
  });
});
