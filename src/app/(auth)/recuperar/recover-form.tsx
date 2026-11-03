"use client";

import { useActionState } from "react";
import { FormField } from "@/components/forms/form-field";
import { FormMessage, SubmitButton } from "@/components/forms/form-status";
import type { FormState } from "@/lib/validations/common";
import { requestPasswordReset } from "@/modules/auth/actions";

export function RecoverForm() {
  const [state, action] = useActionState<FormState, FormData>(requestPasswordReset, {});

  if (state.ok) return <FormMessage state={state} />;

  return (
    <form action={action} className="space-y-5" noValidate>
      <FormField
        name="email"
        label="Email"
        type="email"
        autoComplete="email"
        inputMode="email"
        required
        error={state.fieldErrors?.email}
      />
      <FormMessage state={state} />
      <SubmitButton className="w-full text-base">Enviar enlace</SubmitButton>
    </form>
  );
}
