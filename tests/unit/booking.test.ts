import { afterEach, describe, expect, it, vi } from "vitest";
import { bookableDays, describeNotice, groupSlots } from "@/modules/booking/flow";
import { bookingRequestSchema, otpRequestSchema, publicErrorCode } from "@/modules/booking/schemas";

vi.mock("server-only", () => ({}));

const TZ = "Europe/Madrid";

describe("bookableDays", () => {
  it("empieza hoy y se limita al horizonte del profesional", () => {
    const days = bookableDays("2026-11-30", 7);
    expect(days).toHaveLength(7);
    expect(days[0]).toMatchObject({ dateKey: "2026-11-30", day: 30 });
    expect(days[1]).toMatchObject({ dateKey: "2026-12-01", day: 1 });
    expect(bookableDays("2026-11-30", 365)).toHaveLength(21);
  });
});

describe("groupSlots", () => {
  it("agrupa por mañana, tarde y noche en la hora local", () => {
    const groups = groupSlots(
      [
        { startsAt: "2026-12-01T08:00:00Z" }, // 09:00
        { startsAt: "2026-12-01T12:45:00Z" }, // 13:45
        { startsAt: "2026-12-01T15:00:00Z" }, // 16:00
        { startsAt: "2026-12-01T19:30:00Z" }, // 20:30
      ],
      TZ,
    );
    expect(groups.map((g) => [g.label, g.slots.map((s) => s.time)])).toEqual([
      ["Mañana", ["09:00", "13:45"]],
      ["Tarde", ["16:00"]],
      ["Noche", ["20:30"]],
    ]);
  });

  it("omite las franjas vacías", () => {
    expect(groupSlots([{ startsAt: "2026-12-01T15:00:00Z" }], TZ).map((g) => g.label)).toEqual(["Tarde"]);
  });
});

describe("describeNotice", () => {
  it("expresa la antelación en la unidad natural", () => {
    expect(describeNotice(30)).toBe("30 min");
    expect(describeNotice(120)).toBe("2 h");
    expect(describeNotice(1440)).toBe("1 día");
    expect(describeNotice(2880)).toBe("2 días");
  });
});

describe("validación de la API pública", () => {
  const base = {
    otpId: "6f1c2d3e-4a5b-4c6d-8e9f-0a1b2c3d4e5f",
    code: " 123456 ",
    serviceId: "6f1c2d3e-4a5b-4c6d-8e9f-0a1b2c3d4e50",
    startsAt: "2026-12-01T09:00:00Z",
    fullName: "Laura",
  };

  it("acepta una reserva válida y normaliza código y email", () => {
    const v = bookingRequestSchema.parse({ ...base, email: " Laura@Mail.com ", notes: "" });
    expect(v).toMatchObject({ code: "123456", email: "laura@mail.com", notes: null });
  });

  it("rechaza códigos, fechas y nombres no válidos", () => {
    expect(bookingRequestSchema.safeParse({ ...base, code: "12345" }).success).toBe(false);
    expect(bookingRequestSchema.safeParse({ ...base, startsAt: "mañana" }).success).toBe(false);
    expect(bookingRequestSchema.safeParse({ ...base, fullName: "L" }).success).toBe(false);
  });

  it("normaliza el teléfono al pedir el código", () => {
    expect(otpRequestSchema.parse({ professionalId: base.otpId, phone: "600 11 22 33" }).phone).toBe("+34600112233");
  });

  it("traduce solo errores conocidos; el resto es un error genérico", () => {
    expect(publicErrorCode("SLOT_UNAVAILABLE")).toBe("SLOT_UNAVAILABLE");
    expect(publicErrorCode('duplicate key value violates unique constraint "x"')).toBe("SERVER_ERROR");
    expect(publicErrorCode(undefined)).toBe("SERVER_ERROR");
  });
});

describe("protecciones del servidor", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("solo acepta escrituras desde la propia web", async () => {
    const { isSameOrigin } = await import("@/modules/booking/server");
    const req = (headers: Record<string, string>) => new Request("http://localhost:3000/api/public/otp", { method: "POST", headers });
    expect(isSameOrigin(req({ origin: "http://localhost:3000", host: "localhost:3000" }))).toBe(true);
    expect(isSameOrigin(req({ origin: "https://malicioso.example", host: "localhost:3000" }))).toBe(false);
    expect(isSameOrigin(req({ host: "localhost:3000" }))).toBe(false);
  });

  it("guarda una huella de la IP, nunca la IP", async () => {
    vi.stubEnv("SUPABASE_SECRET_KEY", "clave-de-prueba");
    const { ipHash } = await import("@/modules/booking/server");
    const hash = ipHash(new Request("http://x", { headers: { "x-forwarded-for": "203.0.113.7, 10.0.0.1" } }));
    expect(hash).toMatch(/^[0-9a-f]{32}$/);
    expect(hash).not.toContain("203");
  });

  it("nunca simula SMS en producción", async () => {
    const { getSmsSender } = await import("@/lib/sms");
    vi.stubEnv("NODE_ENV", "production");
    expect(getSmsSender()).toBeNull();
    vi.stubEnv("NODE_ENV", "development");
    expect(getSmsSender()?.name).toBe("console");
    vi.stubEnv("SMS_PROVIDER", "twilio");
    expect(getSmsSender()).toBeNull(); // proveedor aún no conectado
  });
});
