import { z } from "zod";
import { emailSchema, optional, phoneSchema, professionalSlugSchema, salonSlugSchema } from "@/lib/validations/common";

export const SALON_KINDS = [
  { value: "barberia", label: "Barbería" },
  { value: "peluqueria", label: "Peluquería" },
  { value: "unisex", label: "Unisex" },
] as const;

export const SALON_TIMEZONES = [
  { value: "Europe/Madrid", label: "Península y Baleares (Europe/Madrid)" },
  { value: "Atlantic/Canary", label: "Canarias (Atlantic/Canary)" },
] as const;

const kindSchema = z.enum(["barberia", "peluqueria", "unisex"]);
const checkbox = z.preprocess((v) => v === "on" || v === "true" || v === true, z.boolean());

/** Alta de establecimiento por el administrador de la plataforma. */
export const createSalonSchema = z
  .object({
    ownerEmail: emailSchema(),
    ownerFullName: z.string().trim().min(2, "Indica nombre y apellido").max(80),
    salonName: z.string().trim().min(2, "Mínimo 2 caracteres").max(120),
    salonSlug: salonSlugSchema,
    salonKind: kindSchema,
    salonCity: optional(z.string().trim().max(80)),
    salonPhone: optional(phoneSchema),
    licenseQuantity: z.coerce.number().int("Número entero").min(1, "Mínimo 1").max(50, "Máximo 50 en el piloto"),
    ownerWorks: checkbox,
    professionalSlug: optional(professionalSlugSchema),
  })
  .refine((v) => !v.ownerWorks || Boolean(v.professionalSlug), {
    path: ["professionalSlug"],
    message: "Necesario si el propietario atiende con agenda",
  });

export type CreateSalonInput = z.infer<typeof createSalonSchema>;

/** Datos editables del establecimiento por su propietario (columnas con GRANT). */
export const salonSettingsSchema = z.object({
  name: z.string().trim().min(2, "Mínimo 2 caracteres").max(120),
  kind: kindSchema,
  timezone: z.enum(["Europe/Madrid", "Atlantic/Canary"]),
  phone: optional(phoneSchema),
  email: optional(emailSchema("Email no válido")),
  addressLine: optional(z.string().trim().max(160)),
  city: optional(z.string().trim().max(80)),
  postalCode: optional(z.string().trim().regex(/^\d{5}$/, "5 dígitos")),
});

export type SalonSettingsInput = z.infer<typeof salonSettingsSchema>;
