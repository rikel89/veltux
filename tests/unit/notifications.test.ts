import { afterEach, describe, expect, it, vi } from "vitest";
import { processNotificationBatch, type ClaimedNotification } from "@/modules/notifications/processor";
import { NOTIFICATION_STATUS_LABEL, renderSms, TEMPLATE_LABEL } from "@/modules/notifications/templates";

vi.mock("server-only", () => ({}));

const payload = {
  starts_at: "2026-12-01T09:00:00Z",
  service_name: "Corte",
  salon_name: "JMB",
  professional_name: "Javier",
  timezone: "Europe/Madrid",
  proposed_starts_at: "2026-12-02T09:00:00Z",
  target_name: "Lucía",
  proposed_service_name: "Corte + barba",
  proposed_price_cents: 2200,
  currency: "EUR",
};

const item = (id: string, template = "appointment.created"): ClaimedNotification => ({
  id,
  template,
  recipient_phone: "+34600000000",
  appointment_id: "a1",
  payload,
});

describe("renderSms", () => {
  it("escribe cada evento con fecha local y sin datos privados", () => {
    expect(renderSms("appointment.created", payload, "https://x/cita/t")).toBe(
      "JMB: cita confirmada el martes, 1 de diciembre a las 10:00 con Javier (Corte). Gestiónala: https://x/cita/t",
    );
    expect(renderSms("appointment.cancelled", payload)).toBe("JMB: tu cita del martes, 1 de diciembre a las 10:00 ha sido cancelada.");
    expect(renderSms("change.reassignment_proposed", payload, "L")).toContain("con Lucía (Corte + barba, 22");
    expect(() => renderSms("otra", payload)).toThrow();
  });

  it("nombra los estados como la especificación", () => {
    expect(NOTIFICATION_STATUS_LABEL).toMatchObject({ pending: "Pendiente", sent: "Enviada", delivered: "Entregada", failed: "Fallida" });
    expect(TEMPLATE_LABEL["change.reschedule_proposed"]).toBe("Reprogramación propuesta");
  });
});

describe("processNotificationBatch", () => {
  const run = async (items: ClaimedNotification[], send: (to: string, body: string) => Promise<{ ok: true; messageId?: string } | { ok: false; error: string }>, linkFor: () => string | null = () => "L") => {
    const record = vi.fn(async () => undefined);
    const out = await processNotificationBatch({
      claim: async () => items,
      record,
      linkFor,
      sender: { name: "proveedor", send },
    });
    return { out, record };
  };

  it("registra el resultado de cada mensaje; un fallo no detiene a los demás", async () => {
    const send = vi
      .fn()
      .mockResolvedValueOnce({ ok: true, messageId: "m1" })
      .mockResolvedValueOnce({ ok: false, error: "Rechazado" })
      .mockRejectedValueOnce(new Error("Caída de red"))
      .mockResolvedValueOnce({ ok: true });
    const { out, record } = await run([item("1"), item("2"), item("3"), item("4")], send);
    expect(out).toEqual({ claimed: 4, sent: 2, failed: 2 });
    expect(record).toHaveBeenCalledWith("1", { ok: true, provider: "proveedor", messageId: "m1" });
    expect(record).toHaveBeenCalledWith("2", { ok: false, provider: "proveedor", error: "Rechazado" });
    expect(record).toHaveBeenCalledWith("3", { ok: false, provider: "proveedor", error: "Caída de red" });
  });

  it("no envía una propuesta sin enlace ni un mensaje sin teléfono", async () => {
    const send = vi.fn();
    const { out } = await run([item("1", "change.reschedule_proposed"), { ...item("2"), recipient_phone: null }], send, () => null);
    expect(send).not.toHaveBeenCalled();
    expect(out.failed).toBe(2);
  });
});

describe("enlace del cliente", () => {
  afterEach(() => vi.unstubAllEnvs());
  const ID = "6f1c2d3e-4a5b-4c6d-8e9f-0a1b2c3d4e5f";

  it("solo acepta firmas válidas", async () => {
    vi.stubEnv("APPOINTMENT_LINK_SECRET", "secreto");
    const { appointmentToken, verifyAppointmentToken } = await import("@/modules/notifications/links");
    const token = appointmentToken(ID)!;
    expect(verifyAppointmentToken(token)).toBe(ID);
    expect(verifyAppointmentToken(`${ID}.falsa`)).toBeNull();
    expect(verifyAppointmentToken(`6f1c2d3e-4a5b-4c6d-8e9f-0a1b2c3d4e50.${token.split(".")[1]}`)).toBeNull();
    expect(verifyAppointmentToken(`${token}.extra`)).toBeNull();
    expect(verifyAppointmentToken("")).toBeNull();
    vi.stubEnv("APPOINTMENT_LINK_SECRET", "otro");
    expect(verifyAppointmentToken(token)).toBeNull();
  });

  it("sin secreto no hay enlace", async () => {
    vi.stubEnv("APPOINTMENT_LINK_SECRET", "");
    vi.stubEnv("SUPABASE_SECRET_KEY", "");
    const { appointmentToken, verifyAppointmentToken } = await import("@/modules/notifications/links");
    expect(appointmentToken(ID)).toBeNull();
    expect(verifyAppointmentToken(`${ID}.x`)).toBeNull();
  });
});

describe("proveedor de SMS", () => {
  it("la cola nunca usa la salida simulada", async () => {
    const { getRealSmsSender, getSmsSender } = await import("@/lib/sms");
    expect(getSmsSender()?.name).toBe("console");
    expect(getRealSmsSender()).toBeNull();
  });
});
