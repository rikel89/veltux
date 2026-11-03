"use client";

import { useActionState } from "react";
import { Check, LoaderCircle } from "lucide-react";
import { useFormStatus } from "react-dom";
import { Button } from "@/components/ui/button";
import type { FormState } from "@/lib/validations/common";
import { setLicenseQuantity } from "@/modules/licensing/actions";

function Save() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" size="sm" variant="dark" aria-label="Guardar cupo">
      {pending ? <LoaderCircle className="animate-spin" /> : <Check />}
    </Button>
  );
}

export function LicenseQuantityForm({ salonId, quantity, inUse }: { salonId: string; quantity: number; inUse: number }) {
  const [state, action] = useActionState<FormState, FormData>(setLicenseQuantity, {});
  const error = state.fieldErrors?.quantity ?? state.error;

  return (
    <form action={action} className="flex flex-col items-end gap-1">
      <input type="hidden" name="salonId" value={salonId} />
      <div className="flex items-center gap-2">
        <label className="sr-only" htmlFor={`q-${salonId}`}>
          Licencias contratadas
        </label>
        <input
          id={`q-${salonId}`}
          name="quantity"
          type="number"
          inputMode="numeric"
          min={inUse}
          max={500}
          defaultValue={quantity}
          aria-invalid={Boolean(error)}
          className="h-9 w-20 rounded-lg border border-input bg-white px-3 text-sm tabular-nums outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
        />
        <Save />
      </div>
      {error && <p className="text-xs text-destructive">{error}</p>}
      {state.ok && <p className="text-xs font-semibold text-lime-ink">Guardado</p>}
    </form>
  );
}
