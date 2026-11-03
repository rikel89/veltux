import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { asUser, createTestDatabase, type Db } from "./harness";
import { ids, seedScenario } from "./fixtures";

const { users, salons, professionals: p, services: s, clients: c } = ids;

// Carlos (proA1) trabaja los lunes 09:00-14:00 y 16:00-20:00 (Madrid, UTC+1 en marzo).
// 2027-03-01 09:00Z = 10:00 local.
const AT = (utcTime: string, day = "2027-03-01") => `${day} ${utcTime}+00`;
const PAST = "00000000-0000-4000-8000-0000000000c1";

let db: Db;

beforeEach(async () => {
  await db?.close();
  db = await createTestDatabase();
  await seedScenario(db);
  await db.exec(`
    insert into public.work_schedules (salon_id, professional_id, weekday, start_time, end_time, valid_from) values
      ('${salons.a}', '${p.proA1}', 1, '09:00', '14:00', '2026-01-01'),
      ('${salons.a}', '${p.proA1}', 1, '16:00', '20:00', '2026-01-01');
  `);
}, 60_000);

afterAll(async () => {
  await db?.close();
});

const createSql = "select public.create_my_appointment($1, $2, $3, $4, $5) as id";

const create = (start: string, opts: { user?: string; service?: string; client?: string; force?: boolean } = {}) =>
  asUser(db, opts.user ?? users.ownerA, async (tx) => {
    const { rows } = await tx.query<{ id: string }>(createSql, [
      opts.service ?? s.corteA1,
      opts.client ?? c.clienteA1,
      start,
      "Nota",
      opts.force ?? false,
    ]);
    return rows[0].id;
  });

/** Cita existente de Carlos, escrita directamente (como haría un dato previo). */
const seedAppointment = (start: string, end: string, id?: string) =>
  db.query(
    `insert into public.appointments (${id ? "id, " : ""}salon_id, professional_id, client_id, service_id, starts_at, ends_at)
     values (${id ? `'${id}', ` : ""}$1, $2, $3, $4, $5, $6)`,
    [salons.a, p.proA1, c.clienteA1, s.corteA1, start, end],
  );

describe("create_my_appointment()", () => {
  it("crea una cita confirmada en el horario, con histórico de precio y bitácora", async () => {
    const row = await asUser(db, users.ownerA, async (tx) => {
      const { rows } = await tx.query<{ id: string }>(createSql, [s.corteA1, c.clienteA1, AT("09:00"), " ", false]);
      return (
        await tx.query<Record<string, unknown>>(
          `select a.status, a.source, a.ends_at, a.service_name, a.price_cents, a.notes, a.created_by,
             (select array_agg(e.event_type::text) from public.appointment_events e where e.appointment_id = a.id) as events
           from public.appointments a where a.id = $1`,
          [rows[0].id],
        )
      ).rows[0];
    });
    expect(row).toMatchObject({
      status: "confirmed",
      source: "professional",
      service_name: "Corte clásico",
      price_cents: 1500,
      notes: null,
      created_by: users.ownerA,
      events: ["created"],
    });
    expect(new Date(row.ends_at as string).toISOString()).toBe("2027-03-01T09:30:00.000Z");
  });

  it("fuera del horario o en un día libre exige confirmarlo expresamente", async () => {
    await expect(create(AT("14:00"))).rejects.toThrow(/OUTSIDE_SCHEDULE/); // 15:00, entre turnos
    await expect(create(AT("12:45"))).rejects.toThrow(/OUTSIDE_SCHEDULE/); // termina 14:15, se sale
    await expect(create(AT("14:00"), { force: true })).resolves.toBeDefined();

    await db.exec(`
      insert into public.schedule_exceptions (salon_id, professional_id, type, starts_at, ends_at)
      values ('${salons.a}', '${p.proA1}', 'day_off', '2027-02-28 23:00+00', '2027-03-01 23:00+00');
    `);
    await expect(create(AT("09:00"))).rejects.toThrow(/OUTSIDE_SCHEDULE/);
  });

  it("nunca solapa otra cita, ni siquiera forzando", async () => {
    await seedAppointment(AT("09:00"), AT("09:30"));
    await expect(create(AT("09:15"))).rejects.toThrow(/SLOT_TAKEN/);
    await expect(create(AT("09:15"), { force: true })).rejects.toThrow(/SLOT_TAKEN/);
    await expect(create(AT("09:30"))).resolves.toBeDefined(); // contigua
  });

  it("respeta el margen del servicio antes y después", async () => {
    await db.exec(`update public.services set buffer_after_minutes = 15 where id = '${s.corteA1}'`);
    await seedAppointment(AT("09:00"), AT("09:30"));
    await expect(create(AT("09:30"))).rejects.toThrow(/SLOT_TAKEN/); // margen de la cita existente
    await expect(create(AT("09:45"))).resolves.toBeDefined();
    await expect(create(AT("08:30"))).rejects.toThrow(/SLOT_TAKEN/); // su margen pisaría la de las 09:00
    await expect(create(AT("08:30"), { force: true })).resolves.toBeDefined();
  });

  it("la segunda reserva del mismo hueco falla", async () => {
    await asUser(db, users.ownerA, async (tx) => {
      await tx.query(createSql, [s.corteA1, c.clienteA1, AT("10:00"), null, false]);
      await expect(tx.query(createSql, [s.corteA1, c.clienteA1, AT("10:00"), null, false])).rejects.toThrow(/SLOT_TAKEN/);
    });
  });

  it("solo con servicios y clientes propios", async () => {
    await expect(create(AT("09:00"), { client: c.clienteA2 })).rejects.toThrow(/CLIENT_NOT_FOUND/);
    // El propietario no puede crear citas en la agenda de un autónomo de su salón.
    await expect(create(AT("09:00"), { service: s.corteA2, client: c.clienteA2 })).rejects.toThrow(/SERVICE_NOT_FOUND/);
    await db.exec(`update public.clients set archived_at = now() where id = '${c.clienteA1}'`);
    await expect(create(AT("09:00"))).rejects.toThrow(/CLIENT_NOT_FOUND/);
  });

  it("valida la hora: rejilla de 5 minutos y nada en el pasado sin confirmarlo", async () => {
    await expect(create(AT("09:07"))).rejects.toThrow(/INVALID_TIME/);
    await expect(create(AT("09:00", "2026-01-05"))).rejects.toThrow(/IN_THE_PAST/);
    await expect(create(AT("09:00", "2026-01-05"), { force: true })).resolves.toBeDefined();
  });

  it("sin licencia no se crean citas", async () => {
    await db.exec(`update public.license_assignments set revoked_at = now() where professional_id = '${p.proA1}'`);
    await expect(create(AT("09:00"))).rejects.toThrow(/PROFESSIONAL_WITHOUT_LICENSE/);
  });

  it("no se pueden insertar ni modificar citas sin pasar por las funciones", async () => {
    await expect(
      asUser(db, users.ownerA, (tx) =>
        tx.query(
          `insert into public.appointments (salon_id, professional_id, client_id, service_id, starts_at, ends_at)
           values ($1, $2, $3, $4, $5, $6)`,
          [salons.a, p.proA1, c.clienteA1, s.corteA1, AT("09:00"), AT("09:30")],
        ),
      ),
    ).rejects.toThrow(/permission denied/);
    await expect(
      asUser(db, users.ownerA, (tx) => tx.query("update public.appointments set status = 'completed' where id = $1", [ids.appointments.citaA1])),
    ).rejects.toThrow(/permission denied/);
    const notes = await asUser(db, users.ownerA, (tx) =>
      tx.query("update public.appointments set notes = 'Trae foto' where id = $1", [ids.appointments.citaA1]),
    );
    expect(notes.affectedRows).toBe(1);
  });
});

describe("reschedule_my_appointment()", () => {
  const reschedule = (id: string, start: string, user: string = users.ownerA, force = false) =>
    asUser(db, user, (tx) => tx.query("select public.reschedule_my_appointment($1, $2, $3)", [id, start, force]));

  it("mueve la cita conservando su duración y lo registra", async () => {
    const events = await asUser(db, users.ownerA, async (tx) => {
      const { rows } = await tx.query<{ id: string }>(createSql, [s.corteA1, c.clienteA1, AT("09:00"), null, false]);
      // Solapa con su propia posición anterior: está permitido.
      await tx.query("select public.reschedule_my_appointment($1, $2, false)", [rows[0].id, AT("09:15")]);
      const appt = await tx.query<{ starts_at: string; ends_at: string }>(
        "select starts_at, ends_at from public.appointments where id = $1",
        [rows[0].id],
      );
      expect(new Date(appt.rows[0].ends_at).toISOString()).toBe("2027-03-01T09:45:00.000Z");
      return (
        await tx.query<{ event_type: string }>(
          "select event_type from public.appointment_events where appointment_id = $1 order by created_at, event_type",
          [rows[0].id],
        )
      ).rows.map((e) => e.event_type);
    });
    expect(events.sort()).toEqual(["created", "rescheduled"]);
  });

  it("no se mueve a un hueco ocupado ni fuera del horario", async () => {
    await seedAppointment(AT("10:00"), AT("10:30"));
    await seedAppointment(AT("12:00"), AT("12:30"), PAST);
    await expect(reschedule(PAST, AT("10:15"))).rejects.toThrow(/SLOT_TAKEN/);
    await expect(reschedule(PAST, AT("14:00"))).rejects.toThrow(/OUTSIDE_SCHEDULE/);
    await expect(reschedule(PAST, AT("14:00"), users.ownerA, true)).resolves.toBeDefined();
  });

  it("solo el profesional de la cita y solo si está activa", async () => {
    await seedAppointment(AT("12:00"), AT("12:30"), PAST);
    await expect(reschedule(PAST, AT("11:00"), users.userA2)).rejects.toThrow(/NOT_FOUND/);
    await db.exec(`update public.appointments set status = 'cancelled', cancelled_at = now() where id = '${PAST}'`);
    await expect(reschedule(PAST, AT("11:00"))).rejects.toThrow(/INVALID_TRANSITION/);
  });
});

describe("set_my_appointment_status()", () => {
  const setStatus = (id: string, status: string, user: string = users.ownerA, reason: string | null = null) =>
    asUser(db, user, (tx) => tx.query("select public.set_my_appointment_status($1, $2, $3)", [id, status, reason]));

  it("cancelar guarda el motivo y es definitivo", async () => {
    const row = await asUser(db, users.ownerA, async (tx) => {
      await tx.query("select public.set_my_appointment_status($1, 'cancelled', ' El cliente avisó ')", [ids.appointments.citaA1]);
      return (
        await tx.query<{ status: string; cancel_reason: string; cancelled: boolean }>(
          "select status, cancel_reason, cancelled_at is not null as cancelled from public.appointments where id = $1",
          [ids.appointments.citaA1],
        )
      ).rows[0];
    });
    expect(row).toEqual({ status: "cancelled", cancel_reason: "El cliente avisó", cancelled: true });

    await db.exec(`update public.appointments set status = 'cancelled', cancelled_at = now() where id = '${ids.appointments.citaA1}'`);
    await expect(setStatus(ids.appointments.citaA1, "confirmed")).rejects.toThrow(/INVALID_TRANSITION/);
  });

  it("completada / no presentado solo cuando la cita ya empezó, y se puede deshacer", async () => {
    await expect(setStatus(ids.appointments.citaA1, "completed")).rejects.toThrow(/NOT_STARTED/);

    await seedAppointment(AT("09:00", "2026-01-05"), AT("09:30", "2026-01-05"), PAST);
    const statuses = await asUser(db, users.ownerA, async (tx) => {
      const out: string[] = [];
      for (const status of ["completed", "no_show", "confirmed"]) {
        await tx.query("select public.set_my_appointment_status($1, $2)", [PAST, status]);
        out.push((await tx.query<{ status: string }>("select status from public.appointments where id = $1", [PAST])).rows[0].status);
      }
      return out;
    });
    expect(statuses).toEqual(["completed", "no_show", "confirmed"]);
  });

  it("nadie más cambia el estado de mis citas (ni el propietario)", async () => {
    await expect(setStatus(ids.appointments.citaA2, "cancelled")).rejects.toThrow(/NOT_FOUND/);
    await expect(setStatus(ids.appointments.citaA1, "cancelled", users.userA2)).rejects.toThrow(/NOT_FOUND/);
  });
});

describe("get_available_slots() tras el cambio a cálculo compartido", () => {
  it("una cita ocupa sus huecos", async () => {
    await seedAppointment(AT("09:00"), AT("09:30"));
    const { rows } = await db.query<{ starts_at: string }>(
      `select starts_at from public.get_available_slots('${s.corteA1}', '2027-03-01', '2027-03-01')`,
    );
    const times = rows.map((r) => new Date(r.starts_at).toISOString().slice(11, 16));
    expect(times).toHaveLength(34 - 3);
    expect(times).not.toContain("09:00");
  });
});
