import "server-only";
import { cache } from "react";
import { getMyProfessionalContext } from "@/modules/professionals/queries";
import { getAccess, ownerSalon } from "./access";
import type { Area } from "./access-rules";
import { requireSession } from "./session";

export type ShellIdentity = {
  mode: "demo" | "live";
  displayName: string;
  email: string | null;
  /** Bloque superior del sidebar: establecimiento o plataforma. */
  contextCaption: string;
  contextLabel: string;
  badge: { tone: "ok" | "warn"; label: string } | null;
  areas: Area[];
};

/** Identidad mostrada en la estructura del panel (memoizada por petición y área). */
export const getShellIdentity = cache(async (area: Area): Promise<ShellIdentity> => {
  const session = await requireSession();
  if (session.mode === "demo") {
    return {
      mode: "demo",
      displayName: "Carlos Martín",
      email: null,
      contextCaption: "Establecimiento",
      contextLabel: "Barbería Elegance",
      badge: { tone: "ok", label: "Licencia activa" },
      areas: ["professional"],
    };
  }

  const access = await getAccess();
  const { data: profile } = await session.supabase
    .from("profiles")
    .select("full_name")
    .eq("id", session.user.id)
    .maybeSingle();
  const fallbackName = profile?.full_name || session.user.email || "Usuario";
  const base = { mode: "live" as const, email: session.user.email, areas: access.areas };

  if (area === "professional") {
    const ctx = await getMyProfessionalContext(session.supabase, session.user.id);
    return {
      ...base,
      displayName: ctx?.displayName ?? fallbackName,
      contextCaption: "Establecimiento",
      contextLabel: ctx?.salonName ?? "Sin establecimiento",
      badge: ctx?.hasActiveLicense
        ? { tone: "ok", label: "Licencia activa" }
        : { tone: "warn", label: "Sin licencia asignada" },
    };
  }

  if (area === "owner") {
    const salon = ownerSalon(access);
    return {
      ...base,
      displayName: fallbackName,
      contextCaption: "Propietario de",
      contextLabel: salon?.salonName ?? "Sin establecimiento",
      badge: salon?.salonStatus === "trial" ? { tone: "ok", label: "Piloto · periodo de prueba" } : null,
    };
  }

  return {
    ...base,
    displayName: fallbackName,
    contextCaption: "Plataforma",
    contextLabel: "VELTUX",
    badge: { tone: "ok", label: "Administrador" },
  };
});
