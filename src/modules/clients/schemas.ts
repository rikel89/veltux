import { z } from "zod";
import { checkbox, emailSchema, optional, phoneSchema } from "@/lib/validations/common";

export const clientSchema = z.object({
  fullName: z.string().trim().min(1, "Indica el nombre").max(120, "Máximo 120 caracteres"),
  phone: phoneSchema,
  email: optional(emailSchema()),
  notes: optional(z.string().trim().max(2000, "Máximo 2000 caracteres")),
  marketingConsent: checkbox,
});

export type ClientInput = z.infer<typeof clientSchema>;

/** Alta rápida desde la agenda: nombre, teléfono y email opcional. */
export const quickClientSchema = clientSchema.pick({ fullName: true, phone: true, email: true });

export const clientIdSchema = z.object({ clientId: z.uuid() });

/**
 * Texto de búsqueda seguro para filtros de PostgREST: sin caracteres que
 * alteren la sintaxis de `or()` ni comodines.
 */
export function sanitizeSearch(raw: string | null | undefined): string {
  return (raw ?? "")
    .replace(/[,()*%\\:"']/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 60);
}
