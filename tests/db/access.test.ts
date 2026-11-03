import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { asAnon, asUser, createTestDatabase, type Db } from "./harness";
import { ids, seedScenario } from "./fixtures";

const { users, salons } = ids;
const NEW_OWNER = "00000000-0000-4000-8000-0000000000c9";

const createSalon = (slug: string, email = "nuevo@veltux.test") =>
  `select public.create_salon_with_owner('${email}', 'Nuevo Dueño', 'Nueva Barbería', '${slug}',
     'barberia', 'Sevilla', null, 2, true, 'nuevo') as id`;

let db: Db;

beforeAll(async () => {
  db = await createTestDatabase();
  await seedScenario(db);
  await db.query("insert into auth.users (id, email) values ($1, 'nuevo@veltux.test')", [NEW_OWNER]);
}, 60_000);

afterAll(async () => {
  await db?.close();
});

describe("get_my_access()", () => {
  it("devuelve los roles del usuario en sus establecimientos", async () => {
    const result = await asUser(db, users.ownerA, (tx) =>
      tx.query<{ a: { is_platform_admin: boolean; memberships: { salon_id: string; role: string }[] } }>(
        "select public.get_my_access() as a",
      ),
    );
    const access = result.rows[0].a;
    expect(access.is_platform_admin).toBe(false);
    expect(access.memberships.map((m) => m.role).sort()).toEqual(["owner", "professional"]);
    expect(new Set(access.memberships.map((m) => m.salon_id))).toEqual(new Set([salons.a]));
  });

  it("identifica al administrador de la plataforma", async () => {
    const result = await asUser(db, users.admin, (tx) =>
      tx.query<{ a: { is_platform_admin: boolean; memberships: unknown[] } }>("select public.get_my_access() as a"),
    );
    expect(result.rows[0].a).toMatchObject({ is_platform_admin: true, memberships: [] });
  });

  it("no está disponible para anónimos", async () => {
    await expect(asAnon(db, (tx) => tx.query("select public.get_my_access()"))).rejects.toThrow(/permission denied/);
  });
});

describe("create_salon_with_owner()", () => {
  it("un administrador da de alta el establecimiento completo", async () => {
    const result = await asUser(db, users.admin, async (tx) => {
      const { rows } = await tx.query<{ id: string }>(createSalon("nueva-barberia"));
      const salonId = rows[0].id;
      const counts = await tx.query<{ memberships: number; licenses: number; quantity: number; audit: number }>(
        `select
           (select count(*)::int from public.salon_memberships where salon_id = $1) as memberships,
           (select count(*)::int from public.license_assignments where salon_id = $1 and revoked_at is null) as licenses,
           (select license_quantity from public.subscriptions where salon_id = $1) as quantity,
           (select count(*)::int from public.audit_logs where salon_id = $1 and action = 'salon.created') as audit`,
        [salonId],
      );
      return counts.rows[0];
    });
    expect(result).toEqual({ memberships: 2, licenses: 1, quantity: 2, audit: 1 });
  });

  it("un propietario normal no puede crear establecimientos", async () => {
    await expect(asUser(db, users.ownerA, (tx) => tx.query(createSalon("intento")))).rejects.toThrow(/FORBIDDEN/);
  });

  it("los anónimos no pueden ejecutarla", async () => {
    await expect(asAnon(db, (tx) => tx.query(createSalon("anonimo")))).rejects.toThrow(/permission denied/);
  });

  it("rechaza propietarios inexistentes y slugs ocupados sin dejar datos a medias", async () => {
    await expect(
      asUser(db, users.admin, (tx) => tx.query(createSalon("otra", "fantasma@veltux.test"))),
    ).rejects.toThrow(/OWNER_NOT_FOUND/);
    await expect(asUser(db, users.admin, (tx) => tx.query(createSalon("barberia-elegance")))).rejects.toThrow(
      /SLUG_TAKEN/,
    );
    const { rows } = await db.query<{ n: number }>("select count(*)::int as n from public.salons");
    expect(rows[0].n).toBe(2);
  });

  it("rechaza slugs reservados", async () => {
    await expect(asUser(db, users.admin, (tx) => tx.query(createSalon("admin")))).rejects.toThrow(/check constraint/);
  });
});

describe("admin_salon_overview()", () => {
  it("el administrador ve todos los establecimientos con uso de licencias y propietario", async () => {
    const result = await asUser(db, users.admin, (tx) =>
      tx.query<{ slug: string; licenses_in_use: number; license_quantity: number; owner_email: string }>(
        "select slug, licenses_in_use, license_quantity, owner_email from public.admin_salon_overview() order by slug",
      ),
    );
    expect(result.rows).toEqual([
      { slug: "barberia-elegance", licenses_in_use: 2, license_quantity: 2, owner_email: "owner.a@veltux.test" },
      { slug: "barberia-norte", licenses_in_use: 1, license_quantity: 1, owner_email: "owner.b@veltux.test" },
    ]);
  });

  it("un propietario no puede usarla", async () => {
    await expect(
      asUser(db, users.ownerA, (tx) => tx.query("select * from public.admin_salon_overview()")),
    ).rejects.toThrow(/FORBIDDEN/);
  });
});
