"use server";

import { redirect } from "next/navigation";
import { safeRedirectPath } from "@/lib/permissions/routes";
import { isSupabaseConfigured } from "@/lib/supabase/env";
import { createClient } from "@/lib/supabase/server";
import { signInSchema, type SignInState } from "./schemas";

export async function signIn(_prev: SignInState, formData: FormData): Promise<SignInState> {
  if (!isSupabaseConfigured()) {
    return { error: "Supabase no está configurado en este entorno. Revisa .env.local." };
  }

  const parsed = signInSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) {
    const fields = parsed.error.flatten().fieldErrors;
    return { fieldErrors: { email: fields.email?.[0], password: fields.password?.[0] } };
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword({
    email: parsed.data.email,
    password: parsed.data.password,
  });
  if (error) {
    // Mensaje genérico: no revelar si el email existe.
    return { error: "Email o contraseña incorrectos." };
  }

  redirect(safeRedirectPath(parsed.data.next));
}
