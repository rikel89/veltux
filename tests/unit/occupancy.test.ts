import { describe, expect, it } from "vitest";
import { averageOccupancy, computeWeekOccupancy } from "@/modules/scheduling/occupancy";

const TZ = "Europe/Madrid";
const WEEK = "2026-11-02"; // lunes

describe("computeWeekOccupancy", () => {
  const schedule = [
    { weekday: 1, startTime: "09:00", endTime: "13:00" },
    { weekday: 1, startTime: "16:00", endTime: "20:00" },
  ];

  it("calcula minutos reservados sobre el horario con jornada partida", () => {
    const days = computeWeekOccupancy(
      WEEK,
      schedule,
      [{ startsAt: "2026-11-02T08:00:00Z", endsAt: "2026-11-02T10:00:00Z" }], // 09:00–11:00 locales
      TZ,
    );
    expect(days[0]).toMatchObject({ availableMinutes: 480, bookedMinutes: 120, percentage: 25 });
  });

  it("recorta las citas que salen del horario laboral", () => {
    const days = computeWeekOccupancy(
      WEEK,
      schedule,
      [{ startsAt: "2026-11-02T11:30:00Z", endsAt: "2026-11-02T15:30:00Z" }], // 12:30–16:30 locales
      TZ,
    );
    expect(days[0].bookedMinutes).toBe(60); // 12:30–13:00 + 16:00–16:30
  });

  it("devuelve null en días sin horario y los ignora en la media", () => {
    const days = computeWeekOccupancy(WEEK, schedule, [], TZ);
    expect(days[1].percentage).toBeNull();
    expect(averageOccupancy(days)).toBe(0);
    expect(averageOccupancy(computeWeekOccupancy(WEEK, [], [], TZ))).toBeNull();
  });
});
