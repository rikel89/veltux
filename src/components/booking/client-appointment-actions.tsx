"use client";

import { useActionState, useState } from "react";
import { FormMessage, SubmitButton } from "@/components/forms/form-status";
import { Button } from "@/components/ui/button";
import type { FormState } from "@/lib/validations/common";
import { cancelAsClient, respondAsClient } from "@/modules/notifications/client-actions";

export function ProposalActions({ token }: { token: string }) {
  const [state, action] = useActionState<FormState, FormData>(respondAsClient, {});
  return (
    <form action={action} className="mt-4 space-y-3">
      <input type="hidden" name="token" value={token} />
      <FormMessage state={state} />
      <div className="grid grid-cols-2 gap-2">
        <Button type="submit" name="decision" value="reject" variant="outline" size="lg" className="h-12 bg-white">
          Rechazar
        </Button>
        <Button type="submit" name="decision" value="accept" size="lg" className="h-12 shadow-lime">
          Aceptar
        </Button>
      </div>
    </form>
  );
}

export function CancelAppointment({ token }: { token: string }) {
  const [confirming, setConfirming] = useState(false);
  const [state, action] = useActionState<FormState, FormData>(cancelAsClient, {});

  if (!confirming) {
    return (
      <Button type="button" variant="ghost" size="lg" className="h-11 w-full text-destructive" onClick={() => setConfirming(true)}>
        Cancelar mi cita
      </Button>
    );
  }
  return (
    <form action={action} className="space-y-3 rounded-xl border border-red-200 bg-red-50 p-4">
      <input type="hidden" name="token" value={token} />
      <p className="text-sm font-semibold text-red-800">¿Seguro que quieres cancelar tu cita?</p>
      <FormMessage state={state} />
      <div className="flex justify-end gap-2">
        <Button type="button" variant="ghost" size="sm" onClick={() => setConfirming(false)}>
          Volver
        </Button>
        <SubmitButton className="h-9 bg-destructive text-white shadow-none">Sí, cancelar</SubmitButton>
      </div>
    </form>
  );
}
