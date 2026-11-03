/**
 * Reglas puras de acceso por área (sin dependencias de servidor: testeables).
 * La autorización real la impone PostgreSQL; esto decide navegación y vistas.
 */

export type Area = "professional" | "owner" | "admin";

export type Membership = {
  salonId: string;
  salonName: string;
  salonSlug: string;
  salonStatus: string;
  role: "owner" | "professional";
};

export type AccessFacts = { isPlatformAdmin: boolean; memberships: Membership[] };

export const AREA_HOME: Record<Area, string> = {
  professional: "/profesional",
  owner: "/propietario",
  admin: "/admin",
};

export const AREA_LABEL: Record<Area, string> = {
  professional: "Mi agenda",
  owner: "Mi establecimiento",
  admin: "Administración VELTUX",
};

/** Áreas disponibles, en orden de prioridad para la página de inicio. */
export function areasFor(facts: AccessFacts): Area[] {
  const areas: Area[] = [];
  if (facts.memberships.some((m) => m.role === "professional")) areas.push("professional");
  if (facts.memberships.some((m) => m.role === "owner")) areas.push("owner");
  if (facts.isPlatformAdmin) areas.push("admin");
  return areas;
}

/** Destino tras iniciar sesión. Quien atiende clientes empieza en su agenda. */
export function homePathFor(areas: Area[]): string {
  return areas.length > 0 ? AREA_HOME[areas[0]] : "/sin-acceso";
}

/** Normaliza la respuesta JSON de public.get_my_access(). */
export function parseAccessPayload(payload: unknown): AccessFacts {
  const p = (payload ?? {}) as {
    is_platform_admin?: boolean;
    memberships?: Array<{ salon_id: string; salon_name: string; salon_slug: string; salon_status: string; role: string }>;
  };
  return {
    isPlatformAdmin: p.is_platform_admin === true,
    memberships: (p.memberships ?? [])
      .filter((m) => m.role === "owner" || m.role === "professional")
      .map((m) => ({
        salonId: m.salon_id,
        salonName: m.salon_name,
        salonSlug: m.salon_slug,
        salonStatus: m.salon_status,
        role: m.role as Membership["role"],
      })),
  };
}
