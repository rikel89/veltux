import { describe, expect, it } from "vitest";
import { areasFor, homePathFor, parseAccessPayload } from "@/modules/auth/access-rules";

const membership = (role: "owner" | "professional") => ({
  salonId: "s1",
  salonName: "Elegance",
  salonSlug: "elegance",
  salonStatus: "trial",
  role,
});

describe("áreas por rol", () => {
  it("propietario que también atiende: agenda primero, luego establecimiento", () => {
    const areas = areasFor({ isPlatformAdmin: false, memberships: [membership("owner"), membership("professional")] });
    expect(areas).toEqual(["professional", "owner"]);
    expect(homePathFor(areas)).toBe("/profesional");
  });

  it("propietario que no atiende entra en su establecimiento", () => {
    expect(homePathFor(areasFor({ isPlatformAdmin: false, memberships: [membership("owner")] }))).toBe("/propietario");
  });

  it("administrador sin peluquería entra en /admin", () => {
    expect(homePathFor(areasFor({ isPlatformAdmin: true, memberships: [] }))).toBe("/admin");
  });

  it("usuario sin roles va a la página sin acceso", () => {
    expect(homePathFor(areasFor({ isPlatformAdmin: false, memberships: [] }))).toBe("/sin-acceso");
  });
});

describe("parseAccessPayload", () => {
  it("normaliza la respuesta de get_my_access() e ignora roles desconocidos", () => {
    const facts = parseAccessPayload({
      is_platform_admin: true,
      memberships: [
        { salon_id: "s1", salon_name: "A", salon_slug: "a", salon_status: "trial", role: "owner" },
        { salon_id: "s1", salon_name: "A", salon_slug: "a", salon_status: "trial", role: "superuser" },
      ],
    });
    expect(facts.isPlatformAdmin).toBe(true);
    expect(facts.memberships).toHaveLength(1);
    expect(facts.memberships[0]).toMatchObject({ salonId: "s1", role: "owner" });
  });

  it("tolera respuestas vacías", () => {
    expect(parseAccessPayload(null)).toEqual({ isPlatformAdmin: false, memberships: [] });
  });
});
