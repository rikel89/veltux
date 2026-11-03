import { describe, expect, it } from "vitest";
import { describeExceptionWhen } from "@/modules/scheduling/format";
import { exceptionRange, exceptionSchema, groupByWeekday, weeklyMinutes, weeklyScheduleSchema } from "@/modules/scheduling/schemas";
import { centsToInput, priceSchema, serviceSchema } from "@/modules/services/schemas";

const TZ = "Europe/Madrid";

describe("weeklyScheduleSchema", () => {
  it("acepta jornada partida y el mismo horario en días distintos", () => {
    const result = weeklyScheduleSchema.safeParse([
      { weekday: 1, startTime: "09:00", endTime: "14:00" },
      { weekday: 1, startTime: "16:00", endTime: "20:00" },
      { weekday: 2, startTime: "09:00", endTime: "14:00" },
    ]);
    expect(result.success).toBe(true);
  });

  it("marca las franjas solapadas del mismo día", () => {
    const result = weeklyScheduleSchema.safeParse([
      { weekday: 1, startTime: "09:00", endTime: "14:00" },
      { weekday: 1, startTime: "13:30", endTime: "18:00" },
    ]);
    expect(result.success).toBe(false);
    expect(result.error?.issues.map((i) => i.path)).toEqual([
      [0, "startTime"],
      [1, "startTime"],
    ]);
  });

  it("franjas contiguas no se solapan", () => {
    expect(
      weeklyScheduleSchema.safeParse([
        { weekday: 3, startTime: "09:00", endTime: "14:00" },
        { weekday: 3, startTime: "14:00", endTime: "15:00" },
      ]).success,
    ).toBe(true);
  });

  it("rechaza fin anterior al inicio y minutos fuera de la rejilla", () => {
    expect(weeklyScheduleSchema.safeParse([{ weekday: 1, startTime: "14:00", endTime: "09:00" }]).success).toBe(false);
    expect(weeklyScheduleSchema.safeParse([{ weekday: 1, startTime: "09:07", endTime: "14:00" }]).success).toBe(false);
    expect(weeklyScheduleSchema.safeParse([{ weekday: 0, startTime: "09:00", endTime: "14:00" }]).success).toBe(false);
  });

  it("agrupa por día y suma las horas semanales", () => {
    const slots = [
      { weekday: 1, startTime: "16:00", endTime: "20:00" },
      { weekday: 1, startTime: "09:00", endTime: "14:00" },
    ];
    expect(groupByWeekday(slots)[1].map((s) => s.startTime)).toEqual(["09:00", "16:00"]);
    expect(groupByWeekday(slots)[7]).toEqual([]);
    expect(weeklyMinutes(slots)).toBe(9 * 60);
  });
});

describe("exceptionSchema y exceptionRange", () => {
  it("un día libre cubre días completos en la zona del salón", () => {
    const input = exceptionSchema.parse({ type: "day_off", startDate: "2026-12-24", endDate: "2026-12-26", reason: "" });
    const { startsAt, endsAt } = exceptionRange(input, TZ);
    expect(startsAt.toISOString()).toBe("2026-12-23T23:00:00.000Z");
    expect(endsAt.toISOString()).toBe("2026-12-26T23:00:00.000Z");
    expect(input.reason).toBeNull();
  });

  it("un bloqueo usa la hora local, también en verano", () => {
    const input = exceptionSchema.parse({ type: "block", date: "2027-07-01", startTime: "10:00", endTime: "11:30" });
    const { startsAt, endsAt } = exceptionRange(input, TZ);
    expect(startsAt.toISOString()).toBe("2027-07-01T08:00:00.000Z");
    expect(endsAt.toISOString()).toBe("2027-07-01T09:30:00.000Z");
  });

  it("valida orden de fechas, horas y duración máxima", () => {
    expect(exceptionSchema.safeParse({ type: "day_off", startDate: "2026-12-26", endDate: "2026-12-24" }).success).toBe(false);
    expect(exceptionSchema.safeParse({ type: "day_off", startDate: "2027-01-01", endDate: "2027-06-01" }).success).toBe(false);
    expect(
      exceptionSchema.safeParse({ type: "extra_availability", date: "2027-01-02", startTime: "12:00", endTime: "10:00" }).success,
    ).toBe(false);
    expect(exceptionSchema.safeParse({ type: "break", date: "2027-01-02", startTime: "10:00", endTime: "11:00" }).success).toBe(
      false,
    );
  });

  it("describe cada excepción en lenguaje natural", () => {
    expect(
      describeExceptionWhen(
        { type: "day_off", startsAt: "2026-12-23T23:00:00Z", endsAt: "2026-12-26T23:00:00Z" },
        TZ,
      ),
    ).toBe("jue, 24 dic – sáb, 26 dic");
    expect(
      describeExceptionWhen({ type: "day_off", startsAt: "2026-12-23T23:00:00Z", endsAt: "2026-12-24T23:00:00Z" }, TZ),
    ).toBe("jue, 24 dic");
    expect(
      describeExceptionWhen({ type: "block", startsAt: "2027-07-01T08:00:00Z", endsAt: "2027-07-01T09:30:00Z" }, TZ),
    ).toBe("jue, 1 jul · 10:00–11:30");
  });
});

describe("serviceSchema", () => {
  it("convierte precios escritos a mano en céntimos", () => {
    expect(priceSchema.parse("15")).toBe(1500);
    expect(priceSchema.parse("15,5")).toBe(1550);
    expect(priceSchema.parse(" 22.90 € ")).toBe(2290);
    expect(priceSchema.safeParse("quince").success).toBe(false);
    expect(priceSchema.safeParse("-5").success).toBe(false);
    expect(centsToInput(1550)).toBe("15,50");
    expect(centsToInput(1500)).toBe("15");
  });

  it("valida duración y margen en múltiplos de 5 y lee las casillas", () => {
    const base = { name: "Corte", durationMinutes: "30", bufferAfterMinutes: "0", price: "15" };
    const ok = serviceSchema.parse({ ...base, isPublic: "on" });
    expect(ok).toMatchObject({ durationMinutes: 30, price: 1500, isPublic: true, isActive: false, description: null });
    expect(serviceSchema.safeParse({ ...base, durationMinutes: "32" }).success).toBe(false);
    expect(serviceSchema.safeParse({ ...base, durationMinutes: "0" }).success).toBe(false);
    expect(serviceSchema.safeParse({ ...base, bufferAfterMinutes: "150" }).success).toBe(false);
    expect(serviceSchema.safeParse({ ...base, name: "C" }).success).toBe(false);
  });
});
