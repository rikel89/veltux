import { z } from "zod";
import { emailSchema, professionalSlugSchema } from "@/lib/validations/common";

export const REVOKE_REASONS = [
  { value: "Baja del profesional", label: "Baja del profesional" },
  { value: "Reasignación de licencia", label: "Reasignar la licencia a otra persona" },
  { value: "Reducción del plan", label: "Reducción del plan contratado" },
  { value: "Otro motivo", label: "Otro motivo" },
] as const;

const uuid = z.uuid("Identificador no válido");

export const inviteProfessionalSchema = z.object({
  email: emailSchema(),
  displayName: z.string().trim().min(2, "Mínimo 2 caracteres").max(80),
  slug: professionalSlugSchema,
  assignLicense: z.preprocess((v) => v === "on" || v === "true", z.boolean()),
});

export const professionalIdSchema = z.object({ professionalId: uuid });

export const revokeLicenseSchema = z.object({
  assignmentId: uuid,
  reason: z.enum(REVOKE_REASONS.map((r) => r.value) as [string, ...string[]], { message: "Elige un motivo" }),
});

export const deactivateSchema = z.object({
  professionalId: uuid,
  reason: z.string().trim().max(200).optional(),
});

export const licenseQuantitySchema = z.object({
  salonId: uuid,
  quantity: z.coerce.number().int("Número entero").min(0, "Mínimo 0").max(500, "Máximo 500"),
});
