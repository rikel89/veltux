import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { asAnon, asUser, createTestDatabase, type Db } from "./harness";
import { ids, seedScenario } from "./fixtures";

const { users, salons, professionals: p, clients: c, services: s, appointments: a } = ids;

const FROM = "2026-12-01 00:00+00";
const TO = "2026-12-02 00:00+00";
const CALL = "select * from public.get_salon_agenda_overview($1, $2, $3)";

let db: Db;

beforeAll(async () => {
  db = await createTestDatabase();
  await seedScenario(db);
  await db.exec(`
    insert into public.schedule_exceptions (salon_id, professional_id, type, starts_at, ends_at, reason) values
      ('${salons.a}', '${p.proA2}', 'block', '2026-12-01 12:00+00', '2026-12-01 13:00+00', 'Médico: revisión privada'),
      ('${salons.a}', '${p.proA1}', 'extra_availability', '2026-12-01 18:00+00', '2026-12-01 20:00+00', 'Extra');
    insert into public.appointments (salon_id, professional_id, client_id, service_id, starts_at, ends_at, status, cancelled_at) values
      ('${salons.a}', '${p.proA1}', '${c.clienteA1}', '${s.corteA1}', '2026-12-01 15:00+00', '2026-12-01 15:30+00', 'cancelled', now());
  `);
}, 60_000);

afterAll(async () => {
  await db?.close();
});

describe("get_salon_agenda_overview()", () => {
  it("el propietario ve franjas anónimas de todas las agendas, sin datos de clientes ni motivos", async () => {
    const { rows } = await asUser(db, users.ownerA, (tx) => tx.query<Record<string, unknown>>(CALL, [salons.a, FROM, TO]));
    expect(Object.keys(rows[0]).sort()).toEqual(["ends_at", "kind", "professional_id", "starts_at"]);
    expect(rows.map((r) => [r.professional_id, r.kind]).sort()).toEqual(
      [
        [p.proA1, "busy"],
        [p.proA2, "busy"],
        [p.proA2, "unavailable"],
        [p.proA1, "extra"],
      ].sort(),
    );
    const text = JSON.stringify(rows);
    for (const secret of ["Médico", "Cliente de", "+346", "Alergia", "Corte", a.citaA1]) expect(text).not.toContain(secret);
  });

  it("no incluye citas canceladas", async () => {
    const { rows } = await asUser(db, users.ownerA, (tx) => tx.query<{ kind: string }>(CALL, [salons.a, "2026-12-01 15:00+00", "2026-12-01 15:30+00"]));
    expect(rows).toHaveLength(0);
  });

  it("solo para el propietario de ese establecimiento o la plataforma", async () => {
    await expect(asUser(db, users.userA2, (tx) => tx.query(CALL, [salons.a, FROM, TO]))).rejects.toThrow(/FORBIDDEN/);
    await expect(asUser(db, users.ownerA, (tx) => tx.query(CALL, [salons.b, FROM, TO]))).rejects.toThrow(/FORBIDDEN/);
    await expect(asAnon(db, (tx) => tx.query(CALL, [salons.a, FROM, TO]))).rejects.toThrow(/permission denied/);
    await expect(asUser(db, users.admin, (tx) => tx.query(CALL, [salons.a, FROM, TO]))).resolves.toBeDefined();
  });

  it("valida el rango", async () => {
    await expect(asUser(db, users.ownerA, (tx) => tx.query(CALL, [salons.a, TO, FROM]))).rejects.toThrow(/INVALID_RANGE/);
    await expect(asUser(db, users.ownerA, (tx) => tx.query(CALL, [salons.a, "2026-12-01", "2027-02-01"]))).rejects.toThrow(/INVALID_RANGE/);
  });

  it("el propietario sigue sin poder leer o tocar citas, clientes y excepciones de otro autónomo", async () => {
    const out = await asUser(db, users.ownerA, async (tx) => ({
      appointments: (await tx.query("select id from public.appointments where professional_id = $1", [p.proA2])).rows.length,
      clients: (await tx.query("select id from public.clients where professional_id = $1", [p.proA2])).rows.length,
      exceptions: (await tx.query("select id from public.schedule_exceptions where professional_id = $1", [p.proA2])).rows.length,
      updated: (await tx.query("update public.appointments set notes = 'x' where id = $1", [a.citaA2])).affectedRows,
    }));
    expect(out).toEqual({ appointments: 0, clients: 0, exceptions: 0, updated: 0 });
  });
});
