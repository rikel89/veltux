import "server-only";
import { cache } from "react";
import { getMyProfessionalContext } from "@/modules/professionals/queries";
import { requireSession } from "./session";

export type ShellIdentity = {
  mode: "demo" | "live";
  displayName: string;
  email: string | null;
  salonName: string | null;
  hasActiveLicense: boolean;
};

/** Identidad mostrada en la estructura del panel (memoizada por petición). */
export const getShellIdentity = cache(async (): Promise<ShellIdentity> => {
  const session = await requireSession();
  if (session.mode === "demo") {
    return {
      mode: "demo",
      displayName: "Carlos Martín",
      email: null,
      salonName: "Barbería Elegance",
      hasActiveLicense: true,
    };
  }

  const ctx = await getMyProfessionalContext(session.supabase, session.user.id);
  return {
    mode: "live",
    displayName: ctx?.displayName ?? session.user.email ?? "Usuario",
    email: session.user.email,
    salonName: ctx?.salonName ?? null,
    hasActiveLicense: ctx?.hasActiveLicense ?? false,
  };
});
