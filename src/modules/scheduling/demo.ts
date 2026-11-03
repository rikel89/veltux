import type { ServiceItem } from "@/modules/services/queries";
import type { WeeklyScheduleSlot } from "./occupancy";

/** Catálogo y horario de ejemplo para el modo demostración (no se guardan). */
export const DEMO_SERVICES: ServiceItem[] = [
  { id: "demo-1", name: "Corte clásico", description: null, durationMinutes: 30, bufferAfterMinutes: 0, priceCents: 1500, currency: "EUR", isActive: true, isPublic: true },
  { id: "demo-2", name: "Corte + barba", description: "Corte a tijera o máquina y arreglo de barba con toalla caliente.", durationMinutes: 45, bufferAfterMinutes: 5, priceCents: 2200, currency: "EUR", isActive: true, isPublic: true },
  { id: "demo-3", name: "Arreglo de barba", description: null, durationMinutes: 20, bufferAfterMinutes: 0, priceCents: 1000, currency: "EUR", isActive: true, isPublic: false },
];

export const DEMO_WEEKLY_SCHEDULE: WeeklyScheduleSlot[] = [
  ...[1, 2, 3, 4, 5].flatMap((weekday) => [
    { weekday, startTime: "09:00", endTime: "14:00" },
    { weekday, startTime: "16:00", endTime: "20:00" },
  ]),
  { weekday: 6, startTime: "09:00", endTime: "14:00" },
];
