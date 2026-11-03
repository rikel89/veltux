import "server-only";
import { cache } from "react";
import { redirect } from "next/navigation";
import { areasFor, parseAccessPayload, type Area, type Membership } from "./access-rules";
import { requireSession } from "./session";

export type Access = {
  mode: "demo" | "live";
  userId: string | null;
  email: string | null;
  isPlatformAdmin: boolean;
  memberships: Membership[];
  areas: Area[];
};

const DEMO_ACCESS: Access = {
  mode: "demo",
  userId: null,
  email: null,
  isPlatformAdmin: false,
  memberships: [],
  areas: ["professional"],
};

/** Roles del usuario actual (una consulta por petición). */
export const getAccess = cache(async (): Promise<Access> => {
  const session = await requireSession();
  if (session.mode === "demo") return DEMO_ACCESS;

  const { data, error } = await session.supabase.rpc("get_my_access");
  if (error) throw error;
  const facts = parseAccessPayload(data);

  return {
    mode: "live",
    userId: session.user.id,
    email: session.user.email,
    ...facts,
    areas: areasFor(facts),
  };
});

/** Guarda de servidor: sin acceso al área, se redirige a la página de inicio adecuada. */
export async function requireArea(area: Area): Promise<Access> {
  const access = await getAccess();
  if (!access.areas.includes(area)) redirect("/panel");
  return access;
}

/** Establecimiento sobre el que actúa el propietario (el primero, hasta tener selector). */
export function ownerSalon(access: Access): Membership | null {
  return access.memberships.find((m) => m.role === "owner") ?? null;
}
