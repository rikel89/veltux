import { describe, expect, it } from "vitest";
import { buildReadiness } from "@/modules/salons/readiness";

const status = (items: ReturnType<typeof buildReadiness>, id: string) => items.find((i) => i.id === id)?.status;

describe("buildReadiness", () => {
  it("señala lo que falta sin proveedor, tarea ni dirección pública", () => {
    const items = buildReadiness({ hasSecretKey: false, siteUrl: "http://localhost:3000", hasSmsProvider: false, hasCronSecret: false });
    for (const id of ["secret", "site", "sms", "cron"]) expect(status(items, id)).toBe("pending");
  });

  it("no da por hechas las cosas que no puede comprobar", () => {
    const items = buildReadiness({ hasSecretKey: true, siteUrl: "https://veltux.vercel.app", hasSmsProvider: true, hasCronSecret: true });
    expect(status(items, "secret")).toBe("ok");
    expect(status(items, "site")).toBe("ok");
    expect(status(items, "sms")).toBe("ok");
    for (const id of ["cron", "auth", "smtp", "signup", "legal", "e2e"]) expect(status(items, id)).toBe("manual");
  });

  it("nunca incluye el valor de una clave", () => {
    const text = JSON.stringify(buildReadiness({ hasSecretKey: true, siteUrl: "https://x.test", hasSmsProvider: false, hasCronSecret: true }));
    expect(text).not.toMatch(/sb_secret|true|false/);
  });
});
