import { afterEach, describe, expect, it, vi } from "vitest";
import { getSiteUrl, publicLabel, publicUrl } from "@/lib/site";

describe("dirección pública", () => {
  afterEach(() => vi.unstubAllEnvs());

  it("usa la dirección configurada", () => {
    vi.stubEnv("NEXT_PUBLIC_SITE_URL", "https://veltux.vercel.app/");
    expect(getSiteUrl()).toBe("https://veltux.vercel.app");
    expect(publicUrl("/mi-salon/ana")).toBe("https://veltux.vercel.app/mi-salon/ana");
    expect(publicLabel("/mi-salon/ana")).toBe("veltux.vercel.app/mi-salon/ana");
  });

  it("en local apunta al servidor de desarrollo", () => {
    vi.stubEnv("NEXT_PUBLIC_SITE_URL", "");
    vi.stubEnv("VERCEL_URL", "");
    expect(publicUrl("/mi-salon")).toBe("http://localhost:3000/mi-salon");
    expect(publicLabel("/mi-salon")).toBe("localhost:3000/mi-salon");
  });
});
