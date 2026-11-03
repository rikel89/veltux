"use server";

import { redirect } from "next/navigation";
import { safeRedirectPath } from "@/lib/permissions/routes";
import { isSupabaseConfigured } from "@/lib/supabase/env";
import { createClient } from "@/lib/supabase/server";
import { fieldErrors, type FormState } from "@/lib/validations/common";
import { getSiteUrl } from "@/lib/site";
import { newPasswordSchema, passwordResetRequestSchema, signInSchema, type SignInState } from "./schemas";

const NOT_CONFIGURED = "Supabase no está configurado en este entorno. Revisa .env.local.";

export async function signIn(_prev: SignInState, formData: FormData): Promise<SignInState> {
  if (!isSupabaseConfigured()) return { error: NOT_CONFIGURED };

  const parsed = signInSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { fieldErrors: fieldErrors(parsed.error) };

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword({
    email: parsed.data.email,
    password: parsed.data.password,
  });
  if (error) {
    // Mensaje genérico: no revelar si el email existe.
    return { error: "Email o contraseña incorrectos." };
  }

  redirect(safeRedirectPath(parsed.data.next, "/panel"));
}

/** Envía el email de recuperación. La respuesta es siempre la misma (no revela cuentas). */
export async function requestPasswordReset(_prev: FormState, formData: FormData): Promise<FormState> {
  if (!isSupabaseConfigured()) return { error: NOT_CONFIGURED };

  const parsed = passwordResetRequestSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { fieldErrors: fieldErrors(parsed.error) };

  const supabase = await createClient();
  const { error } = await supabase.auth.resetPasswordForEmail(parsed.data.email, {
    redirectTo: `${getSiteUrl()}/cuenta/contrasena`,
  });
  if (error?.status === 429) {
    return { error: "Has solicitado demasiados correos. Espera unos minutos e inténtalo de nuevo." };
  }

  return {
    ok: true,
    message: "Si el email pertenece a una cuenta de VELTUX, recibirás un enlace para crear una nueva contraseña.",
  };
}

/** Fija la contraseña del usuario con sesión (invitación aceptada, recuperación o cambio). */
export async function updatePassword(_prev: FormState, formData: FormData): Promise<FormState> {
  if (!isSupabaseConfigured()) return { error: NOT_CONFIGURED };

  const parsed = newPasswordSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { fieldErrors: fieldErrors(parsed.error) };

  const supabase = await createClient();
  const { data: claims } = await supabase.auth.getClaims();
  if (!claims?.claims?.sub) {
    return { error: "El enlace ha caducado o ya se usó. Solicita uno nuevo desde «¿Olvidaste tu contraseña?»." };
  }

  const { error } = await supabase.auth.updateUser({ password: parsed.data.password });
  if (error) {
    if (error.code === "same_password") return { fieldErrors: { password: "Debe ser distinta de la actual" } };
    if (error.code === "weak_password") return { fieldErrors: { password: "Contraseña demasiado débil" } };
    return { error: "No se pudo actualizar la contraseña. Inténtalo de nuevo." };
  }

  // Desde Configuración se queda en la página; desde un enlace de email, entra al panel.
  if (formData.get("stay") === "1") return { ok: true, message: "Contraseña actualizada." };
  redirect("/panel");
}
