import "server-only";
import { createClient } from "@/lib/supabase/server";
import { requireArea } from "@/modules/auth/access";
import { getMyProfessionalContext, type ProfessionalContext } from "./queries";

export type MyProfessional = {
  supabase: Awaited<ReturnType<typeof createClient>>;
  userId: string;
  ctx: ProfessionalContext | null;
};

/** Sesión de profesional + su ficha. Llamar en cada página y acción del área. */
export async function requireMyProfessional(): Promise<MyProfessional> {
  const access = await requireArea("professional");
  if (!access.userId) throw new Error("Sesión no válida");
  const supabase = await createClient();
  return { supabase, userId: access.userId, ctx: await getMyProfessionalContext(supabase, access.userId) };
}
