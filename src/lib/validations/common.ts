import { z } from "zod";

/**
 * Validaciones compartidas. Deben coincidir con las restricciones CHECK de
 * PostgreSQL (supabase/migrations): la base de datos es la última barrera,
 * estas reglas solo dan mensajes claros antes de llegar a ella.
 */

/** Slugs reservados por rutas de la aplicación (igual que salons.slug CHECK). */
export const RESERVED_SALON_SLUGS = [
  "admin",
  "api",
  "app",
  "auth",
  "login",
  "logout",
  "registro",
  "profesional",
  "propietario",
  "reservar",
  "ayuda",
  "soporte",
  "static",
  "www",
  "veltux",
] as const;

export const salonSlugSchema = z
  .string()
  .trim()
  .toLowerCase()
  .regex(/^[a-z0-9](?:[a-z0-9-]{1,48}[a-z0-9])$/, "Entre 3 y 50 caracteres: minúsculas, números y guiones")
  .refine((slug) => !(RESERVED_SALON_SLUGS as readonly string[]).includes(slug), "Esa dirección está reservada");

export const professionalSlugSchema = z
  .string()
  .trim()
  .toLowerCase()
  .regex(/^[a-z0-9](?:[a-z0-9-]{0,38}[a-z0-9])?$/, "Hasta 40 caracteres: minúsculas, números y guiones");

export const phoneSchema = z
  .string()
  .trim()
  .transform((v) => v.replace(/[\s.-]/g, ""))
  .transform((v) => (/^[6789]\d{8}$/.test(v) ? `+34${v}` : v))
  .pipe(z.string().regex(/^\+[1-9][0-9]{6,14}$/, "Formato internacional, p. ej. +34600123456"));

/** Campo opcional de formulario: ausente o vacío → null. */
export const optional = <T extends z.ZodType>(schema: T) =>
  z.preprocess((v) => (v === undefined || (typeof v === "string" && v.trim() === "") ? null : v), schema.nullable());

/** Casilla de verificación de formulario ("on" cuando está marcada). */
export const checkbox = z.preprocess((v) => v === "on" || v === "true" || v === true, z.boolean());

/** Email normalizado: se recorta y pasa a minúsculas ANTES de validar. */
export const emailSchema = (message = "Introduce un email válido") =>
  z.string().trim().toLowerCase().pipe(z.email(message));

export const passwordSchema = z
  .string()
  .min(8, "Mínimo 8 caracteres")
  .max(72, "Máximo 72 caracteres")
  .regex(/[A-Za-z]/, "Incluye al menos una letra")
  .regex(/[0-9]/, "Incluye al menos un número");

/** Convierte un texto en slug (Barbería Elegance → barberia-elegance). */
export function slugify(text: string): string {
  return text
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 50)
    .replace(/-+$/g, "");
}

/** Mensajes de error por campo a partir de un ZodError. */
export function fieldErrors(error: z.ZodError): Record<string, string> {
  const out: Record<string, string> = {};
  for (const issue of error.issues) {
    const key = issue.path.join(".");
    if (key && !out[key]) out[key] = issue.message;
  }
  return out;
}

/** Estado estándar devuelto por las Server Actions de formularios. */
export type FormState = {
  ok?: boolean;
  message?: string;
  error?: string;
  fieldErrors?: Record<string, string>;
};
