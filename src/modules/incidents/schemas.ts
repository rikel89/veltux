import { z } from "zod";
import { optional } from "@/lib/validations/common";
import { dateKeySchema, timeSchema } from "@/modules/scheduling/schemas";

const reason = optional(z.string().trim().max(300, "Máximo 300 caracteres"));
const message = optional(z.string().trim().max(500, "Máximo 500 caracteres"));

export const blockDaySchema = z.object({ date: dateKeySchema, reason });

export const cancelDaySchema = z.object({
  date: dateKeySchema,
  /** Vacío: todas las citas activas de la jornada. */
  appointmentId: optional(z.uuid()),
  reason,
});

export const proposeRescheduleSchema = z.object({
  appointmentId: z.uuid(),
  date: dateKeySchema,
  time: timeSchema,
  message,
});

export const requestReassignmentSchema = z.object({
  appointmentId: z.uuid(),
  targetProfessionalId: z.uuid({ message: "Elige un profesional" }),
  message,
});

export const respondReassignmentSchema = z
  .object({
    requestId: z.uuid(),
    decision: z.enum(["accept", "reject"]),
    serviceId: optional(z.uuid()),
  })
  .refine((v) => v.decision === "reject" || v.serviceId, { message: "Elige tu servicio", path: ["serviceId"] });

export const requestIdSchema = z.object({ requestId: z.uuid() });
