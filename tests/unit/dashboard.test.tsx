import { render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { TodayAgenda } from "@/components/dashboard/today-agenda";
import { buildDemoDashboard } from "@/modules/dashboard/demo";
import { summarizeDay } from "@/modules/dashboard/summary";
import type { DashboardAppointment } from "@/modules/dashboard/types";

const appt = (id: string, start: string, end: string, status: DashboardAppointment["status"], cents = 1000) => ({
  id,
  startsAt: start,
  endsAt: end,
  status,
  clientName: `Cliente ${id}`,
  serviceName: "Corte",
  priceCents: cents,
  currency: "EUR",
});

describe("summarizeDay", () => {
  it("excluye canceladas y no presentadas de citas e ingresos", () => {
    const now = new Date("2026-11-03T08:00:00Z");
    const result = summarizeDay(
      [
        appt("a", "2026-11-03T07:00:00Z", "2026-11-03T07:30:00Z", "completed", 1500),
        appt("b", "2026-11-03T09:00:00Z", "2026-11-03T09:30:00Z", "confirmed", 2000),
        appt("c", "2026-11-03T10:00:00Z", "2026-11-03T10:30:00Z", "cancelled", 9900),
        appt("d", "2026-11-03T11:00:00Z", "2026-11-03T11:30:00Z", "no_show", 9900),
      ],
      now,
    );
    expect(result.appointmentsToday).toBe(2);
    expect(result.revenueTodayCents).toBe(3500);
    expect(result.nextAppointment?.id).toBe("b");
  });
});

describe("datos de demostración", () => {
  it("se identifican siempre como demo", () => {
    const data = buildDemoDashboard(new Date("2026-11-03T08:00:00Z"));
    expect(data.mode).toBe("demo");
    expect(data.agenda.every((a) => a.id.startsWith("demo-") && a.clientName.includes("demo"))).toBe(true);
  });
});

describe("<TodayAgenda />", () => {
  const props = { now: "2026-11-03T08:00:00Z", timeZone: "Europe/Madrid", nextId: null };

  it("muestra un estado vacío sin citas", () => {
    render(<TodayAgenda {...props} agenda={[]} isDemo={false} />);
    expect(screen.getByText("Tu agenda de hoy está libre")).toBeInTheDocument();
  });

  it("en modo demo no muestra el estado 'Confirmada' sino la etiqueta DEMO", () => {
    const agenda = [appt("x", "2026-11-03T09:00:00Z", "2026-11-03T09:30:00Z", "confirmed")];
    const { container } = render(<TodayAgenda {...props} agenda={agenda} isDemo />);
    const row = within(container.querySelector("li")!);
    expect(row.getByText("Demo")).toBeInTheDocument();
    expect(row.queryByText("Confirmada")).not.toBeInTheDocument();
    expect(row.getByText("10:00")).toBeInTheDocument(); // 09:00Z → 10:00 Madrid
  });
});
