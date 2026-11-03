import { NextResponse, type NextRequest } from "next/server";
import { safeRedirectPath } from "@/lib/permissions/routes";
import { createClient } from "@/lib/supabase/server";

/** Intercambia el código de Supabase Auth (confirmación de email, magic link, OAuth) por una sesión. */
export async function GET(request: NextRequest) {
  const { searchParams, origin } = request.nextUrl;
  const code = searchParams.get("code");
  const next = safeRedirectPath(searchParams.get("next"));

  if (code) {
    const supabase = await createClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) return NextResponse.redirect(new URL(next, origin));
  }

  return NextResponse.redirect(new URL("/login?error=auth", origin));
}
