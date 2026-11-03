import type { Db } from "./harness";

/**
 * Escenario multi-tenant de referencia:
 *
 *  Salón A (barberia-elegance) · 2 licencias contratadas
 *    · ownerA → propietario y profesional (proA1)
 *    · userA2 → profesional autónomo (proA2)
 *  Salón B (barberia-norte) · 1 licencia contratada
 *    · userB1 → propietario y profesional (proB1)
 */
export const ids = {
  users: {
    ownerA: "00000000-0000-4000-8000-0000000000a1",
    userA2: "00000000-0000-4000-8000-0000000000a2",
    userB1: "00000000-0000-4000-8000-0000000000b1",
    admin: "00000000-0000-4000-8000-0000000000ad",
  },
  salons: {
    a: "10000000-0000-4000-8000-00000000000a",
    b: "10000000-0000-4000-8000-00000000000b",
  },
  professionals: {
    proA1: "20000000-0000-4000-8000-0000000000a1",
    proA2: "20000000-0000-4000-8000-0000000000a2",
    proB1: "20000000-0000-4000-8000-0000000000b1",
  },
  services: {
    corteA1: "30000000-0000-4000-8000-0000000000a1",
    corteA2: "30000000-0000-4000-8000-0000000000a2",
    corteB1: "30000000-0000-4000-8000-0000000000b1",
  },
  clients: {
    clienteA1: "40000000-0000-4000-8000-0000000000a1",
    clienteA2: "40000000-0000-4000-8000-0000000000a2",
    clienteB1: "40000000-0000-4000-8000-0000000000b1",
  },
  appointments: {
    citaA1: "50000000-0000-4000-8000-0000000000a1",
    citaA2: "50000000-0000-4000-8000-0000000000a2",
  },
} as const;

export async function seedScenario(db: Db) {
  const { users, salons, professionals: p, services: s, clients: c, appointments: a } = ids;

  await db.exec(/* sql */ `
    insert into auth.users (id, email, raw_user_meta_data) values
      ('${users.ownerA}', 'owner.a@veltux.test', '{"full_name":"Carlos Dueño"}'),
      ('${users.userA2}', 'pro.a2@veltux.test',  '{"full_name":"Javier Autónomo"}'),
      ('${users.userB1}', 'owner.b@veltux.test', '{"full_name":"Lucía Norte"}'),
      ('${users.admin}',  'admin@veltux.test',   '{"full_name":"Admin VELTUX"}');

    update public.profiles set platform_role = 'admin' where id = '${users.admin}';

    insert into public.salons (id, slug, name, phone, city) values
      ('${salons.a}', 'barberia-elegance', 'Barbería Elegance', '+34911111111', 'Madrid'),
      ('${salons.b}', 'barberia-norte',    'Barbería Norte',    '+34922222222', 'Bilbao');

    insert into public.subscriptions (salon_id, status, license_quantity) values
      ('${salons.a}', 'trialing', 2),
      ('${salons.b}', 'active', 1);

    insert into public.salon_memberships (salon_id, user_id, role) values
      ('${salons.a}', '${users.ownerA}', 'owner'),
      ('${salons.a}', '${users.ownerA}', 'professional'),
      ('${salons.a}', '${users.userA2}', 'professional'),
      ('${salons.b}', '${users.userB1}', 'owner'),
      ('${salons.b}', '${users.userB1}', 'professional');

    insert into public.professionals (id, salon_id, user_id, display_name, slug, phone, status) values
      ('${p.proA1}', '${salons.a}', '${users.ownerA}', 'Carlos', 'carlos', '+34600000001', 'active'),
      ('${p.proA2}', '${salons.a}', '${users.userA2}', 'Javier', 'javier', '+34600000002', 'active'),
      ('${p.proB1}', '${salons.b}', '${users.userB1}', 'Lucía',  'lucia',  '+34600000003', 'active');

    -- Las pruebas usan fechas de 2027: horizonte de reserva de un año.
    update public.professionals set booking_horizon_days = 365;

    insert into public.license_assignments (salon_id, professional_id, assigned_by) values
      ('${salons.a}', '${p.proA1}', '${users.ownerA}'),
      ('${salons.a}', '${p.proA2}', '${users.ownerA}'),
      ('${salons.b}', '${p.proB1}', '${users.userB1}');

    insert into public.services (id, salon_id, professional_id, name, duration_minutes, price_cents) values
      ('${s.corteA1}', '${salons.a}', '${p.proA1}', 'Corte clásico', 30, 1500),
      ('${s.corteA2}', '${salons.a}', '${p.proA2}', 'Corte + barba', 45, 2200),
      ('${s.corteB1}', '${salons.b}', '${p.proB1}', 'Corte mujer',   60, 3000);

    insert into public.clients (id, salon_id, professional_id, full_name, phone, notes) values
      ('${c.clienteA1}', '${salons.a}', '${p.proA1}', 'Cliente de Carlos', '+34611111111', 'Alergia a tintes'),
      ('${c.clienteA2}', '${salons.a}', '${p.proA2}', 'Cliente de Javier', '+34611111111', 'Nota privada'),
      ('${c.clienteB1}', '${salons.b}', '${p.proB1}', 'Cliente de Lucía',  '+34633333333', null);

    insert into public.appointments (id, salon_id, professional_id, client_id, service_id, starts_at, ends_at) values
      ('${a.citaA1}', '${salons.a}', '${p.proA1}', '${c.clienteA1}', '${s.corteA1}',
       '2026-12-01 09:00+00', '2026-12-01 09:30+00'),
      ('${a.citaA2}', '${salons.a}', '${p.proA2}', '${c.clienteA2}', '${s.corteA2}',
       '2026-12-01 09:00+00', '2026-12-01 09:45+00');
  `);
}
