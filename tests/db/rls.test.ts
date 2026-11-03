import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { asAnon, asRole, asUser, createTestDatabase, type Db } from "./harness";
import { ids, seedScenario } from "./fixtures";

const { users, salons, professionals: p, services: s, clients: c, appointments: a } = ids;

let db: Db;

beforeAll(async () => {
  db = await createTestDatabase();
  await seedScenario(db);
}, 60_000);

afterAll(async () => {
  await db?.close();
});

describe("Aislamiento de carteras de clientes", () => {
  it("un profesional solo ve sus propios clientes", async () => {
    const rows = await asUser(db, users.userA2, (tx) =>
      tx.query<{ id: string }>("select id from public.clients"),
    );
    expect(rows.rows.map((r) => r.id)).toEqual([c.clienteA2]);
  });

  it("la misma persona puede existir en dos carteras sin compartir notas", async () => {
    const rows = await asUser(db, users.ownerA, (tx) =>
      tx.query<{ notes: string }>("select notes from public.clients where phone = '+34611111111'"),
    );
    expect(rows.rows).toEqual([{ notes: "Alergia a tintes" }]);
  });

  it("un profesional no puede crear clientes en la cartera de otro", async () => {
    await expect(
      asUser(db, users.userA2, (tx) =>
        tx.query(
          `insert into public.clients (salon_id, professional_id, full_name, phone)
           values ($1, $2, 'Intruso', '+34699999999')`,
          [salons.a, p.proA1],
        ),
      ),
    ).rejects.toThrow(/row-level security/);
  });

  it("el propietario no lee la cartera privada de otro autónomo", async () => {
    const rows = await asUser(db, users.ownerA, (tx) =>
      tx.query<{ id: string }>("select id from public.clients where professional_id = $1", [p.proA2]),
    );
    expect(rows.rows).toHaveLength(0);
  });

  it("ni siquiera un administrador de plataforma lee fichas de clientes", async () => {
    const rows = await asUser(db, users.admin, (tx) => tx.query("select id from public.clients"));
    expect(rows.rows).toHaveLength(0);
  });
});

describe("Citas", () => {
  it("un profesional no puede modificar citas ajenas", async () => {
    const result = await asUser(db, users.userA2, (tx) =>
      tx.query("update public.appointments set notes = 'hackeado' where id = $1", [a.citaA1]),
    );
    expect(result.affectedRows).toBe(0);
  });

  it("un profesional no puede mover una cita a la agenda de otro", async () => {
    await expect(
      asUser(db, users.userA2, (tx) =>
        tx.query("update public.appointments set professional_id = $1 where id = $2", [p.proA1, a.citaA2]),
      ),
    ).rejects.toThrow(/permission denied/);
  });

  it("un profesional no puede crear citas en la agenda de otro", async () => {
    await expect(
      asUser(db, users.userA2, (tx) =>
        tx.query(
          `insert into public.appointments (salon_id, professional_id, client_id, service_id, starts_at, ends_at)
           values ($1, $2, $3, $4, '2026-12-02 10:00+00', '2026-12-02 10:30+00')`,
          [salons.a, p.proA1, c.clienteA1, s.corteA1],
        ),
      ),
    ).rejects.toThrow(/permission denied/);
  });

  it("el propietario no consulta directamente las citas de otros profesionales", async () => {
    const rows = await asUser(db, users.ownerA, (tx) =>
      tx.query<{ id: string }>("select id from public.appointments"),
    );
    expect(rows.rows.map((r) => r.id)).toEqual([a.citaA1]);
  });

  it("el propietario consulta la ocupación sin datos de cliente", async () => {
    const result = await asUser(db, users.ownerA, (tx) =>
      tx.query<Record<string, unknown>>(
        "select * from public.get_salon_occupancy($1, '2026-12-01', '2026-12-02')",
        [salons.a],
      ),
    );
    expect(result.rows).toHaveLength(2);
    expect(Object.keys(result.rows[0]).sort()).toEqual(["ends_at", "professional_id", "starts_at"]);
  });

  it("un profesional no propietario no puede consultar la ocupación del salón", async () => {
    await expect(
      asUser(db, users.userA2, (tx) =>
        tx.query("select * from public.get_salon_occupancy($1, '2026-12-01', '2026-12-02')", [salons.a]),
      ),
    ).rejects.toThrow(/FORBIDDEN/);
  });

  it("el propietario no consulta la ocupación de otra peluquería", async () => {
    await expect(
      asUser(db, users.ownerA, (tx) =>
        tx.query("select * from public.get_salon_occupancy($1, '2026-12-01', '2026-12-02')", [salons.b]),
      ),
    ).rejects.toThrow(/FORBIDDEN/);
  });
});

describe("Motor de reservas · integridad en PostgreSQL", () => {
  // Las restricciones se comprueban con escritura directa como service_role (la app solo escribe con funciones).
  const insertCita = (start: string, end: string, extra = "") =>
    asRole(db, "service_role", null, (tx) =>
      tx.query(
        `insert into public.appointments (salon_id, professional_id, client_id, service_id, starts_at, ends_at ${extra ? ", status, cancelled_at" : ""})
         values ($1, $2, $3, $4, $5, $6 ${extra})`,
        [salons.a, p.proA1, c.clienteA1, s.corteA1, start, end],
      ),
    );

  it("rechaza dos citas activas solapadas del mismo profesional", async () => {
    await expect(insertCita("2026-12-01 09:15+00", "2026-12-01 09:45+00")).rejects.toThrow(
      /appointments_no_overlap/,
    );
  });

  it("permite una cita contigua (intervalo semiabierto)", async () => {
    await expect(insertCita("2026-12-01 09:30+00", "2026-12-01 10:00+00")).resolves.toBeDefined();
  });

  it("una cita cancelada no bloquea el hueco", async () => {
    await expect(
      insertCita("2026-12-01 09:00+00", "2026-12-01 09:30+00", ", 'cancelled', now()"),
    ).resolves.toBeDefined();
  });

  it("profesionales distintos pueden coincidir en horario", async () => {
    // citaA1 (Carlos) y citaA2 (Javier) comparten 09:00 en el escenario base.
    const rows = await db.query("select count(*)::int as n from public.appointments where starts_at = '2026-12-01 09:00+00'");
    expect(rows.rows).toEqual([{ n: 2 }]);
  });

  it("no permite reservar un servicio de otro profesional", async () => {
    await expect(
      asRole(db, "service_role", null, (tx) =>
        tx.query(
          `insert into public.appointments (salon_id, professional_id, client_id, service_id, starts_at, ends_at)
           values ($1, $2, $3, $4, '2026-12-03 10:00+00', '2026-12-03 10:30+00')`,
          [salons.a, p.proA1, c.clienteA1, s.corteA2],
        ),
      ),
    ).rejects.toThrow(/foreign key/);
  });

  it("guarda una copia del precio del servicio en la cita", async () => {
    const rows = await db.query<{ service_name: string; price_cents: number }>(
      "select service_name, price_cents from public.appointments where id = $1",
      [a.citaA2],
    );
    expect(rows.rows[0]).toEqual({ service_name: "Corte + barba", price_cents: 2200 });
  });

  it("registra los cambios en appointment_events", async () => {
    const events = await asUser(db, users.ownerA, async (tx) => {
      await tx.query("select public.set_my_appointment_status($1, 'cancelled', 'Imprevisto')", [a.citaA1]);
      return tx.query<{ event_type: string; actor_user_id: string | null }>(
        "select event_type, actor_user_id from public.appointment_events where appointment_id = $1 order by created_at",
        [a.citaA1],
      );
    });
    expect(events.rows.map((e) => e.event_type)).toEqual(["created", "cancelled"]);
    expect(events.rows[1].actor_user_id).toBe(users.ownerA);
  });
});

describe("Aislamiento entre peluquerías", () => {
  it("un usuario no ve salones ni profesionales de otra peluquería", async () => {
    const { salonsRows, prosRows } = await asUser(db, users.userB1, async (tx) => ({
      salonsRows: (await tx.query<{ id: string }>("select id from public.salons")).rows,
      prosRows: (await tx.query<{ id: string }>("select id from public.professionals")).rows,
    }));
    expect(salonsRows.map((r) => r.id)).toEqual([salons.b]);
    expect(prosRows.map((r) => r.id)).toEqual([p.proB1]);
  });

  it("los servicios de otra peluquería no son visibles", async () => {
    const rows = await asUser(db, users.userB1, (tx) => tx.query<{ id: string }>("select id from public.services"));
    expect(rows.rows.map((r) => r.id)).toEqual([s.corteB1]);
  });
});

describe("Licencias", () => {
  it("impide superar las licencias contratadas", async () => {
    const nuevo = "20000000-0000-4000-8000-0000000000b2";
    await expect(
      asUser(db, users.userB1, async (tx) => {
        await tx.query(
          `insert into public.professionals (id, salon_id, display_name, slug)
           values ($1, $2, 'Nuevo', 'nuevo')`,
          [nuevo, salons.b],
        );
        await tx.query("insert into public.license_assignments (salon_id, professional_id) values ($1, $2)", [
          salons.b,
          nuevo,
        ]);
      }),
    ).rejects.toThrow(/LICENSE_LIMIT_REACHED/);
  });

  it("un profesional no puede asignarse licencias", async () => {
    await expect(
      asUser(db, users.userA2, (tx) =>
        tx.query("insert into public.license_assignments (salon_id, professional_id) values ($1, $2)", [
          salons.a,
          p.proA2,
        ]),
      ),
    ).rejects.toThrow(/FORBIDDEN/);
  });

  it("revocar una licencia queda en el historial y en auditoría", async () => {
    const audit = await asUser(db, users.ownerA, async (tx) => {
      await tx.query(
        "update public.license_assignments set revoked_at = now(), revoke_reason = 'Baja' where professional_id = $1",
        [p.proA2],
      );
      return tx.query<{ action: string }>(
        "select action from public.audit_logs where entity_type = 'license_assignment' order by id desc limit 1",
      );
    });
    expect(audit.rows[0].action).toBe("license.revoked");
  });

  it("un profesional sin licencia activa no puede recibir citas", async () => {
    await expect(
      db.transaction(async (tx) => {
        await tx.query("update public.license_assignments set revoked_at = now() where professional_id = $1", [p.proA2]);
        await tx.query(
          `insert into public.appointments (salon_id, professional_id, client_id, service_id, starts_at, ends_at)
           values ($1, $2, $3, $4, '2026-12-05 10:00+00', '2026-12-05 10:45+00')`,
          [salons.a, p.proA2, c.clienteA2, s.corteA2],
        );
      }),
    ).rejects.toThrow(/PROFESSIONAL_WITHOUT_LICENSE/);
  });
});

describe("Escalada de privilegios", () => {
  it("un usuario no puede convertirse en administrador de plataforma", async () => {
    await expect(
      asUser(db, users.userA2, (tx) =>
        tx.query("update public.profiles set platform_role = 'admin' where id = $1", [users.userA2]),
      ),
    ).rejects.toThrow(/permission denied/);
  });

  it("un profesional no puede cambiar su propio estado", async () => {
    await expect(
      asUser(db, users.userA2, (tx) =>
        tx.query("update public.professionals set status = 'inactive' where id = $1", [p.proA2]),
      ),
    ).rejects.toThrow(/FORBIDDEN_STATUS_CHANGE/);
  });

  it("el propietario no puede vincular a otro usuario como profesional", async () => {
    await expect(
      asUser(db, users.ownerA, (tx) =>
        tx.query(
          `insert into public.professionals (salon_id, user_id, display_name, slug)
           values ($1, $2, 'Secuestrado', 'secuestrado')`,
          [salons.a, users.userB1],
        ),
      ),
    ).rejects.toThrow(/row-level security/);
  });

  it("la cola de notificaciones solo la procesa el backend", async () => {
    await expect(
      asUser(db, users.ownerA, (tx) => tx.query("select * from public.claim_pending_notifications(10)")),
    ).rejects.toThrow(/permission denied/);
  });
});

describe("Portal público (anónimo)", () => {
  it("no puede leer tablas directamente", async () => {
    await expect(asAnon(db, (tx) => tx.query("select * from public.clients"))).rejects.toThrow(
      /permission denied/,
    );
    await expect(asAnon(db, (tx) => tx.query("select * from public.appointments"))).rejects.toThrow(
      /permission denied/,
    );
  });

  it("obtiene la ficha pública del salón sin datos privados", async () => {
    const result = await asAnon(db, (tx) =>
      tx.query<{ data: Record<string, unknown> }>("select public.get_public_salon('Barberia-Elegance') as data"),
    );
    const data = result.rows[0].data;
    expect(data.name).toBe("Barbería Elegance");
    const json = JSON.stringify(data);
    expect(json).not.toContain("+346"); // teléfonos de profesionales y clientes
    expect(json).not.toContain("Cliente de");
    expect(json).not.toContain("Alergia");
    const pros = data.professionals as Array<{ display_name: string; services: unknown[] }>;
    expect(pros.map((x) => x.display_name)).toEqual(["Carlos", "Javier"]);
    expect(pros[0].services).toHaveLength(1);
  });

  it("devuelve null para salones inexistentes", async () => {
    const result = await asAnon(db, (tx) =>
      tx.query<{ data: unknown }>("select public.get_public_salon('no-existe') as data"),
    );
    expect(result.rows[0].data).toBeNull();
  });
});
