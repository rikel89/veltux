import { describe, expect, it } from "vitest";
import {
  addDays,
  isoWeekday,
  startOfIsoWeek,
  toLocalDateKey,
  zonedDayRange,
  zonedTimeToUtc,
} from "@/lib/datetime";

const TZ = "Europe/Madrid";

describe("datetime", () => {
  it("convierte hora local de Madrid a UTC en invierno (UTC+1) y verano (UTC+2)", () => {
    expect(zonedTimeToUtc("2026-01-15", "09:00", TZ).toISOString()).toBe("2026-01-15T08:00:00.000Z");
    expect(zonedTimeToUtc("2026-07-15", "09:00", TZ).toISOString()).toBe("2026-07-15T07:00:00.000Z");
  });

  it("calcula el rango del día del cambio de hora (23 h)", () => {
    const { start, end } = zonedDayRange("2026-03-29", TZ);
    expect((end.getTime() - start.getTime()) / 3_600_000).toBe(23);
  });

  it("obtiene la fecha civil en la zona del salón", () => {
    expect(toLocalDateKey(new Date("2026-11-02T23:30:00Z"), TZ)).toBe("2026-11-03");
  });

  it("maneja semanas ISO (lunes = 1)", () => {
    expect(isoWeekday("2026-11-03")).toBe(2); // martes
    expect(isoWeekday("2026-11-08")).toBe(7); // domingo
    expect(startOfIsoWeek("2026-11-08")).toBe("2026-11-02");
    expect(addDays("2026-12-31", 1)).toBe("2027-01-01");
  });
});
