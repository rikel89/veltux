import type { Transaction } from "@electric-sql/pglite";
import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { asAnon, asRole, asUser, createTestDatabase, type Db } from "./harness";
import { ids, seedScenario } from "./fixtures";

const { users, salons, professionals: p, services: s, clients: c, appointments: a } = ids;

// Lunes 2027-03-01: Carlos y Javier trabajan de 09:00 a 14:00 (Madrid, UTC+1).
const DAY = "2027-03-01";
const AT = (utc: string) => `${DAY} ${utc}+00`;
const CITA = "50000000-0000-4000-8000-0000000000c1";

let db: Db;

beforeEach(async () => {
  await db?.close();
  db = await createTestDatabase();
  await seedScenario(db);
  await db.exec(`
    insert into public.work_schedules (salon_id, professional_id, weekday, start_time, end_time, valid_from) values
      ('${salons.a}', '${p.proA1}', 1, '09:00', '14:00', '2026-01-01'),
      ('${salons.a}', '${p.proA2}', 1, '09:00', '14:00', '2026-01-01');
    insert into public.appointments (id, salon_id, professional_id, client_id, service_id, starts_at, ends_at) values
      ('${CITA}', '${salons.a}', '${p.proA1}', '${c.clienteA1}', '${s.corteA1}', '${AT("09:00")}', '${AT("09:30")}');
  `);
}, 60_000);

afterAll(async () => {
  await db?.close();
});

const asServer = <T>(fn: (tx: Transaction) => Promise<T>) => asRole(db, "service_role", null, fn);

const templates = async (tx: Transaction | Db, appointment = CITA) =>
  (
    await tx.query<{ template: string }>(
      "select template from public.notifications where appointment_id = $1 order by created_at, template",
      [appointment],
    )
  ).rows.map((n) => n.template);

describe("Cola de notificaciones", () => {
  it("una cita nueva encola la confirmación y el recordatorio 24 h antes, ambos pendientes", async () => {
    const { rows } = await db.query<{ template: string; status: string; channel: string; email: string; early: boolean }>(
      `select template, status, channel, recipient_email as email, next_attempt_at = '2027-02-28 09:00+00' as early
       from public.notifications where appointment_id = $1 order by template`,
      [CITA],
    );
    expect(rows).toEqual([
      { template: "appointment.created", status: "pending", channel: "email", email: "carlos.cliente@veltux.test", early: false },
      { template: "appointment.reminder", status: "pending", channel: "email", email: "carlos.cliente@veltux.test", early: true },
    ]);
  });

  it("sin email en la ficha ni en la cita no se encola nada", async () => {
    await db.exec(`update public.clients set email = null where id = '${c.clienteA1}'`);
    await db.exec(`
      insert into public.appointments (id, salon_id, professional_id, client_id, service_id, starts_at, ends_at) values
        ('50000000-0000-4000-8000-0000000000c4', '${salons.a}', '${p.proA1}', '${c.clienteA1}', '${s.corteA1}', '${AT("11:00")}', '${AT("11:30")}');
    `);
    expect(await templates(db, "50000000-0000-4000-8000-0000000000c4")).toEqual([]);
  });

  it("la cita guarda el email de contacto de la ficha", async () => {
    const { rows } = await db.query<{ contact_email: string }>("select contact_email from public.appointments where id = $1", [CITA]);
    expect(rows[0].contact_email).toBe("carlos.cliente@veltux.test");
  });

  it("una cita pasada no avisa a nadie", async () => {
    await db.exec(`
      insert into public.appointments (id, salon_id, professional_id, client_id, service_id, starts_at, ends_at) values
        ('50000000-0000-4000-8000-0000000000c2', '${salons.a}', '${p.proA1}', '${c.clienteA1}', '${s.corteA1}', '2026-01-05 09:00+00', '2026-01-05 09:30+00');
    `);
    expect(await templates(db, "50000000-0000-4000-8000-0000000000c2")).toEqual([]);
  });

  it("cancelar avisa una sola vez y retira el recordatorio", async () => {
    const out = await asUser(db, users.ownerA, async (tx) => {
      await tx.query("select public.set_my_appointment_status($1, 'cancelled')", [CITA]);
      return templates(tx);
    });
    expect(out.sort()).toEqual(["appointment.cancelled", "appointment.created"]);
  });

  it("mover la cita avisa y rehace el recordatorio", async () => {
    const out = await asUser(db, users.ownerA, async (tx) => {
      await tx.query("select public.reschedule_my_appointment($1, $2)", [CITA, AT("10:00")]);
      return (
        await tx.query<{ template: string; on_time: boolean }>(
          `select template, next_attempt_at = '2027-02-28 10:00+00' as on_time from public.notifications
           where appointment_id = $1 and template in ('appointment.reminder', 'appointment.rescheduled') order by template`,
          [CITA],
        )
      ).rows;
    });
    expect(out).toEqual([
      { template: "appointment.reminder", on_time: true },
      { template: "appointment.rescheduled", on_time: false },
    ]);
  });

  it("reintenta con espera, falla al agotar intentos y nunca marca enviada sin resultado del proveedor", async () => {
    await db.exec(`update public.notifications set max_attempts = 2 where appointment_id = '${CITA}' and template = 'appointment.created'`);
    await db.exec(`update public.notifications set next_attempt_at = now() + interval '1 day' where template <> 'appointment.created' or appointment_id <> '${CITA}'`);

    const run = async (ok: boolean) => {
      const { rows } = await db.query<{ id: string; status: string }>("select id, status from public.claim_pending_notifications(10)");
      expect(rows).toHaveLength(1);
      expect(rows[0].status).toBe("processing");
      const res = await db.query<{ status: string }>(
        "select public.record_notification_result($1, $2, 'proveedor', $3, $4) as status",
        [rows[0].id, ok, ok ? "msg-1" : null, ok ? null : "Rechazado"],
      );
      return { id: rows[0].id, status: res.rows[0].status };
    };

    const first = await run(false);
    expect(first.status).toBe("pending");
    // No se reclama hasta que pasa la espera.
    expect((await db.query("select * from public.claim_pending_notifications(10)")).rows).toHaveLength(0);
    await db.query("update public.notifications set next_attempt_at = now() where id = $1", [first.id]);
    const second = await run(false);
    expect(second.status).toBe("failed");
    const row = await db.query<{ last_error: string; failed: boolean; sent: boolean }>(
      "select last_error, failed_at is not null as failed, sent_at is not null as sent from public.notifications where id = $1",
      [first.id],
    );
    expect(row.rows[0]).toEqual({ last_error: "Rechazado", failed: true, sent: false });
  });

  it("enviada pasa a entregada solo con la confirmación del proveedor", async () => {
    await db.exec(`update public.notifications set status = 'sent', provider = 'proveedor', provider_message_id = 'm1' where appointment_id = '${CITA}' and template = 'appointment.created'`);
    const delivered = await db.query<{ ok: boolean }>("select public.record_notification_delivered('proveedor', 'm1') as ok");
    const unknown = await db.query<{ ok: boolean }>("select public.record_notification_delivered('proveedor', 'otro') as ok");
    expect([delivered.rows[0].ok, unknown.rows[0].ok]).toEqual([true, false]);
  });

  it("recupera mensajes bloqueados por un proceso caído", async () => {
    await db.exec(`update public.notifications set status = 'processing', locked_at = now() - interval '11 minutes', attempts = 1, next_attempt_at = now() where appointment_id = '${CITA}' and template = 'appointment.created'`);
    await db.exec(`update public.notifications set next_attempt_at = now() + interval '1 day' where status = 'pending'`);
    const { rows } = await db.query<{ attempts: number }>("select attempts from public.claim_pending_notifications(10)");
    expect(rows).toEqual([{ attempts: 2 }]);
  });

  it("no envía avisos de citas que ya han pasado", async () => {
    await db.exec(`update public.notifications set payload = payload || '{"starts_at":"2026-01-05T09:00:00Z"}' where appointment_id = '${CITA}' and template = 'appointment.created'`);
    await db.exec(`update public.notifications set next_attempt_at = now() + interval '1 day' where not (appointment_id = '${CITA}' and template = 'appointment.created')`);
    expect((await db.query("select * from public.claim_pending_notifications(10)")).rows).toHaveLength(0);
    const { rows } = await db.query<{ status: string; last_error: string }>(
      "select status, last_error from public.notifications where appointment_id = $1 and template = 'appointment.created'",
      [CITA],
    );
    expect(rows[0]).toEqual({ status: "failed", last_error: "La cita ya ha pasado" });
  });

  it("la cola solo la procesa el servidor", async () => {
    await expect(asUser(db, users.ownerA, (tx) => tx.query("select * from public.claim_pending_notifications(1)"))).rejects.toThrow(/permission denied/);
    await expect(asAnon(db, (tx) => tx.query("select public.record_notification_delivered('a', 'b')"))).rejects.toThrow(/permission denied/);
    await expect(asServer((tx) => tx.query("select * from public.claim_pending_notifications(1)"))).resolves.toBeDefined();
  });
});

describe("Gestionar imprevisto", () => {
  it("bloquear la jornada quita los huecos, deja las citas y es idempotente", async () => {
    const out = await asUser(db, users.ownerA, async (tx) => {
      await tx.query("select public.block_my_day($1, $2, 'Gripe')", [p.proA1, DAY]);
      await tx.query("select public.block_my_day($1, $2, 'Gripe')", [p.proA1, DAY]);
      return {
        slots: (await tx.query(`select 1 from public.get_available_slots('${s.corteA1}', '${DAY}', '${DAY}')`)).rows.length,
        blocks: (await tx.query("select 1 from public.schedule_exceptions where professional_id = $1", [p.proA1])).rows.length,
        incidents: (await tx.query("select 1 from public.schedule_incidents where professional_id = $1 and status = 'open'", [p.proA1])).rows.length,
        status: (await tx.query<{ status: string }>("select status from public.appointments where id = $1", [CITA])).rows[0].status,
      };
    });
    expect(out).toEqual({ slots: 0, blocks: 1, incidents: 1, status: "confirmed" });
  });

  it("cancela en bloque o individualmente, solo en esa jornada y solo citas propias", async () => {
    await db.exec(`
      insert into public.appointments (id, salon_id, professional_id, client_id, service_id, starts_at, ends_at) values
        ('50000000-0000-4000-8000-0000000000c3', '${salons.a}', '${p.proA1}', '${c.clienteA1}', '${s.corteA1}', '${AT("11:00")}', '${AT("11:30")}');
    `);
    const single = await asUser(db, users.ownerA, async (tx) => {
      const r = await tx.query<{ n: number }>("select public.cancel_my_day_appointments($1, $2, $3, 'Imprevisto') as n", [p.proA1, DAY, [CITA]]);
      return r.rows[0].n;
    });
    expect(single).toBe(1);
    const all = await asUser(db, users.ownerA, async (tx) => {
      const r = await tx.query<{ n: number }>("select public.cancel_my_day_appointments($1, $2, null, 'Imprevisto') as n", [p.proA1, DAY]);
      const other = await tx.query<{ status: string }>("select status from public.appointments where id = $1", [a.citaA1]);
      return { n: r.rows[0].n, other: other.rows[0].status };
    });
    expect(all).toEqual({ n: 2, other: "confirmed" });
    await expect(
      asUser(db, users.userA2, (tx) => tx.query("select public.cancel_my_day_appointments($1, $2)", [p.proA1, DAY])),
    ).rejects.toThrow(/FORBIDDEN/);
  });
});

describe("Reprogramación propuesta", () => {
  const propose = (tx: Transaction, start = AT("10:00")) =>
    tx.query<{ id: string }>("select public.propose_reschedule($1, $2, 'Lo siento') as id", [CITA, start]);

  it("no cambia la cita hasta que el cliente acepta; entonces se aplica y se avisa", async () => {
    await db.transaction(async (tx) => {
      await tx.query("select set_config('request.jwt.claims', $1, true)", [JSON.stringify({ sub: users.ownerA })]);
      await tx.exec("set local role authenticated");
      await propose(tx);
    });
    expect((await db.query<{ starts: string }>("select starts_at::text as starts from public.appointments where id = $1", [CITA])).rows[0].starts).toContain("09:00");
    expect(await templates(db)).toContain("change.reschedule_proposed");

    const result = await asServer(async (tx) => {
      const view = await tx.query<{ v: { proposal: { type: string } } }>("select public.get_appointment_for_client($1) as v", [CITA]);
      expect(view.rows[0].v.proposal.type).toBe("reschedule");
      const r = await tx.query<{ r: string }>("select public.respond_change_request_as_client($1, true) as r", [CITA]);
      const appt = await tx.query<{ iso: string }>("select to_char(starts_at at time zone 'UTC', 'HH24:MI') as iso from public.appointments where id = $1", [CITA]);
      const events = await tx.query<{ actor_kind: string }>("select actor_kind from public.appointment_events where appointment_id = $1 and event_type = 'rescheduled'", [CITA]);
      return { r: r.rows[0].r, at: appt.rows[0].iso, actor: events.rows[0].actor_kind, sms: await templates(tx) };
    });
    expect(result).toMatchObject({ r: "applied", at: "10:00", actor: "client" });
    expect(result.sms).toContain("appointment.rescheduled");
  });

  it("si el cliente rechaza, la cita sigue igual", async () => {
    await db.transaction(async (tx) => {
      await tx.query("select set_config('request.jwt.claims', $1, true)", [JSON.stringify({ sub: users.ownerA })]);
      await tx.exec("set local role authenticated");
      await propose(tx);
    });
    const r = await asServer(async (tx) => (await tx.query<{ r: string }>("select public.respond_change_request_as_client($1, false) as r", [CITA])).rows[0].r);
    expect(r).toBe("rejected");
  });

  it("valida el hueco, una sola propuesta abierta y solo citas propias", async () => {
    await expect(asUser(db, users.ownerA, (tx) => propose(tx, AT("14:00")))).rejects.toThrow(/OUTSIDE_SCHEDULE/);
    await expect(asUser(db, users.userA2, (tx) => propose(tx))).rejects.toThrow(/NOT_FOUND/);
    await asUser(db, users.ownerA, async (tx) => {
      await propose(tx);
      await expect(propose(tx, AT("11:00"))).rejects.toThrow(/REQUEST_ALREADY_OPEN/);
    });
  });

  it("cancelar la cita anula la propuesta y su SMS pendiente", async () => {
    const out = await asUser(db, users.ownerA, async (tx) => {
      await propose(tx);
      await tx.query("select public.set_my_appointment_status($1, 'cancelled')", [CITA]);
      const req = await tx.query<{ status: string }>("select status from public.appointment_change_requests where appointment_id = $1", [CITA]);
      return { req: req.rows[0].status, sms: await templates(tx) };
    });
    expect(out.req).toBe("cancelled");
    expect(out.sms).not.toContain("change.reschedule_proposed");
  });
});

describe("Reasignación", () => {
  /** Ejecuta como usuario y confirma los cambios. */
  const commit = async <T extends Record<string, unknown>>(userId: string, sql: string, params: unknown[] = []) =>
    db.transaction(async (tx) => {
      await tx.query("select set_config('request.jwt.claims', $1, true)", [JSON.stringify({ sub: userId })]);
      await tx.exec("set local role authenticated");
      return (await tx.query<T>(sql, params)).rows;
    });

  const request = async () =>
    (await commit<{ id: string }>(users.ownerA, "select public.request_reassignment($1, $2, 'Hoy no puedo') as id", [CITA, p.proA2]))[0].id;

  it("flujo completo: solicitud → receptor → cliente → la cita pasa de agenda", async () => {
    const id = await request();
    // Sin aceptar, la cita sigue en la agenda original y no hay SMS de propuesta.
    expect(await templates(db)).not.toContain("change.reassignment_proposed");

    const incoming = await commit<Record<string, unknown>>(users.userA2, "select * from public.my_incoming_reassignments()");
    expect(incoming).toHaveLength(1);
    expect(incoming[0]).toMatchObject({ request_id: id, service_name: "Corte clásico", requester_name: "Carlos", price_cents: 1500 });
    // El receptor nunca recibe datos del cliente.
    expect(JSON.stringify(incoming[0])).not.toContain("Cliente de Carlos");
    expect(JSON.stringify(incoming[0])).not.toContain("+34611111111");
    const hidden = await asUser(db, users.userA2, (tx) => tx.query("select 1 from public.appointments where id = $1", [CITA]));
    expect(hidden.rows).toHaveLength(0);

    await commit(users.userA2, "select public.respond_my_reassignment($1, true, $2)", [id, s.corteA2]);
    expect(await templates(db)).toContain("change.reassignment_proposed");
    const payload = await db.query<{ payload: Record<string, unknown> }>("select payload from public.notifications where template = 'change.reassignment_proposed'");
    expect(payload.rows[0].payload).toMatchObject({ target_name: "Javier", proposed_service_name: "Corte + barba", proposed_price_cents: 2200 });

    const view = await asServer(async (tx) => (await tx.query<{ v: { proposal: Record<string, unknown> } }>("select public.get_appointment_for_client($1) as v", [CITA])).rows[0].v);
    expect(view.proposal).toMatchObject({ type: "reassignment", target_name: "Javier", service_name: "Corte + barba", price_cents: 2200 });

    await db.query("select public.respond_change_request_as_client($1, true)", [CITA]);
    const moved = await db.query<Record<string, unknown>>(
      `select a.professional_id, a.service_name, a.price_cents, cl.professional_id as client_owner, cl.full_name, cl.notes,
              (a.ends_at - a.starts_at) = interval '45 minutes' as duration_ok,
              (select status from public.appointment_change_requests r where r.appointment_id = a.id) as request
       from public.appointments a join public.clients cl on cl.id = a.client_id where a.id = $1`,
      [CITA],
    );
    // Reutiliza el cliente de Javier con ese teléfono: sus notas privadas no se mezclan.
    expect(moved.rows[0]).toEqual({
      professional_id: p.proA2,
      service_name: "Corte + barba",
      price_cents: 2200,
      client_owner: p.proA2,
      full_name: "Cliente de Javier",
      notes: "Nota privada",
      duration_ok: true,
      request: "applied",
    });
    expect(await templates(db)).toContain("appointment.reassigned");
    // Las notas del cliente original nunca viajan a la otra cartera.
    const original = await db.query<{ notes: string }>("select notes from public.clients where id = $1", [c.clienteA1]);
    expect(original.rows[0].notes).toBe("Alergia a tintes");
  });

  it("copia solo nombre y teléfono si el receptor no tenía a ese cliente", async () => {
    await db.exec(`update public.clients set phone = '+34699000999' where id = '${c.clienteA2}'`);
    const id = await request();
    await commit(users.userA2, "select public.respond_my_reassignment($1, true, $2)", [id, s.corteA2]);
    await db.query("select public.respond_change_request_as_client($1, true)", [CITA]);
    const { rows } = await db.query<Record<string, unknown>>(
      "select cl.full_name, cl.phone, cl.notes, cl.email from public.appointments a join public.clients cl on cl.id = a.client_id where a.id = $1",
      [CITA],
    );
    expect(rows[0]).toEqual({ full_name: "Cliente de Carlos", phone: "+34611111111", notes: null, email: null });
  });

  it("el receptor puede rechazar y debe tener disponibilidad suficiente", async () => {
    const id = await request();
    await db.exec(`
      insert into public.appointments (salon_id, professional_id, client_id, service_id, starts_at, ends_at) values
        ('${salons.a}', '${p.proA2}', '${c.clienteA2}', '${s.corteA2}', '${AT("09:15")}', '${AT("10:00")}');
    `);
    await expect(commit(users.userA2, "select public.respond_my_reassignment($1, true, $2)", [id, s.corteA2])).rejects.toThrow(/SLOT_TAKEN/);
    await commit(users.userA2, "select public.respond_my_reassignment($1, false)", [id]);
    const { rows } = await db.query<{ status: string }>("select status from public.appointment_change_requests where id = $1", [id]);
    expect(rows[0].status).toBe("rejected");
  });

  it("solo el receptor responde, con servicios propios, y solo dentro del establecimiento", async () => {
    const id = await request();
    await expect(asUser(db, users.ownerA, (tx) => tx.query("select public.respond_my_reassignment($1, true, $2)", [id, s.corteA1]))).rejects.toThrow(/NOT_FOUND/);
    await expect(asUser(db, users.userA2, (tx) => tx.query("select public.respond_my_reassignment($1, true, $2)", [id, s.corteA1]))).rejects.toThrow(/SERVICE_NOT_FOUND/);
    await commit(users.ownerA, "select public.cancel_my_change_request($1)", [id]);
    await expect(
      asUser(db, users.ownerA, (tx) => tx.query("select public.request_reassignment($1, $2)", [CITA, p.proB1])),
    ).rejects.toThrow(/TARGET_UNAVAILABLE/);
  });

  it("no se pueden insertar solicitudes directamente", async () => {
    await expect(
      asUser(db, users.ownerA, (tx) =>
        tx.query(
          `insert into public.appointment_change_requests (salon_id, appointment_id, type, status, requested_by_professional_id, target_professional_id, proposed_starts_at, proposed_ends_at)
           values ($1, $2, 'reassignment', 'pending_client', $3, $4, $5, $6)`,
          [salons.a, CITA, p.proA1, p.proA2, AT("09:00"), AT("09:30")],
        ),
      ),
    ).rejects.toThrow(/permission denied/);
  });

  it("una propuesta caducada no se aplica", async () => {
    const id = await request();
    await commit(users.userA2, "select public.respond_my_reassignment($1, true, $2)", [id, s.corteA2]);
    await db.query("update public.appointment_change_requests set expires_at = now() - interval '1 minute' where id = $1", [id]);
    const r = await db.query<{ r: string }>("select public.respond_change_request_as_client($1, true) as r", [CITA]);
    expect(r.rows[0].r).toBe("expired");
    const appt = await db.query<{ professional_id: string }>("select professional_id from public.appointments where id = $1", [CITA]);
    expect(appt.rows[0].professional_id).toBe(p.proA1);
  });
});

describe("Acciones del cliente", () => {
  it("cancela su cita futura una vez, queda como acción del cliente y solo el servidor puede hacerlo", async () => {
    await expect(asAnon(db, (tx) => tx.query("select public.cancel_appointment_as_client($1)", [CITA]))).rejects.toThrow(/permission denied/);
    await expect(asAnon(db, (tx) => tx.query("select public.get_appointment_for_client($1)", [CITA]))).rejects.toThrow(/permission denied/);

    const out = await asServer(async (tx) => {
      const first = await tx.query<{ ok: boolean }>("select public.cancel_appointment_as_client($1) as ok", [CITA]);
      const second = await tx.query<{ ok: boolean }>("select public.cancel_appointment_as_client($1) as ok", [CITA]);
      const event = await tx.query<{ actor_kind: string }>("select actor_kind from public.appointment_events where appointment_id = $1 and event_type = 'cancelled'", [CITA]);
      return [first.rows[0].ok, second.rows[0].ok, event.rows[0].actor_kind];
    });
    expect(out).toEqual([true, false, "client"]);
  });

  it("la vista del cliente no incluye notas ni datos de otras personas", async () => {
    const v = await asServer(async (tx) => (await tx.query<{ v: Record<string, unknown> }>("select public.get_appointment_for_client($1) as v", [CITA])).rows[0].v);
    expect(v).toMatchObject({ status: "confirmed", service_name: "Corte clásico", professional_name: "Carlos", proposal: null });
    expect(JSON.stringify(v)).not.toContain("Alergia");
  });
});

describe("Direcciones reservadas", () => {
  it("una peluquería no puede usar una ruta de la aplicación", async () => {
    await expect(db.query("update public.salons set slug = 'cita' where id = $1", [salons.b])).rejects.toThrow(/salons_slug_not_route/);
  });
});
