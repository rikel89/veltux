import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { asAnon, asUser, createTestDatabase, type Db } from "./harness";
import { ids, seedScenario } from "./fixtures";

const { users, salons, professionals: p, services: s } = ids;

// 2027-03-01 es lunes (CET, UTC+1); 2027-03-29 es lunes tras el cambio de hora (CEST, UTC+2).
const MONDAY = "2027-03-01";
const MONDAY_DST = "2027-03-29";
const SUNDAY = "2027-03-07";

let db: Db;

beforeEach(async () => {
  await db?.close();
  db = await createTestDatabase();
  await seedScenario(db);
  // Carlos (proA1): lunes con jornada partida 09:00-14:00 y 16:00-20:00 (hora de Madrid).
  await db.exec(`
    insert into public.work_schedules (salon_id, professional_id, weekday, start_time, end_time, valid_from) values
      ('${salons.a}', '${p.proA1}', 1, '09:00', '14:00', '2026-01-01'),
      ('${salons.a}', '${p.proA1}', 1, '16:00', '20:00', '2026-01-01');
  `);
}, 60_000);

afterAll(async () => {
  await db?.close();
});

type Slot = { starts_at: string; ends_at: string };

const slotsSql = (from: string, to = from, service: string = s.corteA1) =>
  `select starts_at, ends_at from public.get_available_slots('${service}', '${from}', '${to}')`;

const anonSlots = async (from: string, to = from, service: string = s.corteA1) =>
  (await asAnon(db, (tx) => tx.query<Slot>(slotsSql(from, to, service)))).rows;

const iso = (rows: Slot[]) => rows.map((r) => new Date(r.starts_at).toISOString().slice(11, 16));

const slots = (weekday: number, start: string, end: string) => ({ weekday, start_time: start, end_time: end });

const replace = (userId: string, professionalId: string, payload: unknown) =>
  asUser(db, userId, (tx) =>
    tx.query<{ n: number }>("select public.replace_my_weekly_schedule($1, $2::jsonb) as n", [
      professionalId,
      JSON.stringify(payload),
    ]),
  );

describe("replace_my_weekly_schedule()", () => {
  it("el profesional guarda su horario con jornada partida", async () => {
    const { rows } = await replace(users.userA2, p.proA2, [
      slots(1, "09:00", "14:00"),
      slots(1, "16:00", "20:00"),
      slots(6, "10:00", "14:00"),
    ]);
    expect(rows[0].n).toBe(3);
  });

  it("rechaza franjas que se solapan en el mismo día", async () => {
    await expect(
      replace(users.userA2, p.proA2, [slots(2, "09:00", "14:00"), slots(2, "13:30", "18:00")]),
    ).rejects.toThrow(/SCHEDULE_OVERLAP/);
    // Mismo horario en días distintos sí es válido.
    await expect(
      replace(users.userA2, p.proA2, [slots(2, "09:00", "14:00"), slots(3, "09:00", "14:00")]),
    ).resolves.toBeDefined();
  });

  it("rechaza franjas mal formadas o fuera de la rejilla de 5 minutos", async () => {
    await expect(replace(users.userA2, p.proA2, [slots(1, "14:00", "09:00")])).rejects.toThrow(/INVALID_SCHEDULE/);
    await expect(replace(users.userA2, p.proA2, [slots(1, "09:07", "14:00")])).rejects.toThrow(/INVALID_SCHEDULE/);
    await expect(replace(users.userA2, p.proA2, [slots(8, "09:00", "14:00")])).rejects.toThrow(/INVALID_SCHEDULE/);
  });

  it("nadie más puede cambiar el horario de un profesional (ni el propietario)", async () => {
    await expect(replace(users.ownerA, p.proA2, [slots(1, "09:00", "14:00")])).rejects.toThrow(/FORBIDDEN/);
    await expect(
      asUser(db, users.userA2, (tx) =>
        tx.query(
          `insert into public.work_schedules (salon_id, professional_id, weekday, start_time, end_time)
           values ('${salons.a}', '${p.proA2}', 1, '09:00', '14:00')`,
        ),
      ),
    ).rejects.toThrow(/permission denied/);
  });

  it("versiona: el horario anterior se cierra ayer y el nuevo rige desde hoy", async () => {
    const rows = await asUser(db, users.ownerA, async (tx) => {
      await tx.query("select public.replace_my_weekly_schedule($1, $2::jsonb)", [
        p.proA1,
        JSON.stringify([slots(2, "10:00", "18:00")]),
      ]);
      return (
        await tx.query<{ weekday: number; valid_from: string; closed: boolean; from_today: boolean }>(
          `select weekday,
                  valid_until = (now() at time zone 'Europe/Madrid')::date - 1 as closed,
                  valid_from = (now() at time zone 'Europe/Madrid')::date as from_today
           from public.work_schedules where professional_id = $1 order by weekday, start_time`,
          [p.proA1],
        )
      ).rows;
    });
    expect(rows.map(({ weekday, closed, from_today }) => ({ weekday, closed, from_today }))).toEqual([
      { weekday: 1, closed: true, from_today: false },
      { weekday: 1, closed: true, from_today: false },
      { weekday: 2, closed: null, from_today: true },
    ]);
  });

  it("la base de datos impide solapes aunque se escriba directamente", async () => {
    await expect(
      db.query(
        `insert into public.work_schedules (salon_id, professional_id, weekday, start_time, end_time, valid_from)
         values ('${salons.a}', '${p.proA1}', 1, '13:00', '15:00', '2026-06-01')`,
      ),
    ).rejects.toThrow(/work_schedules_no_overlap/);
  });
});

describe("get_available_slots()", () => {
  it("calcula los huecos del horario en la zona del salón", async () => {
    const rows = await anonSlots(MONDAY);
    // Mañana: 09:00 → 13:30 cada 15 min (19); tarde: 16:00 → 19:30 (15).
    expect(rows).toHaveLength(34);
    expect(iso(rows).slice(0, 2)).toEqual(["08:00", "08:15"]); // 09:00 CET
    expect(new Date(rows[0].ends_at).getTime() - new Date(rows[0].starts_at).getTime()).toBe(30 * 60_000);
  });

  it("respeta el cambio de hora", async () => {
    const rows = await anonSlots(MONDAY_DST);
    expect(iso(rows)[0]).toBe("07:00"); // 09:00 CEST
  });

  it("descuenta las citas activas y el margen posterior del servicio", async () => {
    await db.exec(`
      insert into public.appointments (salon_id, professional_id, client_id, service_id, starts_at, ends_at) values
        ('${salons.a}', '${p.proA1}', '${ids.clients.clienteA1}', '${s.corteA1}', '2027-03-01 09:00+00', '2027-03-01 09:30+00');
    `);
    let morning = iso(await anonSlots(MONDAY)).filter((t) => t < "13:00");
    expect(morning).toContain("08:30"); // 09:30 local cabe justo antes de la cita de las 10:00
    expect(morning).not.toContain("08:45");
    expect(morning).not.toContain("09:15");
    expect(morning).toContain("09:30"); // 10:30 local

    await db.exec(`update public.services set buffer_after_minutes = 15 where id = '${s.corteA1}'`);
    morning = iso(await anonSlots(MONDAY)).filter((t) => t < "13:00");
    expect(morning).not.toContain("08:30"); // su margen pisaría la cita
    expect(morning).toContain("08:15");
    expect(morning).not.toContain("09:30"); // la cita también deja su margen
    expect(morning).toContain("09:45");
  });

  it("una cita cancelada libera el hueco", async () => {
    await db.exec(`
      insert into public.appointments (salon_id, professional_id, client_id, service_id, starts_at, ends_at, status, cancelled_at) values
        ('${salons.a}', '${p.proA1}', '${ids.clients.clienteA1}', '${s.corteA1}', '2027-03-01 09:00+00', '2027-03-01 09:30+00', 'cancelled', now());
    `);
    expect(await anonSlots(MONDAY)).toHaveLength(34);
  });

  it("aplica días libres, bloqueos y disponibilidad extra", async () => {
    await db.exec(`
      insert into public.schedule_exceptions (salon_id, professional_id, type, starts_at, ends_at, reason) values
        ('${salons.a}', '${p.proA1}', 'block', '2027-03-01 15:00+00', '2027-03-01 17:00+00', 'Formación'),
        ('${salons.a}', '${p.proA1}', 'day_off', '2027-03-07 23:00+00', '2027-03-08 23:00+00', 'Vacaciones'),
        ('${salons.a}', '${p.proA1}', 'extra_availability', '2027-03-07 09:00+00', '2027-03-07 11:00+00', null);
    `);
    const afternoon = iso(await anonSlots(MONDAY)).filter((t) => t >= "14:00");
    expect(afternoon[0]).toBe("17:00"); // 18:00 local, tras el bloqueo
    expect(iso(await anonSlots(SUNDAY))).toEqual(["09:00", "09:15", "09:30", "09:45", "10:00", "10:15", "10:30"]);
    expect(await anonSlots("2027-03-08")).toHaveLength(0); // lunes de vacaciones
  });

  it("devuelve varios días y nunca huecos pasados", async () => {
    expect(await anonSlots(MONDAY, "2027-03-14")).toHaveLength(34 * 2);
    expect(await anonSlots("2026-01-05")).toHaveLength(0);
  });

  it("valida el rango y el paso", async () => {
    await expect(anonSlots(MONDAY, "2027-04-15")).rejects.toThrow(/INVALID_RANGE/);
    await expect(anonSlots(MONDAY, "2027-02-01")).rejects.toThrow(/INVALID_RANGE/);
    await expect(
      asAnon(db, (tx) => tx.query(`select * from public.get_available_slots('${s.corteA1}', '${MONDAY}', '${MONDAY}', 7)`)),
    ).rejects.toThrow(/INVALID_STEP/);
  });

  it("el público solo ve profesionales reservables; el propio profesional ve sus servicios privados", async () => {
    await db.exec(`update public.services set is_public = false where id = '${s.corteA1}'`);
    await expect(anonSlots(MONDAY)).rejects.toThrow(/NOT_BOOKABLE/);
    const own = await asUser(db, users.ownerA, (tx) => tx.query<Slot>(slotsSql(MONDAY)));
    expect(own.rows).toHaveLength(34);
    // Otro profesional del salón tampoco ve los servicios privados.
    await expect(asUser(db, users.userA2, (tx) => tx.query(slotsSql(MONDAY)))).rejects.toThrow(/NOT_BOOKABLE/);

    await db.exec(`update public.services set is_public = true where id = '${s.corteA1}'`);
    await db.exec(`update public.professionals set accepts_online_booking = false where id = '${p.proA1}'`);
    await expect(anonSlots(MONDAY)).rejects.toThrow(/NOT_BOOKABLE/);
  });

  it("sin licencia, con el salón suspendido o con el servicio inactivo no hay huecos", async () => {
    await db.exec(`update public.license_assignments set revoked_at = now() where professional_id = '${p.proA1}'`);
    await expect(anonSlots(MONDAY)).rejects.toThrow(/NOT_BOOKABLE/);
    await db.exec(`update public.license_assignments set revoked_at = null where professional_id = '${p.proA1}'`);

    await db.exec(`update public.salons set status = 'suspended' where id = '${salons.a}'`);
    await expect(anonSlots(MONDAY)).rejects.toThrow(/NOT_BOOKABLE/);
    await db.exec(`update public.salons set status = 'active' where id = '${salons.a}'`);

    await db.exec(`update public.services set is_active = false where id = '${s.corteA1}'`);
    await expect(anonSlots(MONDAY)).rejects.toThrow(/NOT_BOOKABLE/);
  });
});

describe("schedule_exceptions", () => {
  const insertBlock = (professionalId: string) =>
    `insert into public.schedule_exceptions (salon_id, professional_id, type, starts_at, ends_at, reason, created_by)
     values ('${salons.a}', '${professionalId}', 'block', '2027-03-01 10:00+00', '2027-03-01 11:00+00', 'Médico', '${users.admin}')
     returning created_by`;

  it("el profesional crea sus excepciones y el autor lo fija el servidor", async () => {
    const { rows } = await asUser(db, users.userA2, (tx) => tx.query<{ created_by: string }>(insertBlock(p.proA2)));
    expect(rows[0].created_by).toBe(users.userA2);
  });

  it("son privadas: ni el propietario ni otro profesional las ven o crean", async () => {
    await db.query(insertBlock(p.proA2));
    const seen = await asUser(db, users.ownerA, (tx) =>
      tx.query("select id from public.schedule_exceptions where professional_id = $1", [p.proA2]),
    );
    expect(seen.rows).toHaveLength(0);
    await expect(asUser(db, users.ownerA, (tx) => tx.query(insertBlock(p.proA2)))).rejects.toThrow(/row-level security/);
  });

  it("no admite excepciones de más de tres meses", async () => {
    await expect(
      db.query(
        `insert into public.schedule_exceptions (salon_id, professional_id, type, starts_at, ends_at)
         values ('${salons.a}', '${p.proA1}', 'day_off', '2027-01-01', '2027-06-01')`,
      ),
    ).rejects.toThrow(/schedule_exceptions_max_length/);
  });
});
