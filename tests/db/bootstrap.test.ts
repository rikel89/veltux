import { readFileSync } from "node:fs";
import { join } from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { asUser, createTestDatabase, type Db } from "./harness";

const USER_ID = "00000000-0000-4000-8000-0000000000f1";
const script = readFileSync(join(process.cwd(), "supabase", "scripts", "bootstrap_salon.sql"), "utf8").replace(
  "'tu-email@ejemplo.com'",
  "'Owner@Veltux.Test'",
);

let db: Db;

beforeAll(async () => {
  db = await createTestDatabase();
  await db.query("insert into auth.users (id, email) values ($1, 'owner@veltux.test')", [USER_ID]);
  await db.exec(script);
}, 60_000);

afterAll(async () => {
  await db?.close();
});

describe("scripts/bootstrap_salon.sql", () => {
  it("deja al propietario operativo como profesional con licencia y horario", async () => {
    const result = await asUser(db, USER_ID, async (tx) => ({
      salons: (await tx.query<{ slug: string }>("select slug from public.salons")).rows,
      licenses: (await tx.query("select id from public.license_assignments where revoked_at is null")).rows,
      services: (await tx.query("select id from public.services")).rows,
      schedule: (await tx.query("select id from public.work_schedules")).rows,
      clients: (await tx.query("select id from public.clients")).rows,
    }));
    expect(result.salons).toEqual([{ slug: "barberia-elegance" }]);
    expect(result.licenses).toHaveLength(1);
    expect(result.services).toHaveLength(3);
    expect(result.schedule).toHaveLength(11);
    expect(result.clients).toHaveLength(0); // sin datos ficticios
  });

  it("falla de forma atómica si se ejecuta dos veces con el mismo slug", async () => {
    await expect(db.exec(script)).rejects.toThrow(/ya está en uso/);
    const salons = await db.query<{ n: number }>("select count(*)::int as n from public.salons");
    expect(salons.rows[0].n).toBe(1);
  });

  it("falla si el usuario no existe", async () => {
    await expect(db.exec(script.replace("'Owner@Veltux.Test'", "'nadie@veltux.test'"))).rejects.toThrow(
      /No existe ningún usuario/,
    );
  });
});
