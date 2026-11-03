"use client";

import { useActionState } from "react";
import { Archive, ArchiveRestore } from "lucide-react";
import { FormMessage, SubmitButton } from "@/components/forms/form-status";
import type { FormState } from "@/lib/validations/common";
import { setClientArchived } from "@/modules/clients/actions";

export function ArchiveClient({ clientId, archived }: { clientId: string; archived: boolean }) {
  const [state, action] = useActionState<FormState, FormData>(setClientArchived, {});
  return (
    <form action={action} className="space-y-3">
      <input type="hidden" name="clientId" value={clientId} />
      <input type="hidden" name="archive" value={archived ? "false" : "true"} />
      <p className="text-xs text-muted-foreground">
        {archived
          ? "Recupéralo para poder darle citas de nuevo."
          : "Archivar lo oculta de tu cartera y de la agenda. No se borra: su historial se conserva."}
      </p>
      <FormMessage state={state} />
      <SubmitButton className="w-full bg-white text-foreground shadow-none ring-1 ring-border hover:bg-surface">
        {archived ? <ArchiveRestore /> : <Archive />}
        {archived ? "Recuperar cliente" : "Archivar cliente"}
      </SubmitButton>
    </form>
  );
}
