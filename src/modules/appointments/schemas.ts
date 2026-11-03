import { z } from "zod";
import { checkbox, optional } from "@/lib/validations/common";
import { dateKeySchema, timeSchema } from "@/modules/scheduling/schemas";

export const newAppointmentSchema = z.object({
  serviceId: z.uuid({ message: "Elige un servicio" }),
  clientId: z.uuid({ message: "Elige o crea un cliente" }),
  date: dateKeySchema,
  time: timeSchema,
  notes: optional(z.string().trim().max(1000, "Máximo 1000 caracteres")),
  force: checkbox,
});

export const rescheduleSchema = z.object({
  appointmentId: z.uuid(),
  date: dateKeySchema,
  time: timeSchema,
  force: checkbox,
});

/** Estados que el profesional puede fijar desde la agenda. */
export const statusChangeSchema = z.object({
  appointmentId: z.uuid(),
  status: z.enum(["confirmed", "completed", "no_show", "cancelled"]),
  reason: optional(z.string().trim().max(300, "Máximo 300 caracteres")),
});

export const AGENDA_VIEWS = ["dia", "semana"] as const;
export type AgendaView = (typeof AGENDA_VIEWS)[number];

/** Parámetros de la URL de la agenda, con valores por defecto seguros. */
export function parseAgendaParams(
  params: Record<string, string | string[] | undefined>,
  todayKey: string,
): { dateKey: string; view: AgendaView } {
  const fecha = typeof params.fecha === "string" ? params.fecha : undefined;
  const vista = typeof params.vista === "string" ? params.vista : undefined;
  return {
    dateKey: fecha && dateKeySchema.safeParse(fecha).success ? fecha : todayKey,
    view: (AGENDA_VIEWS as readonly string[]).includes(vista ?? "") ? (vista as AgendaView) : "dia",
  };
}
