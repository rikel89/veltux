/**
 * Arnés de pruebas SQL/RLS sobre PGlite (PostgreSQL compilado a WASM).
 *
 * Reproduce lo mínimo de Supabase que necesitan las migraciones: esquemas
 * `auth` y `extensions`, roles `anon` / `authenticated` / `service_role`,
 * `auth.uid()` basado en los claims del JWT y los privilegios por defecto.
 * Permite ejecutar las migraciones reales y verificar las políticas sin Docker.
 *
 * Las pruebas contra un Supabase local completo (`supabase test db`) se
 * añadirán cuando el entorno Docker esté disponible.
 */
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { PGlite, type Transaction } from "@electric-sql/pglite";
import { btree_gist } from "@electric-sql/pglite/contrib/btree_gist";
import { pgcrypto } from "@electric-sql/pglite/contrib/pgcrypto";

const MIGRATIONS_DIR = join(process.cwd(), "supabase", "migrations");
export const SEED_FILE = join(process.cwd(), "supabase", "seed.sql");

const SUPABASE_STUB = /* sql */ `
  create schema auth;
  create schema extensions;

  create role anon nologin noinherit;
  create role authenticated nologin noinherit;
  create role service_role nologin noinherit bypassrls;

  create extension pgcrypto with schema extensions;

  create table auth.users (
    instance_id uuid,
    id uuid primary key,
    aud text,
    role text,
    email text,
    encrypted_password text,
    email_confirmed_at timestamptz,
    raw_app_meta_data jsonb,
    raw_user_meta_data jsonb not null default '{}'::jsonb,
    confirmation_token text,
    email_change text,
    email_change_token_new text,
    recovery_token text,
    created_at timestamptz default now(),
    updated_at timestamptz default now()
  );

  create table auth.identities (
    id uuid primary key,
    user_id uuid not null references auth.users (id) on delete cascade,
    provider_id text not null,
    identity_data jsonb not null,
    provider text not null,
    last_sign_in_at timestamptz,
    created_at timestamptz,
    updated_at timestamptz
  );

  create function auth.uid() returns uuid language sql stable as $$
    select nullif(
      coalesce(
        current_setting('request.jwt.claim.sub', true),
        nullif(current_setting('request.jwt.claims', true), '')::jsonb ->> 'sub'
      ),
      ''
    )::uuid
  $$;

  grant usage on schema auth, public, extensions to anon, authenticated, service_role;
  grant execute on function auth.uid() to anon, authenticated, service_role;

  alter default privileges in schema public grant all on tables to anon, authenticated, service_role;
  alter default privileges in schema public grant all on sequences to anon, authenticated, service_role;
  alter default privileges in schema public grant all on functions to anon, authenticated, service_role;

  set search_path to public, extensions;
`;

export type Db = PGlite;
export type Role = "anon" | "authenticated" | "service_role";

export async function createTestDatabase(): Promise<Db> {
  const db = await PGlite.create({ extensions: { btree_gist, pgcrypto } });
  await db.exec(SUPABASE_STUB);

  const files = readdirSync(MIGRATIONS_DIR)
    .filter((file) => file.endsWith(".sql"))
    .sort();
  for (const file of files) {
    await db.exec(readFileSync(join(MIGRATIONS_DIR, file), "utf8"));
  }
  return db;
}

/**
 * Ejecuta `fn` dentro de una transacción con el rol y la identidad indicados,
 * igual que PostgREST hace con cada petición. La transacción se revierte
 * siempre para que las pruebas no se contaminen entre sí.
 */
export async function asRole<T>(
  db: Db,
  role: Role,
  userId: string | null,
  fn: (tx: Transaction) => Promise<T>,
): Promise<T> {
  let result: T | undefined;
  let failure: unknown;
  await db
    .transaction(async (tx) => {
      const claims = JSON.stringify(userId ? { sub: userId, role } : { role });
      await tx.query("select set_config('request.jwt.claims', $1, true)", [claims]);
      await tx.exec(`set local role ${role}`);
      try {
        result = await fn(tx);
      } catch (error) {
        failure = error;
      }
      await tx.rollback();
    })
    .catch(() => undefined);
  if (failure) throw failure;
  return result as T;
}

export const asUser = <T>(db: Db, userId: string, fn: (tx: Transaction) => Promise<T>) =>
  asRole(db, "authenticated", userId, fn);

export const asAnon = <T>(db: Db, fn: (tx: Transaction) => Promise<T>) =>
  asRole(db, "anon", null, fn);
