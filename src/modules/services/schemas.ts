import { z } from "zod";
import { checkbox, optional } from "@/lib/validations/common";

/** Duraciones habituales para el selector (la validación admite cualquier múltiplo de 5). */
export const DURATION_OPTIONS = [10, 15, 20, 25, 30, 35, 40, 45, 50, 60, 75, 90, 105, 120, 150, 180, 240] as const;
export const BUFFER_OPTIONS = [0, 5, 10, 15, 20, 30] as const;

const fiveMinuteSteps = (min: number, max: number) =>
  z.coerce
    .number({ message: "Indica los minutos" })
    .int()
    .min(min, `Mínimo ${min} minutos`)
    .max(max, `Máximo ${max} minutos`)
    .refine((n) => n % 5 === 0, "En múltiplos de 5 minutos");

/** Precio en euros escrito por una persona ("15", "15,5", "15.50 €") → céntimos. */
export const priceSchema = z
  .string()
  .trim()
  .transform((v) => v.replace(/[\s€]/g, "").replace(",", "."))
  .pipe(z.string().regex(/^\d{1,4}(\.\d{1,2})?$/, "Precio en euros, p. ej. 15 o 15,50"))
  .transform((v) => Math.round(Number(v) * 100));

export const serviceSchema = z.object({
  name: z.string().trim().min(2, "Mínimo 2 caracteres").max(80, "Máximo 80 caracteres"),
  description: optional(z.string().trim().max(500, "Máximo 500 caracteres")),
  durationMinutes: fiveMinuteSteps(5, 600),
  bufferAfterMinutes: fiveMinuteSteps(0, 120),
  price: priceSchema,
  isPublic: checkbox,
  isActive: checkbox,
});

export type ServiceInput = z.infer<typeof serviceSchema>;

export const serviceIdSchema = z.object({ serviceId: z.uuid() });

/** Céntimos → texto editable ("1550" → "15,50"). */
export function centsToInput(cents: number): string {
  return cents % 100 === 0 ? String(cents / 100) : (cents / 100).toFixed(2).replace(".", ",");
}
