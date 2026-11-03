import { describe, expect, it } from "vitest";
import { buildDayColumns, buildLoads, columnsHourRange, computeDayLoad, type OverviewSpan, type ScheduleRow } from "@/modules/salons/overview";

const TZ = "Europe/Madrid";
const MONDAY = "2026-11-30"; // UTC+1

const row = (over: Partial<ScheduleRow> = {}): ScheduleRow => ({
  professionalId: "a",
  weekday: 1,
  startTime: "09:00",
  endTime: "13:00",
  validFrom: "2026-01-01",
  validUntil: null,
  ...over,
});
const span = (kind: OverviewSpan["kind"], startsAt: string, endsAt: string, professionalId = "a"): OverviewSpan => ({ professionalId, kind, startsAt, endsAt });

describe("computeDayLoad", () => {
  it("calcula la parte ocupada del horario, sin contar lo que queda fuera", () => {
    const load = computeDayLoad(MONDAY, [row()], [span("busy", "2026-11-30T08:00:00Z", "2026-11-30T09:00:00Z"), span("busy", "2026-11-30T15:00:00Z", "2026-11-30T16:00:00Z")], TZ);
    expect(load).toEqual({ dateKey: MONDAY, availableMinutes: 240, bookedMinutes: 60, percentage: 25 });
  });

  it("lo no disponible reduce el tiempo de trabajo y el extra lo amplía", () => {
    const load = computeDayLoad(
      MONDAY,
      [row()],
      [span("unavailable", "2026-11-30T08:00:00Z", "2026-11-30T10:00:00Z"), span("extra", "2026-11-30T15:00:00Z", "2026-11-30T16:00:00Z"), span("busy", "2026-11-30T15:00:00Z", "2026-11-30T15:30:00Z")],
      TZ,
    );
    expect(load).toMatchObject({ availableMinutes: 180, bookedMinutes: 30, percentage: 17 });
  });

  it("un día libre completo o sin horario no tiene porcentaje", () => {
    expect(computeDayLoad("2026-12-01", [row()], [], TZ).percentage).toBeNull();
    expect(computeDayLoad(MONDAY, [row()], [span("unavailable", "2026-11-29T23:00:00Z", "2026-11-30T23:00:00Z")], TZ).percentage).toBeNull();
  });

  it("respeta la vigencia de cada versión del horario", () => {
    expect(computeDayLoad(MONDAY, [row({ validUntil: "2026-11-29" }), row({ validFrom: "2026-11-30", endTime: "11:00" })], [], TZ).availableMinutes).toBe(120);
  });

  it("no cuenta dos veces citas solapadas", () => {
    const load = computeDayLoad(MONDAY, [row()], [span("busy", "2026-11-30T08:00:00Z", "2026-11-30T09:00:00Z"), span("busy", "2026-11-30T08:30:00Z", "2026-11-30T09:30:00Z")], TZ);
    expect(load.bookedMinutes).toBe(90);
  });
});

describe("buildLoads", () => {
  it("agrega por profesional y por establecimiento sobre minutos, no sobre porcentajes", () => {
    const { loads, totals } = buildLoads(
      [{ id: "a", name: "Ana" }, { id: "b", name: "Bea" }],
      [MONDAY],
      [row(), row({ professionalId: "b", endTime: "10:00" })],
      [span("busy", "2026-11-30T08:00:00Z", "2026-11-30T09:00:00Z", "b")],
      TZ,
    );
    expect(loads.map((l) => l.percentage)).toEqual([0, 100]);
    expect(totals).toEqual({ availableMinutes: 300, bookedMinutes: 60, freeMinutes: 240, percentage: 20 });
  });
});

describe("rejilla del día", () => {
  it("separa franjas por profesional y amplía las horas visibles", () => {
    const columns = buildDayColumns(
      [{ id: "a", name: "Ana" }],
      MONDAY,
      [row()],
      [span("busy", "2026-11-30T06:00:00Z", "2026-11-30T06:30:00Z"), span("busy", "2026-11-30T08:00:00Z", "2026-11-30T08:30:00Z", "otro")],
      TZ,
    );
    expect(columns[0]).toMatchObject({ windows: [{ startMin: 540, endMin: 780 }], busy: [{ startMin: 420, endMin: 450 }] });
    expect(columnsHourRange(columns)).toEqual({ startHour: 7, endHour: 20 });
  });
});
