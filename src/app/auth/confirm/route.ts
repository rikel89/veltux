import { NextResponse, type NextRequest } from "next/server";
import { safeRedirectPath } from "@/lib/permissions/routes";
import { createClient } from "@/lib/supabase/server";
import { emailOtpTypeSchema } from "@/modules/auth/schemas";

/**
 * Verifica los enlaces de email de Supabase Auth (invitación, recuperación,
 * confirmación) con token_hash en el servidor y crea la sesión en cookies.
 * Requiere las plantillas de supabase/templates (ver README).
 */
export async function GET(request: NextRequest) {
  const { searchParams, origin } = request.nextUrl;
  const tokenHash = searchParams.get("token_hash");
  const type = emailOtpTypeSchema.safeParse(searchParams.get("type"));
  const fallback = type.success && (type.data === "invite" || type.data === "recovery") ? "/cuenta/contrasena" : "/panel";
  const next = safeRedirectPath(searchParams.get("next"), fallback);

  if (tokenHash && type.success) {
    const supabase = await createClient();
    const { error } = await supabase.auth.verifyOtp({ type: type.data, token_hash: tokenHash });
    if (!error) return NextResponse.redirect(new URL(next, origin));
  }

  return NextResponse.redirect(new URL("/login?error=enlace", origin));
}
