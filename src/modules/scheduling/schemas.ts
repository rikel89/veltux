import { z } from "zod";
import { addDays, zonedTimeToUtc } from "@/lib/datetime";
import { optional } from "@/lib/validations/common";
import type { WeeklyScheduleSlot } from "./occupancy";

export const WEEKDAYS = [
  { value: 1, label: "Lunes", short: "Lun" },
  { value: 2, label: "Martes", short: "Mar" },
  { value: 3, label: "Miércoles", short: "Mié" },
  { value: 4, label: "Jueves", short: "Jue" },
  { value: 5, label: "Viernes", short: "Vie" },
  { value: 6, label: "Sábado", short: "Sáb" },
  { value: 7, label: "Domingo", short: "Dom" },
] as const;

/** Igual que el límite de schedule_exceptions_max_length. */
export const MAX_EXCEPTION_DAYS = 92;
/** Igual que el límite de franjas de replace_my_weekly_schedule(). */
export const MAX_WEEKLY_SLOTS = 28;

export const toMinutes = (time: string) => Number(time.slice(0, 2)) * 60 + Number(time.slice(3, 5));

export const timeSchema = z
  .string({ message: "Indica la hora" })
  .regex(/^([01]\d|2[0-3]):[0-5]\d$/, "Hora no válida")
  .refine((t) => toMinutes(t) % 5 === 0, "En múltiplos de 5 minutos");

export const dateKeySchema = z
  .string({ message: "Indica la fecha" })
  .regex(/^\d{4}-\d{2}-\d{2}$/, "Fecha no válida")
  .refine((d) => !Number.isNaN(Date.parse(`${d}T00:00:00Z`)), "Fecha no válida");

const weeklySlotSchema = z
  .object({ weekday: z.number().int().min(1).max(7), startTime: timeSchema, endTime: timeSchema })
  .refine((s) => toMinutes(s.endTime) > toMinutes(s.startTime), {
    message: "La hora de fin debe ser posterior a la de inicio",
    path: ["endTime"],
  });

/** Horario semanal: franjas válidas y sin solapes dentro del mismo día. */
export const weeklyScheduleSchema = z
  .array(weeklySlotSchema)
  .max(MAX_WEEKLY_SLOTS, `Máximo ${MAX_WEEKLY_SLOTS} franjas por semana`)
  .superRefine((slots, ctx) => {
    slots.forEach((a, i) => {
      const overlaps = slots.some(
        (b, j) =>
          j !== i &&
          a.weekday === b.weekday &&
          toMinutes(a.startTime) < toMinutes(b.endTime) &&
          toMinutes(b.startTime) < toMinutes(a.endTime),
      );
      if (overlaps) ctx.addIssue({ code: "custom", message: "Se solapa con otra franja del mismo día", path: [i, "startTime"] });
    });
  });

export const EXCEPTION_TYPES = [
  { value: "day_off", label: "Día libre o vacaciones", hint: "No recibirás reservas en esos días." },
  { value: "block", label: "Bloquear horas", hint: "Un hueco puntual: médico, formación, gestiones…" },
  { value: "extra_availability", label: "Horario extra", hint: "Abre tu agenda fuera de tu horario habitual." },
] as const;

export type ExceptionKind = (typeof EXCEPTION_TYPES)[number]["value"];

const reason = optional(z.string().trim().max(300, "Máximo 300 caracteres"));

export const exceptionSchema = z.discriminatedUnion("type", [
  z
    .object({ type: z.literal("day_off"), startDate: dateKeySchema, endDate: dateKeySchema, reason })
    .refine((v) => v.endDate >= v.startDate, { message: "Debe ser igual o posterior al inicio", path: ["endDate"] })
    .refine((v) => v.endDate < addDays(v.startDate, MAX_EXCEPTION_DAYS), {
      message: `Máximo ${MAX_EXCEPTION_DAYS} días seguidos`,
      path: ["endDate"],
    }),
  z
    .object({
      type: z.enum(["block", "extra_availability"]),
      date: dateKeySchema,
      startTime: timeSchema,
      endTime: timeSchema,
      reason,
    })
    .refine((v) => toMinutes(v.endTime) > toMinutes(v.startTime), {
      message: "La hora de fin debe ser posterior a la de inicio",
      path: ["endTime"],
    }),
]);

export type ExceptionInput = z.infer<typeof exceptionSchema>;

/** Instantes UTC [inicio, fin) de una excepción en la zona del salón. */
export function exceptionRange(input: ExceptionInput, timeZone: string): { startsAt: Date; endsAt: Date } {
  if (input.type === "day_off") {
    return {
      startsAt: zonedTimeToUtc(input.startDate, "00:00", timeZone),
      endsAt: zonedTimeToUtc(addDays(input.endDate, 1), "00:00", timeZone),
    };
  }
  return {
    startsAt: zonedTimeToUtc(input.date, input.startTime, timeZone),
    endsAt: zonedTimeToUtc(input.date, input.endTime, timeZone),
  };
}

/** Franjas agrupadas por día (1…7), ordenadas por hora de inicio. */
export function groupByWeekday(slots: WeeklyScheduleSlot[]): Record<number, { startTime: string; endTime: string }[]> {
  const out: Record<number, { startTime: string; endTime: string }[]> = {};
  for (const day of WEEKDAYS) out[day.value] = [];
  for (const s of [...slots].sort((a, b) => toMinutes(a.startTime) - toMinutes(b.startTime))) {
    out[s.weekday]?.push({ startTime: s.startTime, endTime: s.endTime });
  }
  return out;
}

/** Horas semanales de trabajo. */
export function weeklyMinutes(slots: WeeklyScheduleSlot[]): number {
  return slots.reduce((sum, s) => sum + toMinutes(s.endTime) - toMinutes(s.startTime), 0);
}
