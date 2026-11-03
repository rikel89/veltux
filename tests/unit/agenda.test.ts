import { describe, expect, it } from "vitest";
import { buildAgendaDays, layoutColumns, minuteOfDay, visibleHourRange, type AgendaAppointment } from "@/modules/appointments/agenda";
import { parseAgendaParams } from "@/modules/appointments/schemas";
import { clientSchema, sanitizeSearch } from "@/modules/clients/schemas";

const TZ = "Europe/Madrid";

const appt = (id: string, startsAt: string, endsAt: string): AgendaAppointment => ({
  id,
  startsAt,
  endsAt,
  status: "confirmed",
  serviceName: "Corte",
  priceCents: 1500,
  currency: "EUR",
  clientId: "c",
  clientName: "Cliente",
  clientPhone: "+34600000000",
  notes: null,
});

describe("minuteOfDay", () => {
  it("devuelve la hora local en minutos, también con horario de verano", () => {
    expect(minuteOfDay("2026-12-01T09:00:00Z", "2026-12-01", TZ)).toBe(10 * 60);
    expect(minuteOfDay("2027-07-01T09:00:00Z", "2027-07-01", TZ)).toBe(11 * 60);
  });

  it("recorta lo que cae fuera del día", () => {
    expect(minuteOfDay("2026-11-30T22:00:00Z", "2026-12-01", TZ)).toBe(0); // 23:00 del día anterior
    expect(minuteOfDay("2026-12-01T23:30:00Z", "2026-12-01", TZ)).toBe(1440); // 00:30 del siguiente
  });
});

describe("buildAgendaDays", () => {
  it("coloca horario, citas y excepciones en su día", () => {
    const [mon, tue] = buildAgendaDays(
      ["2026-11-30", "2026-12-01"],
      [{ weekday: 1, startTime: "09:00", endTime: "14:00" }],
      [appt("a", "2026-12-01T09:00:00Z", "2026-12-01T09:30:00Z")],
      [{ id: "e", type: "day_off", startsAt: "2026-11-29T23:00:00Z", endsAt: "2026-12-01T23:00:00Z" }],
      TZ,
    );
    expect(mon.windows).toEqual([{ startMin: 540, endMin: 840 }]);
    expect(mon.appointments).toHaveLength(0);
    expect(mon.blocks[0]).toMatchObject({ startMin: 0, endMin: 1440 });
    expect(tue.windows).toEqual([]);
    expect(tue.appointments[0]).toMatchObject({ id: "a", startMin: 600, endMin: 630 });
  });

  it("la rejilla cubre al menos 09-20 y se amplía con citas tempranas o tardías", () => {
    const days = buildAgendaDays(["2026-12-01"], [], [appt("a", "2026-12-01T06:30:00Z", "2026-12-01T07:00:00Z")], [], TZ);
    expect(visibleHourRange(days)).toEqual({ startHour: 7, endHour: 20 });
    expect(visibleHourRange(buildAgendaDays(["2026-12-01"], [], [], [], TZ))).toEqual({ startHour: 9, endHour: 20 });
  });
});

describe("layoutColumns", () => {
  it("reparte en columnas solo las citas que coinciden", () => {
    const out = layoutColumns([
      { id: "a", startMin: 600, endMin: 660 },
      { id: "b", startMin: 630, endMin: 690 },
      { id: "c", startMin: 700, endMin: 730 },
    ]);
    const byId = Object.fromEntries(out.map((o) => [o.id, o]));
    expect(byId.a).toMatchObject({ column: 0, columns: 2 });
    expect(byId.b).toMatchObject({ column: 1, columns: 2 });
    expect(byId.c).toMatchObject({ column: 0, columns: 1 });
  });
});

describe("parseAgendaParams", () => {
  it("usa hoy y vista de día si los parámetros no son válidos", () => {
    expect(parseAgendaParams({}, "2026-11-05")).toEqual({ dateKey: "2026-11-05", view: "dia" });
    expect(parseAgendaParams({ fecha: "mañana", vista: "mes" }, "2026-11-05")).toEqual({ dateKey: "2026-11-05", view: "dia" });
    expect(parseAgendaParams({ fecha: "2026-12-24", vista: "semana" }, "2026-11-05")).toEqual({
      dateKey: "2026-12-24",
      view: "semana",
    });
  });
});

describe("clientes", () => {
  it("normaliza el teléfono español y el email", () => {
    const v = clientSchema.parse({ fullName: " Ana ", phone: "600 12 34 56", email: " ANA@Mail.com ", notes: "" });
    expect(v).toMatchObject({ fullName: "Ana", phone: "+34600123456", email: "ana@mail.com", notes: null, marketingConsent: false });
  });

  it("limpia la búsqueda de caracteres que alteran el filtro", () => {
    expect(sanitizeSearch("ana),phone.eq.(1")).toBe("ana phone.eq. 1");
    expect(sanitizeSearch("  50%  *off* ")).toBe("50 off");
    expect(sanitizeSearch(undefined)).toBe("");
  });
});
