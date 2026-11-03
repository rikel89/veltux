import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { asUser, createTestDatabase, type Db } from "./harness";
import { ids, seedScenario } from "./fixtures";

const { users, salons, professionals: p, services: s } = ids;
const NUEVA = "00000000-0000-4000-8000-0000000000e1";

let db: Db;

// Cada prueba parte de un escenario limpio: el flujo de invitación muta datos.
beforeEach(async () => {
  await db?.close();
  db = await createTestDatabase();
  await seedScenario(db);
  await db.query("insert into auth.users (id, email) values ($1, 'nueva@veltux.test')", [NUEVA]);
  // Salón A tiene 2 licencias y 2 en uso: se amplía a 3 para poder invitar.
  await db.query("update public.subscriptions set license_quantity = 3 where salon_id = $1", [salons.a]);
}, 60_000);

afterAll(async () => {
  await db?.close();
});

const invite = (license = true, email = "nueva@veltux.test", slug = "nueva") =>
  `select public.invite_professional('${salons.a}', '${email}', 'Nueva Pro', '${slug}', ${license}) as id`;

describe("invite_professional()", () => {
  it("el propietario invita: ficha y membresía quedan pendientes con licencia reservada", async () => {
    const row = await asUser(db, users.ownerA, async (tx) => {
      const { rows } = await tx.query<{ id: string }>(invite());
      return (
        await tx.query<{ status: string; user_id: string; licenses: number; membership: string }>(
          `select p.status, p.user_id,
             (select count(*)::int from public.license_assignments la where la.professional_id = p.id and la.revoked_at is null) as licenses,
             (select m.status::text from public.salon_memberships m where m.user_id = p.user_id and m.salon_id = p.salon_id and m.role = 'professional') as membership
           from public.professionals p where p.id = $1`,
          [rows[0].id],
        )
      ).rows[0];
    });
    expect(row).toEqual({ status: "invited", user_id: NUEVA, licenses: 1, membership: "invited" });
  });

  it("un profesional que no es propietario no puede invitar", async () => {
    await expect(asUser(db, users.userA2, (tx) => tx.query(invite()))).rejects.toThrow(/FORBIDDEN/);
  });

  it("el propietario de otra peluquería no puede invitar en esta", async () => {
    await expect(asUser(db, users.userB1, (tx) => tx.query(invite()))).rejects.toThrow(/FORBIDDEN/);
  });

  it("sin licencias libres no se crea nada", async () => {
    await db.query("update public.subscriptions set license_quantity = 2 where salon_id = $1", [salons.a]);
    await expect(asUser(db, users.ownerA, (tx) => tx.query(invite()))).rejects.toThrow(/LICENSE_LIMIT_REACHED/);
    const { rows } = await db.query<{ n: number }>("select count(*)::int as n from public.professionals where user_id = $1", [NUEVA]);
    expect(rows[0].n).toBe(0);
  });

  it("puede invitar sin licencia aunque el cupo esté lleno", async () => {
    await db.query("update public.subscriptions set license_quantity = 2 where salon_id = $1", [salons.a]);
    await expect(asUser(db, users.ownerA, (tx) => tx.query(invite(false)))).resolves.toBeDefined();
  });

  it("rechaza usuarios inexistentes, duplicados y direcciones ocupadas", async () => {
    await expect(asUser(db, users.ownerA, (tx) => tx.query(invite(true, "nadie@veltux.test")))).rejects.toThrow(
      /USER_NOT_FOUND/,
    );
    await expect(
      asUser(db, users.ownerA, (tx) => tx.query(invite(true, "pro.a2@veltux.test", "otro"))),
    ).rejects.toThrow(/ALREADY_MEMBER/);
    await expect(asUser(db, users.ownerA, (tx) => tx.query(invite(true, "nueva@veltux.test", "javier")))).rejects.toThrow(
      /SLUG_TAKEN/,
    );
  });
});

describe("accept_my_invitations()", () => {
  it("antes de aceptar no puede operar; al aceptar obtiene acceso de profesional", async () => {
    const proId = (await asUserCommit(db, users.ownerA, invite())).id;

    // Pendiente: no puede crear clientes.
    await expect(
      asUser(db, NUEVA, (tx) =>
        tx.query(
          "insert into public.clients (salon_id, professional_id, full_name, phone) values ($1, $2, 'X', '+34600000099')",
          [salons.a, proId],
        ),
      ),
    ).rejects.toThrow(/row-level security/);

    const access = await asUser(db, NUEVA, async (tx) => {
      const accepted = (await tx.query<{ n: number }>("select public.accept_my_invitations() as n")).rows[0].n;
      const roles = (await tx.query<{ a: { memberships: { role: string }[] } }>("select public.get_my_access() as a")).rows[0].a;
      await tx.query(
        "insert into public.clients (salon_id, professional_id, full_name, phone) values ($1, $2, 'Mi cliente', '+34600000099')",
        [salons.a, proId],
      );
      return { accepted, roles: roles.memberships.map((m) => m.role) };
    });
    expect(access).toEqual({ accepted: 1, roles: ["professional"] });
  });
});

describe("set_professional_active()", () => {
  it("desactivar libera la licencia y deja al profesional solo con lectura", async () => {
    await asUserCommit(db, users.ownerA, `select public.set_professional_active('${p.proA2}', false, 'Baja') as id`);

    const state = await db.query<{ status: string; licenses: number; reason: string }>(
      `select p.status,
         (select count(*)::int from public.license_assignments la where la.professional_id = p.id and la.revoked_at is null) as licenses,
         (select la.revoke_reason from public.license_assignments la where la.professional_id = p.id order by la.revoked_at desc nulls last limit 1) as reason
       from public.professionals p where p.id = $1`,
      [p.proA2],
    );
    expect(state.rows[0]).toEqual({ status: "inactive", licenses: 0, reason: "Baja" });

    const result = await asUser(db, users.userA2, async (tx) => ({
      clients: (await tx.query("select id from public.clients")).rows.length,
    }));
    expect(result.clients).toBe(1); // conserva la lectura de su cartera

    // RLS: sin estado activo no puede escribir en su cartera.
    await expect(
      asUser(db, users.userA2, (tx) =>
        tx.query(
          "insert into public.clients (salon_id, professional_id, full_name, phone) values ($1, $2, 'X', '+34600000098')",
          [salons.a, p.proA2],
        ),
      ),
    ).rejects.toThrow(/row-level security/);

    // Trigger: sin licencia no puede recibir citas (se evalúa antes que RLS).
    await expect(
      asUser(db, users.userA2, (tx) =>
        tx.query(
          `insert into public.appointments (salon_id, professional_id, client_id, service_id, starts_at, ends_at)
           values ($1, $2, $3, $4, '2026-12-09 10:00+00', '2026-12-09 10:45+00')`,
          [salons.a, p.proA2, ids.clients.clienteA2, s.corteA2],
        ),
      ),
    ).rejects.toThrow(/PROFESSIONAL_WITHOUT_LICENSE/);

    await expect(
      asUser(db, users.ownerA, (tx) =>
        tx.query("insert into public.license_assignments (salon_id, professional_id) values ($1, $2)", [salons.a, p.proA2]),
      ),
    ).rejects.toThrow(/PROFESSIONAL_INACTIVE/);
  });

  it("solo el propietario del salón puede cambiar el estado", async () => {
    await expect(
      asUser(db, users.userB1, (tx) => tx.query("select public.set_professional_active($1, false)", [p.proA2])),
    ).rejects.toThrow(/FORBIDDEN/);
    await expect(
      asUser(db, users.userA2, (tx) => tx.query("select public.set_professional_active($1, false)", [p.proA2])),
    ).rejects.toThrow(/FORBIDDEN/);
  });

  it("una invitación pendiente no puede activarla el propietario", async () => {
    const proId = (await asUserCommit(db, users.ownerA, invite())).id;
    await expect(
      asUser(db, users.ownerA, (tx) => tx.query("select public.set_professional_active($1, true)", [proId])),
    ).rejects.toThrow(/INVALID_TRANSITION/);
  });
});

describe("admin_set_license_quantity()", () => {
  it("el administrador ajusta el cupo, nunca por debajo de las licencias en uso", async () => {
    await expect(
      asUser(db, users.admin, (tx) => tx.query("select public.admin_set_license_quantity($1, 1)", [salons.a])),
    ).rejects.toThrow(/BELOW_IN_USE/);
    const audit = await asUser(db, users.admin, async (tx) => {
      await tx.query("select public.admin_set_license_quantity($1, 5)", [salons.a]);
      return (
        await tx.query<{ metadata: { from: number; to: number } }>(
          "select metadata from public.audit_logs where action = 'subscription.licenses_changed'",
        )
      ).rows[0].metadata;
    });
    expect(audit).toEqual({ from: 3, to: 5 });
  });

  it("un propietario no puede ampliar sus propias licencias", async () => {
    await expect(
      asUser(db, users.ownerA, (tx) => tx.query("select public.admin_set_license_quantity($1, 10)", [salons.a])),
    ).rejects.toThrow(/FORBIDDEN/);
  });
});

/** Ejecuta una consulta como usuario y CONFIRMA la transacción (para pasos encadenados). */
async function asUserCommit(database: Db, userId: string, sql: string): Promise<{ id: string }> {
  return database.transaction(async (tx) => {
    await tx.query("select set_config('request.jwt.claims', $1, true)", [JSON.stringify({ sub: userId })]);
    await tx.exec("set local role authenticated");
    const { rows } = await tx.query<{ id: string }>(sql);
    return rows[0];
  });
}
