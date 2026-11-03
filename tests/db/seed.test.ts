import { readFileSync } from "node:fs";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { asUser, createTestDatabase, SEED_FILE, type Db } from "./harness";

const CARLOS = "00000000-0000-4000-8000-00000000c001";
const JAVIER = "00000000-0000-4000-8000-00000000c002";

let db: Db;

beforeAll(async () => {
  db = await createTestDatabase();
  await db.exec(readFileSync(SEED_FILE, "utf8"));
}, 60_000);

afterAll(async () => {
  await db?.close();
});

describe("seed local", () => {
  it("crea el salón de pruebas con dos profesionales con licencia", async () => {
    const rows = await db.query<{ n: number }>(
      "select count(*)::int as n from public.license_assignments where revoked_at is null",
    );
    expect(rows.rows[0].n).toBe(2);
  });

  it("Carlos ve sus dos clientes y sus citas de hoy; no los de Javier", async () => {
    const result = await asUser(db, CARLOS, async (tx) => ({
      clients: (await tx.query<{ full_name: string }>("select full_name from public.clients order by full_name")).rows,
      appointments: (await tx.query("select id from public.appointments")).rows,
    }));
    expect(result.clients.map((c) => c.full_name)).toEqual(["Prueba Local Dos", "Prueba Local Uno"]);
    expect(result.appointments).toHaveLength(2);
  });

  it("Javier tiene su propia ficha de la misma persona, sin las notas de Carlos", async () => {
    const rows = await asUser(db, JAVIER, (tx) => tx.query<{ notes: string }>("select notes from public.clients"));
    expect(rows.rows).toEqual([{ notes: "Misma persona, cartera independiente" }]);
  });
});
