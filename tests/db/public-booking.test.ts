import type { Transaction } from "@electric-sql/pglite";
import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { asAnon, asRole, asUser, createTestDatabase, type Db } from "./harness";
import { ids, seedScenario } from "./fixtures";

const { users, salons, professionals: p, services: s, clients: c } = ids;

// Carlos (proA1) trabaja los lunes 09:00-14:00 (Madrid). 2027-03-01 09:00Z = 10:00 local.
const SLOT = "2027-03-01 09:00+00";
const PHONE = "+34699000111";

let db: Db;

beforeEach(async () => {
  await db?.close();
  db = await createTestDatabase();
  await seedScenario(db);
  await db.exec(`
    insert into public.work_schedules (salon_id, professional_id, weekday, start_time, end_time, valid_from) values
      ('${salons.a}', '${p.proA1}', 1, '09:00', '14:00', '2026-01-01');
  `);
}, 60_000);

afterAll(async () => {
  await db?.close();
});

type Otp = { otp_id: string; code: string; expires_at: string };

const asServer = <T>(fn: (tx: Transaction) => Promise<T>) => asRole(db, "service_role", null, fn);

const requestOtp = async (tx: Transaction, phone = PHONE, ip: string | null = "ip-1", professional: string = p.proA1) =>
  (await tx.query<Otp>("select * from public.request_booking_otp($1, $2, $3)", [professional, phone, ip])).rows[0];

const book = async (
  tx: Transaction,
  otp: Otp,
  opts: { code?: string; service?: string; start?: string; name?: string } = {},
) =>
  (
    await tx.query<{ id: string | null }>(
      "select public.create_public_booking($1, $2, $3, $4, $5, $6, $7) as id",
      [otp.otp_id, opts.code ?? otp.code, opts.service ?? s.corteA1, opts.start ?? SLOT, opts.name ?? "Laura Gómez", "LAURA@mail.com", "Primera vez"],
    )
  ).rows[0].id;

describe("Permisos", () => {
  it("el navegador (anon o usuario) no puede pedir códigos, reservar ni leer los códigos", async () => {
    for (const run of [
      <T>(fn: (tx: Transaction) => Promise<T>) => asAnon(db, fn),
      <T>(fn: (tx: Transaction) => Promise<T>) => asUser(db, users.userA2, fn),
    ]) {
      await expect(run((tx) => requestOtp(tx))).rejects.toThrow(/permission denied/);
      await expect(
        run((tx) => tx.query("select public.create_public_booking(gen_random_uuid(), '000000', $1, $2, 'X')", [s.corteA1, SLOT])),
      ).rejects.toThrow(/permission denied/);
      await expect(run((tx) => tx.query("select * from public.booking_otps"))).rejects.toThrow(/permission denied/);
    }
  });
});

describe("Reserva pública", () => {
  it("con el código correcto crea la cita, el cliente verificado y consume el código", async () => {
    const result = await asServer(async (tx) => {
      const otp = await requestOtp(tx);
      expect(otp.code).toMatch(/^\d{6}$/);
      const stored = await tx.query<{ code_hash: string }>("select code_hash from public.booking_otps where id = $1", [otp.otp_id]);
      expect(stored.rows[0].code_hash).not.toContain(otp.code);

      const id = await book(tx, otp);
      const appt = await tx.query<Record<string, unknown>>(
        `select a.status, a.source, a.notes, a.service_name, c.full_name, c.phone, c.email,
                c.phone_verified_at is not null as verified, c.professional_id
         from public.appointments a join public.clients c on c.id = a.client_id where a.id = $1`,
        [id],
      );
      const otpRow = await tx.query<{ consumed: boolean }>(
        "select consumed_at is not null as consumed from public.booking_otps where id = $1",
        [otp.otp_id],
      );
      // El código ya no sirve para una segunda reserva.
      await expect(book(tx, otp, { start: "2027-03-01 11:00+00" })).rejects.toThrow(/OTP_EXPIRED/);
      return { appt: appt.rows[0], consumed: otpRow.rows[0].consumed };
    });

    expect(result.appt).toEqual({
      status: "confirmed",
      source: "public_portal",
      notes: "Primera vez",
      service_name: "Corte clásico",
      full_name: "Laura Gómez",
      phone: PHONE,
      email: "laura@mail.com",
      verified: true,
      professional_id: p.proA1,
    });
    expect(result.consumed).toBe(true);
  });

  it("un código incorrecto no reserva, cuenta el intento y bloquea al quinto", async () => {
    const attempts = await asServer(async (tx) => {
      const otp = await requestOtp(tx);
      const wrong = otp.code === "000000" ? "111111" : "000000";
      for (let i = 0; i < 5; i++) expect(await book(tx, otp, { code: wrong })).toBeNull();
      const row = await tx.query<{ attempts: number }>("select attempts from public.booking_otps where id = $1", [otp.otp_id]);
      await expect(book(tx, otp)).rejects.toThrow(/OTP_LOCKED/);
      return row.rows[0].attempts;
    });
    expect(attempts).toBe(5);
  });

  it("un código caducado no sirve", async () => {
    await expect(
      asServer(async (tx) => {
        const otp = await requestOtp(tx);
        await tx.query("update public.booking_otps set expires_at = now() - interval '1 second' where id = $1", [otp.otp_id]);
        return book(tx, otp);
      }),
    ).rejects.toThrow(/OTP_EXPIRED/);
  });

  it("reutiliza el cliente de la cartera con ese teléfono (también si estaba archivado)", async () => {
    await db.exec(`update public.clients set archived_at = now() where id = '${c.clienteA1}'`);
    const row = await asServer(async (tx) => {
      const id = await book(tx, await requestOtp(tx, "+34611111111"));
      return (
        await tx.query<{ client_id: string; archived: boolean; total: number }>(
          `select a.client_id, cl.archived_at is not null as archived,
             (select count(*)::int from public.clients x where x.professional_id = $2) as total
           from public.appointments a join public.clients cl on cl.id = a.client_id where a.id = $1`,
          [id, p.proA1],
        )
      ).rows[0];
    });
    expect(row).toEqual({ client_id: c.clienteA1, archived: false, total: 1 });
  });

  it("solo huecos realmente libres, en el horario y con la antelación del profesional", async () => {
    await db.exec(`
      insert into public.appointments (salon_id, professional_id, client_id, service_id, starts_at, ends_at) values
        ('${salons.a}', '${p.proA1}', '${c.clienteA1}', '${s.corteA1}', '2027-03-01 10:00+00', '2027-03-01 10:30+00');
    `);
    const attempt = (start: string) => asServer(async (tx) => book(tx, await requestOtp(tx), { start }));
    await expect(attempt("2027-03-01 10:15+00")).rejects.toThrow(/SLOT_UNAVAILABLE/); // ocupado
    await expect(attempt("2027-03-01 15:00+00")).rejects.toThrow(/SLOT_UNAVAILABLE/); // fuera de horario
    await expect(attempt("2027-03-01 09:07+00")).rejects.toThrow(/SLOT_UNAVAILABLE/); // fuera de rejilla
    await expect(attempt("2026-01-05 09:00+00")).rejects.toThrow(/SLOT_UNAVAILABLE/); // pasado

    await db.exec(`update public.professionals set booking_horizon_days = 30 where id = '${p.proA1}'`);
    await expect(attempt(SLOT)).rejects.toThrow(/SLOT_UNAVAILABLE/); // más allá del horizonte
  });

  it("no reserva servicios privados ni de otro profesional", async () => {
    await db.exec(`update public.services set is_public = false where id = '${s.corteA1}'`);
    await expect(asServer(async (tx) => book(tx, await requestOtp(tx)))).rejects.toThrow(/NOT_BOOKABLE/);
    await expect(asServer(async (tx) => book(tx, await requestOtp(tx), { service: s.corteA2 }))).rejects.toThrow(/NOT_BOOKABLE/);
  });

  it("valida el nombre", async () => {
    await expect(asServer(async (tx) => book(tx, await requestOtp(tx), { name: " " }))).rejects.toThrow(/INVALID_NAME/);
  });
});

describe("request_booking_otp()", () => {
  it("limita los códigos por teléfono y por IP", async () => {
    await asServer(async (tx) => {
      for (let i = 0; i < 3; i++) await requestOtp(tx, PHONE, `ip-${i}`);
      await expect(requestOtp(tx, PHONE, "ip-9")).rejects.toThrow(/TOO_MANY_REQUESTS/);
    });
    await asServer(async (tx) => {
      for (let i = 0; i < 10; i++) await requestOtp(tx, `+3469900${String(i).padStart(4, "0")}`, "ip-x");
      await expect(requestOtp(tx, "+34699009999", "ip-x")).rejects.toThrow(/TOO_MANY_REQUESTS/);
    });
  });

  it("solo para profesionales que aceptan reservas y con teléfono válido", async () => {
    await expect(asServer((tx) => requestOtp(tx, "600123123"))).rejects.toThrow(/INVALID_PHONE/);
    await db.exec(`update public.professionals set accepts_online_booking = false where id = '${p.proA1}'`);
    await expect(asServer((tx) => requestOtp(tx))).rejects.toThrow(/NOT_BOOKABLE/);
  });
});

describe("get_available_slots() para el público", () => {
  it("respeta el horizonte de reserva; el propio profesional ve toda su agenda", async () => {
    const sql = `select starts_at from public.get_available_slots('${s.corteA1}', '2027-03-01', '2027-03-01')`;
    expect((await asAnon(db, (tx) => tx.query(sql))).rows).toHaveLength(19);
    await db.exec(`update public.professionals set booking_horizon_days = 30 where id = '${p.proA1}'`);
    expect((await asAnon(db, (tx) => tx.query(sql))).rows).toHaveLength(0);
    expect((await asUser(db, users.ownerA, (tx) => tx.query(sql))).rows).toHaveLength(19);
  });

  it("la página pública incluye los ajustes de reserva y nunca datos de contacto", async () => {
    const { rows } = await asAnon(db, (tx) =>
      tx.query<{ salon: { professionals: Record<string, unknown>[] } }>("select public.get_public_salon('barberia-elegance') as salon"),
    );
    const pro = rows[0].salon.professionals[0];
    expect(pro).toMatchObject({ min_notice_minutes: 120, booking_horizon_days: 365 });
    expect(pro).not.toHaveProperty("phone");
    expect(pro).not.toHaveProperty("email");
  });
});
