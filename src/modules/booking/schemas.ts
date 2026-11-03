import { z } from "zod";
import { emailSchema, optional, phoneSchema } from "@/lib/validations/common";
import { dateKeySchema } from "@/modules/scheduling/schemas";

export const slotsQuerySchema = z
  .object({ serviceId: z.uuid(), from: dateKeySchema, to: dateKeySchema })
  .refine((v) => v.to >= v.from, { message: "Rango no válido", path: ["to"] });

export const otpRequestSchema = z.object({
  professionalId: z.uuid(),
  phone: phoneSchema,
});

export const bookingRequestSchema = z.object({
  otpId: z.uuid(),
  code: z
    .string()
    .trim()
    .regex(/^\d{6}$/, "El código tiene 6 cifras"),
  serviceId: z.uuid(),
  startsAt: z.iso.datetime({ offset: true }),
  fullName: z.string().trim().min(2, "Indica tu nombre").max(120, "Máximo 120 caracteres"),
  email: optional(emailSchema()),
  notes: optional(z.string().trim().max(500, "Máximo 500 caracteres")),
});

const publicServiceSchema = z.object({
  id: z.string(),
  name: z.string(),
  description: z.string().nullable(),
  duration_minutes: z.number(),
  price_cents: z.number(),
  currency: z.string(),
});

const publicProfessionalSchema = z.object({
  id: z.string(),
  slug: z.string(),
  display_name: z.string(),
  bio: z.string().nullable(),
  avatar_url: z.string().nullable(),
  color: z.string(),
  min_notice_minutes: z.number(),
  booking_horizon_days: z.number(),
  services: z.array(publicServiceSchema),
});

/** Respuesta de get_public_salon(): solo datos públicos. */
export const publicSalonSchema = z.object({
  id: z.string(),
  slug: z.string(),
  name: z.string(),
  kind: z.string(),
  city: z.string().nullable(),
  address_line: z.string().nullable(),
  timezone: z.string(),
  professionals: z.array(publicProfessionalSchema),
});

export type PublicSalon = z.infer<typeof publicSalonSchema>;
export type PublicProfessional = z.infer<typeof publicProfessionalSchema>;
export type PublicService = z.infer<typeof publicServiceSchema>;

/** Respuestas de error de la API pública: código estable + mensaje para la persona. */
export const PUBLIC_ERRORS = {
  INVALID_INPUT: { status: 400, message: "Revisa los datos." },
  FORBIDDEN_ORIGIN: { status: 403, message: "Petición no permitida." },
  NOT_BOOKABLE: { status: 404, message: "Este profesional no acepta reservas online ahora mismo." },
  INVALID_PHONE: { status: 400, message: "Escribe un teléfono válido." },
  TOO_MANY_REQUESTS: { status: 429, message: "Has pedido demasiados códigos. Espera unos minutos y vuelve a intentarlo." },
  SMS_UNAVAILABLE: { status: 503, message: "La reserva online no está disponible en este momento. Llama al establecimiento." },
  SMS_FAILED: { status: 502, message: "No hemos podido enviar el SMS. Revisa el número e inténtalo de nuevo." },
  OTP_INVALID: { status: 400, message: "El código no es correcto." },
  OTP_EXPIRED: { status: 410, message: "El código ha caducado. Pide uno nuevo." },
  OTP_LOCKED: { status: 423, message: "Demasiados intentos con este código. Pide uno nuevo." },
  SLOT_UNAVAILABLE: { status: 409, message: "Esa hora acaba de ocuparse. Elige otra." },
  INVALID_NAME: { status: 400, message: "Indica tu nombre." },
  INVALID_RANGE: { status: 400, message: "Rango de fechas no válido." },
  SERVER_ERROR: { status: 500, message: "Algo ha fallado. Inténtalo de nuevo." },
} as const;

export type PublicErrorCode = keyof typeof PUBLIC_ERRORS;

export function publicErrorCode(message: string | undefined): PublicErrorCode {
  return message && message in PUBLIC_ERRORS ? (message as PublicErrorCode) : "SERVER_ERROR";
}
