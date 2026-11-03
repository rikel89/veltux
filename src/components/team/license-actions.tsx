"use client";

import { useActionState, useState } from "react";
import { KeyRound, LoaderCircle, Unlink } from "lucide-react";
import { useFormStatus } from "react-dom";
import { FormSelect } from "@/components/forms/form-field";
import { Button } from "@/components/ui/button";
import type { FormState } from "@/lib/validations/common";
import { assignLicense, revokeLicense } from "@/modules/licensing/actions";
import { REVOKE_REASONS } from "@/modules/licensing/schemas";

function SubmitIcon({ icon }: { icon: React.ReactNode }) {
  const { pending } = useFormStatus();
  return pending ? <LoaderCircle className="animate-spin" /> : <>{icon}</>;
}

export function AssignLicenseButton({ professionalId, disabledReason }: { professionalId: string; disabledReason?: string }) {
  const [state, action] = useActionState<FormState, FormData>(assignLicense, {});
  return (
    <form action={action} className="flex flex-col items-end gap-1">
      <input type="hidden" name="professionalId" value={professionalId} />
      <Button type="submit" size="sm" disabled={Boolean(disabledReason)} title={disabledReason}>
        <SubmitIcon icon={<KeyRound />} /> Asignar
      </Button>
      {(state.error || disabledReason) && (
        <p className="max-w-48 text-right text-xs text-muted-foreground">{state.error ?? disabledReason}</p>
      )}
    </form>
  );
}

/** Liberar una licencia exige un motivo (queda en el historial y en auditoría). */
export function RevokeLicenseForm({ assignmentId, name }: { assignmentId: string; name: string }) {
  const [open, setOpen] = useState(false);
  const [state, action] = useActionState<FormState, FormData>(revokeLicense, {});

  if (!open) {
    return (
      <Button type="button" variant="ghost" size="sm" className="text-muted-foreground" onClick={() => setOpen(true)}>
        <Unlink /> Liberar
      </Button>
    );
  }

  return (
    <form action={action} className="w-full space-y-3 rounded-xl border border-border bg-surface p-3 sm:w-72">
      <input type="hidden" name="assignmentId" value={assignmentId} />
      <p className="text-sm font-semibold">Liberar la licencia de {name}</p>
      <FormSelect
        name="reason"
        label="Motivo"
        options={[{ value: "", label: "Elige un motivo…" }, ...REVOKE_REASONS]}
        defaultValue=""
        error={state.fieldErrors?.reason}
      />
      {state.error && <p className="text-xs font-semibold text-destructive">{state.error}</p>}
      <div className="flex justify-end gap-2">
        <Button type="button" variant="ghost" size="sm" onClick={() => setOpen(false)}>
          Cancelar
        </Button>
        <Button type="submit" variant="dark" size="sm">
          <SubmitIcon icon={<Unlink />} /> Liberar
        </Button>
      </div>
    </form>
  );
}
