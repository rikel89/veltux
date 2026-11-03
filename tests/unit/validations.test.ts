import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import {
  passwordSchema,
  phoneSchema,
  RESERVED_SALON_SLUGS,
  salonSlugSchema,
  slugify,
} from "@/lib/validations/common";
import { createSalonSchema } from "@/modules/salons/schemas";
import { newPasswordSchema, signInSchema } from "@/modules/auth/schemas";

describe("slugs de establecimiento", () => {
  it("coinciden con la lista reservada de la restricción CHECK en PostgreSQL", () => {
    const dbList = ["20261103120000_initial_schema.sql", "20261107090000_sprint6_incidents_notifications.sql"]
      .flatMap((file) => {
        const sql = readFileSync(join(process.cwd(), "supabase/migrations", file), "utf8");
        const block = sql.match(/check \(slug not in \(([\s\S]*?)\)\)/)?.[1] ?? "";
        return [...block.matchAll(/'([^']+)'/g)].map((m) => m[1]);
      })
      .sort();
    expect([...RESERVED_SALON_SLUGS].sort()).toEqual(dbList);
  });

  it("aceptan direcciones válidas y rechazan reservadas o mal formadas", () => {
    expect(salonSlugSchema.parse("  Barberia-Elegance ")).toBe("barberia-elegance");
    expect(salonSlugSchema.safeParse("admin").success).toBe(false);
    expect(salonSlugSchema.safeParse("-mal").success).toBe(false);
    expect(salonSlugSchema.safeParse("ab").success).toBe(false);
  });

  it("slugify elimina tildes y símbolos", () => {
    expect(slugify("Barbería Peñalver & Co.")).toBe("barberia-penalver-co");
  });
});

describe("teléfonos", () => {
  it("normaliza móviles españoles a formato internacional", () => {
    expect(phoneSchema.parse("600 12 34 56")).toBe("+34600123456");
    expect(phoneSchema.parse("+44 7700 900123")).toBe("+447700900123");
    expect(phoneSchema.safeParse("12345").success).toBe(false);
  });
});

describe("emails", () => {
  it("recortan espacios y mayúsculas antes de validar (teclados móviles, pegado)", () => {
    expect(signInSchema.parse({ email: "  Ana@Barberia.ES ", password: "x" }).email).toBe("ana@barberia.es");
  });
});

describe("contraseñas", () => {
  it("exigen longitud, letra y número", () => {
    expect(passwordSchema.safeParse("corta1").success).toBe(false);
    expect(passwordSchema.safeParse("solamenteletras").success).toBe(false);
    expect(passwordSchema.safeParse("veltux2026").success).toBe(true);
  });

  it("la confirmación debe coincidir", () => {
    const r = newPasswordSchema.safeParse({ password: "veltux2026", confirm: "veltux2027" });
    expect(r.success).toBe(false);
    expect(r.error?.issues[0].path).toEqual(["confirm"]);
  });
});

describe("alta de establecimiento", () => {
  const base = {
    ownerEmail: "Duena@Example.com ",
    ownerFullName: "Lucía Pérez",
    salonName: "Barbería Norte",
    salonSlug: "barberia-norte",
    salonKind: "barberia",
    salonCity: "",
    salonPhone: "",
    licenseQuantity: "3",
  };

  it("exige la dirección de agenda si el propietario atiende", () => {
    const r = createSalonSchema.safeParse({ ...base, ownerWorks: "on", professionalSlug: "" });
    expect(r.success).toBe(false);
    expect(r.error?.issues[0].path).toEqual(["professionalSlug"]);
  });

  it("normaliza campos opcionales vacíos y el número de licencias", () => {
    const r = createSalonSchema.parse({ ...base, ownerWorks: "on", professionalSlug: "lucia" });
    expect(r).toMatchObject({ ownerEmail: "duena@example.com", salonCity: null, salonPhone: null, licenseQuantity: 3, ownerWorks: true });
  });

  it("sin casilla marcada, el propietario no atiende", () => {
    expect(createSalonSchema.parse({ ...base }).ownerWorks).toBe(false);
  });
});
