import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { asAnon, asUser, createTestDatabase, type Db } from "./harness";
import { ids, seedScenario } from "./fixtures";

const { users, salons } = ids;
const CALL = "select public.admin_platform_stats($1) as stats";

type Stats = {
  salons_live: number;
  professionals_active: number;
  clients: number;
  appointments: { total: number; online: number; cancelled: number };
  notifications: { pending: number; sent: number };
  salons: { id: string; name: string; appointments: number }[];
};

let db: Db;

beforeAll(async () => {
  db = await createTestDatabase();
  await seedScenario(db);
}, 60_000);

afterAll(async () => {
  await db?.close();
});

describe("admin_platform_stats()", () => {
  it("el administrador ve cifras agregadas", async () => {
    const { rows } = await asUser(db, users.admin, (tx) => tx.query<{ stats: Stats }>(CALL, [30]));
    const stats = rows[0].stats;
    expect(stats).toMatchObject({ salons_live: 2, professionals_active: 3, clients: 3 });
    expect(stats.appointments).toMatchObject({ total: 2, online: 0, cancelled: 0 });
    expect(stats.notifications.sent).toBe(0);
    expect(stats.salons.find((s) => s.id === salons.a)).toMatchObject({ name: "Barbería Elegance", appointments: 2 });
  });

  it("nunca incluye datos de clientes ni de citas", async () => {
    const { rows } = await asUser(db, users.admin, (tx) => tx.query<{ stats: Stats }>(CALL, [30]));
    const text = JSON.stringify(rows[0].stats);
    for (const secret of ["Cliente de", "+346", "Alergia", "Nota privada", ids.appointments.citaA1, ids.clients.clienteA1]) {
      expect(text).not.toContain(secret);
    }
  });

  it("solo para administradores y con un periodo válido", async () => {
    await expect(asUser(db, users.ownerA, (tx) => tx.query(CALL, [30]))).rejects.toThrow(/FORBIDDEN/);
    await expect(asAnon(db, (tx) => tx.query(CALL, [30]))).rejects.toThrow(/permission denied/);
    await expect(asUser(db, users.admin, (tx) => tx.query(CALL, [0]))).rejects.toThrow(/INVALID_RANGE/);
  });

  it("el administrador sigue sin poder leer clientes ni citas", async () => {
    const out = await asUser(db, users.admin, async (tx) => ({
      clients: (await tx.query("select id from public.clients")).rows.length,
      appointments: (await tx.query("select id from public.appointments")).rows.length,
    }));
    expect(out).toEqual({ clients: 0, appointments: 0 });
  });
});
