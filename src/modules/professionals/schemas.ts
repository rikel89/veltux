import { z } from "zod";
import { checkbox, optional, phoneSchema } from "@/lib/validations/common";

/** Colores de agenda disponibles (identifican al profesional en vistas compartidas). */
export const PROFESSIONAL_COLORS = [
  { value: "#B8FF65", label: "Lima" },
  { value: "#60A5FA", label: "Azul" },
  { value: "#F472B6", label: "Rosa" },
  { value: "#FBBF24", label: "Ámbar" },
  { value: "#A78BFA", label: "Violeta" },
  { value: "#34D399", label: "Esmeralda" },
  { value: "#F87171", label: "Coral" },
  { value: "#94A3B8", label: "Pizarra" },
] as const;

/** Antelación mínima para reservar online (minutos). */
export const NOTICE_OPTIONS = [0, 30, 60, 120, 240, 720, 1440, 2880] as const;
/** Hasta cuántos días vista se puede reservar online. */
export const HORIZON_OPTIONS = [7, 14, 30, 60, 90, 180] as const;

const colorValues = PROFESSIONAL_COLORS.map((c) => c.value) as [string, ...string[]];

export const professionalProfileSchema = z.object({
  displayName: z.string().trim().min(2, "Mínimo 2 caracteres").max(80),
  bio: optional(z.string().trim().max(500, "Máximo 500 caracteres")),
  phone: optional(phoneSchema),
  color: z.enum(colorValues),
  acceptsOnlineBooking: checkbox,
  minNoticeMinutes: z.coerce.number().int().refine((v) => (NOTICE_OPTIONS as readonly number[]).includes(v), "Opción no válida"),
  bookingHorizonDays: z.coerce.number().int().refine((v) => (HORIZON_OPTIONS as readonly number[]).includes(v), "Opción no válida"),
});

export type ProfessionalProfileInput = z.infer<typeof professionalProfileSchema>;
