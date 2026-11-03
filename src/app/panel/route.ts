import { NextResponse, type NextRequest } from "next/server";
import { isSupabaseConfigured } from "@/lib/supabase/env";
import { getAccess } from "@/modules/auth/access";
import { homePathFor } from "@/modules/auth/access-rules";

/** Punto de entrada tras iniciar sesión: envía a cada usuario a su área principal. */
export async function GET(request: NextRequest) {
  if (!isSupabaseConfigured()) {
    return NextResponse.redirect(new URL("/profesional", request.nextUrl.origin));
  }
  const access = await getAccess();
  return NextResponse.redirect(new URL(homePathFor(access.areas), request.nextUrl.origin));
}
