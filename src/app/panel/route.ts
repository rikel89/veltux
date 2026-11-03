import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/supabase/env";
import { getAccess } from "@/modules/auth/access";
import { homePathFor } from "@/modules/auth/access-rules";

/**
 * Punto de entrada tras iniciar sesión: acepta las invitaciones pendientes
 * del usuario y lo envía a su área principal.
 */
export async function GET(request: NextRequest) {
  if (!isSupabaseConfigured()) {
    return NextResponse.redirect(new URL("/profesional", request.nextUrl.origin));
  }

  const supabase = await createClient();
  const { error } = await supabase.rpc("accept_my_invitations");
  if (error) console.error("accept_my_invitations", error.message);

  const access = await getAccess();
  return NextResponse.redirect(new URL(homePathFor(access.areas), request.nextUrl.origin));
}
