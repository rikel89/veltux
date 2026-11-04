import { mkdtempSync, readdirSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import EmbeddedPostgres from "embedded-postgres";
import { Pool } from "pg";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { ids, seedScenario } from "../db/fixtures";
import { SUPABASE_STUB } from "../db/harness";

/**
 * Concurrencia real: PostgreSQL de verdad y una conexión por petición. PGlite
 * (el resto de pruebas SQL) solo admite una conexión y no puede probar esto.
 */
const { users, salons, professionals: p, services: s, clients: c } = ids;
const PORT = 54329;
const SLOT = "2027-03-01 09:00+00"; // lunes, 10:00 en Madrid

let server: EmbeddedPostgres;
let pool: Pool;
let dir: string;
let template = false;

type Outcome<T> = { ok: true; value: T } | { ok: false; error: string };

/** Una transacción en su propia conexión, con el rol e identidad de PostgREST. */
async function as<T>(role: "authenticated" | "service_role", userId: string | null, sql: string, params: unknown[] = []): Promise<Outcome<T[]>> {
  const client = await pool.connect();
  try {
    await client.query("begin");
    await client.query("select set_config('request.jwt.claims', $1, true)", [JSON.stringify(userId ? { sub: userId, role } : { role })]);
    await client.query(`set local role ${role}`);
    const { rows } = await client.query(sql, params);
    await client.query("commit");
    return { ok: true, value: rows as T[] };
  } catch (error) {
    await client.query("rollback");
    return { ok: false, error: (error as Error).message };
  } finally {
    client.release();
  }
}

const errorsOf = (results: Outcome<unknown>[]) => [...new Set(results.flatMap((r) => (r.ok ? [] : [r.error])))];
const okCount = (results: Outcome<unknown>[]) => results.filter((r) => r.ok).length;

beforeAll(async () => {
  dir = mkdtempSync(join(tmpdir(), "veltux-pg-"));
  server = new EmbeddedPostgres({ databaseDir: dir, user: "postgres", password: "password", port: PORT, persistent: false, initdbFlags: ["--encoding=UTF8", "--locale=C"], onLog: () => undefined, onError: () => undefined });
  await server.initialise();
  await server.start();
  await server.createDatabase("veltux");
  pool = new Pool({ host: "localhost", port: PORT, user: "postgres", password: "password", database: "veltux", max: 24 });

  await pool.query(SUPABASE_STUB);
  const migrations = join(process.cwd(), "supabase", "migrations");
  for (const file of readdirSync(migrations).filter((f) => f.endsWith(".sql")).sort()) {
    await pool.query(readFileSync(join(migrations, file), "utf8"));
  }
  template = true;
}, 180_000);

afterAll(async () => {
  await pool?.end();
  await server?.stop();
  rmSync(dir, { recursive: true, force: true });
}, 60_000);

beforeEach(async () => {
  expect(template).toBe(true);
  await pool.query("truncate auth.users, public.salons, public.booking_otps, public.notifications, public.audit_logs cascade");
  await seedScenario({ exec: (sql: string) => pool.query(sql) } as never);
  await pool.query(`
    insert into public.work_schedules (salon_id, professional_id, weekday, start_time, end_time, valid_from) values
      ('${salons.a}', '${p.proA1}', 1, '09:00', '14:00', '2026-01-01');
  `);
}, 60_000);

const CREATE = "select public.create_my_appointment($1, $2, $3, null, false) as id";

describe("Dos personas a la vez", () => {
  it("20 citas simultáneas al mismo hueco: solo una se crea", async () => {
    const results = await Promise.all(
      Array.from({ length: 20 }, () => as<{ id: string }>("authenticated", users.ownerA, CREATE, [s.corteA1, c.clienteA1, SLOT])),
    );
    expect(okCount(results)).toBe(1);
    expect(errorsOf(results)).toEqual(["SLOT_TAKEN"]);
    const { rows } = await pool.query("select count(*)::int as n from public.appointments where starts_at = $1", [SLOT]);
    expect(rows[0].n).toBe(1);
  });

  it("citas simultáneas que se pisan parcialmente nunca quedan solapadas", async () => {
    const starts = ["09:00", "09:10", "09:15", "09:20", "09:30", "09:40", "09:45", "10:00"].map((t) => `2027-03-01 ${t}+00`);
    await Promise.all(starts.map((start) => as("authenticated", users.ownerA, CREATE, [s.corteA1, c.clienteA1, start])));
    const { rows } = await pool.query(
      `select count(*)::int as n from public.appointments a join public.appointments b
         on a.id < b.id and a.professional_id = b.professional_id
        and tstzrange(a.starts_at, a.ends_at) && tstzrange(b.starts_at, b.ends_at)
       where a.status = 'confirmed' and b.status = 'confirmed'`,
    );
    expect(rows[0].n).toBe(0);
  });

  it("varios clientes reservan online la misma hora: una reserva y un solo cliente nuevo", async () => {
    const otps: { otp_id: string; code: string; phone: string }[] = [];
    for (let i = 0; i < 8; i++) {
      const phone = `+3469900000${i}`;
      const res = await as<{ otp_id: string; code: string }>("service_role", null, "select * from public.request_booking_otp($1, $2, null)", [p.proA1, phone]);
      if (!res.ok) throw new Error(res.error);
      otps.push({ ...res.value[0], phone });
    }
    const results = await Promise.all(
      otps.map((o) =>
        as<{ id: string }>("service_role", null, "select public.create_public_booking($1, $2, $3, $4, 'Cliente Web') as id", [o.otp_id, o.code, s.corteA1, SLOT]),
      ),
    );
    expect(okCount(results)).toBe(1);
    expect(errorsOf(results)).toEqual(["SLOT_UNAVAILABLE"]);
    const clients = await pool.query("select count(*)::int as n from public.clients where full_name = 'Cliente Web'");
    expect(clients.rows[0].n).toBe(1); // las transacciones fallidas no dejan clientes huérfanos
  });

  it("agenda y reserva online compitiendo por el mismo hueco: gana solo una", async () => {
    const otp = await as<{ otp_id: string; code: string }>("service_role", null, "select * from public.request_booking_otp($1, '+34699000100', null)", [p.proA1]);
    if (!otp.ok) throw new Error(otp.error);
    const results = await Promise.all([
      as("authenticated", users.ownerA, CREATE, [s.corteA1, c.clienteA1, SLOT]),
      as("service_role", null, "select public.create_public_booking($1, $2, $3, $4, 'Cliente Web') as id", [otp.value[0].otp_id, otp.value[0].code, s.corteA1, SLOT]),
    ]);
    expect(okCount(results)).toBe(1);
  });

  it("dos citas se mueven a la vez al mismo hueco: solo se mueve una", async () => {
    const make = async (start: string) => {
      const r = await as<{ id: string }>("authenticated", users.ownerA, CREATE, [s.corteA1, c.clienteA1, start]);
      if (!r.ok) throw new Error(r.error);
      return r.value[0].id;
    };
    const ids_ = [await make("2027-03-01 11:00+00"), await make("2027-03-01 12:00+00"), await make("2027-03-01 11:30+00")];
    const results = await Promise.all(
      ids_.map((id) => as("authenticated", users.ownerA, "select public.reschedule_my_appointment($1, $2, false)", [id, SLOT])),
    );
    expect(okCount(results)).toBe(1);
    expect(errorsOf(results)).toEqual(["SLOT_TAKEN"]);
  });
});

describe("Límites bajo carga", () => {
  it("invitaciones simultáneas no superan las licencias contratadas", async () => {
    await pool.query("update public.subscriptions set license_quantity = 3 where salon_id = $1", [salons.a]);
    const emails = Array.from({ length: 6 }, (_, i) => `nueva${i}@veltux.test`);
    for (const [i, email] of emails.entries()) {
      await pool.query("insert into auth.users (id, email) values ($1, $2)", [`00000000-0000-4000-8000-0000000001${String(i).padStart(2, "0")}`, email]);
    }
    const results = await Promise.all(
      emails.map((email, i) => as("authenticated", users.ownerA, "select public.invite_professional($1, $2, 'Nueva Pro', $3, true)", [salons.a, email, `nueva${i}`])),
    );
    expect(okCount(results)).toBe(1); // 2 en uso + 1 libre
    expect(errorsOf(results)).toEqual(["LICENSE_LIMIT_REACHED"]);
    const { rows } = await pool.query("select count(*)::int as n from public.license_assignments where salon_id = $1 and revoked_at is null", [salons.a]);
    expect(rows[0].n).toBe(3);
  });

  it("peticiones simultáneas de códigos respetan el límite por teléfono", async () => {
    const results = await Promise.all(
      Array.from({ length: 12 }, () => as("service_role", null, "select * from public.request_booking_otp($1, '+34699000200', null)", [p.proA1])),
    );
    expect(okCount(results)).toBe(3);
    expect(errorsOf(results)).toEqual(["TOO_MANY_REQUESTS"]);
  });

  it("probar códigos en paralelo no da más de 5 intentos", async () => {
    const otp = await as<{ otp_id: string; code: string }>("service_role", null, "select * from public.request_booking_otp($1, '+34699000300', null)", [p.proA1]);
    if (!otp.ok) throw new Error(otp.error);
    const wrong = otp.value[0].code === "000000" ? "111111" : "000000";
    const results = await Promise.all(
      Array.from({ length: 15 }, () =>
        as<{ id: string | null }>("service_role", null, "select public.create_public_booking($1, $2, $3, $4, 'Intruso') as id", [otp.value[0].otp_id, wrong, s.corteA1, SLOT]),
      ),
    );
    expect(okCount(results)).toBe(5);
    expect(errorsOf(results)).toEqual(["OTP_LOCKED"]);
    const { rows } = await pool.query("select attempts from public.booking_otps where id = $1", [otp.value[0].otp_id]);
    expect(rows[0].attempts).toBe(5);
    const appts = await pool.query("select count(*)::int as n from public.appointments where starts_at = $1", [SLOT]);
    expect(appts.rows[0].n).toBe(0);
  });

  it("un código correcto no sirve dos veces aunque se use a la vez", async () => {
    const otp = await as<{ otp_id: string; code: string }>("service_role", null, "select * from public.request_booking_otp($1, '+34699000400', null)", [p.proA1]);
    if (!otp.ok) throw new Error(otp.error);
    const starts = ["09:00", "10:00", "11:00", "12:00"].map((t) => `2027-03-01 ${t}+00`);
    const results = await Promise.all(
      starts.map((start) => as("service_role", null, "select public.create_public_booking($1, $2, $3, $4, 'Doble') as id", [otp.value[0].otp_id, otp.value[0].code, s.corteA1, start])),
    );
    expect(okCount(results)).toBe(1);
    expect(errorsOf(results)).toEqual(["OTP_EXPIRED"]);
  });

  it("varios procesos de la cola nunca reclaman el mismo mensaje", async () => {
    for (let i = 0; i < 30; i++) {
      await pool.query(
        `insert into public.notifications (salon_id, template, recipient_phone, idempotency_key, payload)
         values ($1, 'appointment.created', '+34600000000', $2, '{"starts_at":"2027-03-01T09:00:00Z"}')`,
        [salons.a, `prueba:${i}`],
      );
    }
    const results = await Promise.all(
      Array.from({ length: 6 }, () => as<{ id: string; idempotency_key: string }>("service_role", null, "select id, idempotency_key from public.claim_pending_notifications(10)")),
    );
    const claimed = results.flatMap((r) => (r.ok ? r.value.map((n) => n.id) : []));
    expect(errorsOf(results)).toEqual([]);
    expect(new Set(claimed).size).toBe(claimed.length);
    expect(claimed.length).toBeGreaterThan(0);
  });
});
