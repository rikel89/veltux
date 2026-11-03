"use client";

import Link from "next/link";
import { useActionState } from "react";
import { useSearchParams } from "next/navigation";
import { FormField } from "@/components/forms/form-field";
import { FormMessage, SubmitButton } from "@/components/forms/form-status";
import { signIn } from "@/modules/auth/actions";
import type { SignInState } from "@/modules/auth/schemas";

const LINK_ERRORS: Record<string, string> = {
  enlace: "El enlace ha caducado o ya se utilizó. Solicita uno nuevo.",
  auth: "No se pudo completar el acceso. Inténtalo de nuevo.",
};

export function LoginForm() {
  const params = useSearchParams();
  const next = params.get("next") ?? "";
  const linkError = LINK_ERRORS[params.get("error") ?? ""];
  const [state, action] = useActionState<SignInState, FormData>(signIn, {});

  return (
    <form action={action} className="space-y-5" noValidate>
      {linkError && !state.error && <FormMessage state={{ error: linkError }} />}
      <input type="hidden" name="next" value={next} />
      <FormField
        name="email"
        label="Email"
        type="email"
        autoComplete="email"
        inputMode="email"
        required
        error={state.fieldErrors?.email}
      />
      <div className="space-y-2">
        <FormField
          name="password"
          label="Contraseña"
          type="password"
          autoComplete="current-password"
          required
          error={state.fieldErrors?.password}
        />
        <div className="text-right">
          <Link href="/recuperar" className="text-xs font-semibold text-lime-ink hover:underline">
            ¿Olvidaste tu contraseña?
          </Link>
        </div>
      </div>
      <FormMessage state={state} />
      <SubmitButton className="w-full text-base">Entrar</SubmitButton>
    </form>
  );
}
