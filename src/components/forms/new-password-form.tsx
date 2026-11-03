"use client";

import { useActionState } from "react";
import type { FormState } from "@/lib/validations/common";
import { updatePassword } from "@/modules/auth/actions";
import { FormField } from "./form-field";
import { FormMessage, SubmitButton } from "./form-status";

/** Fijar contraseña. `stay`: permanecer en la página al terminar (cambio desde Configuración). */
export function NewPasswordForm({ submitLabel, stay = false }: { submitLabel: string; stay?: boolean }) {
  const [state, action] = useActionState<FormState, FormData>(updatePassword, {});

  return (
    <form action={action} className="space-y-5" noValidate>
      {stay && <input type="hidden" name="stay" value="1" />}
      <FormField
        name="password"
        label="Nueva contraseña"
        type="password"
        autoComplete="new-password"
        required
        hint={stay ? "Mínimo 8 caracteres, con al menos una letra y un número." : undefined}
        error={state.fieldErrors?.password}
      />
      <FormField
        name="confirm"
        label="Repite la contraseña"
        type="password"
        autoComplete="new-password"
        required
        error={state.fieldErrors?.confirm}
      />
      <FormMessage state={state} />
      <SubmitButton className={stay ? "w-full sm:w-auto" : "w-full text-base"}>{submitLabel}</SubmitButton>
    </form>
  );
}
