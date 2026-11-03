"use client";

import { useActionState, useState } from "react";
import { LoaderCircle, Power, RotateCcw } from "lucide-react";
import { useFormStatus } from "react-dom";
import { Button } from "@/components/ui/button";
import type { FormState } from "@/lib/validations/common";
import { deactivateProfessional, reactivateProfessional } from "@/modules/licensing/actions";
import type { ProfessionalStatus } from "@/types/database";

function Pending({ children }: { children: React.ReactNode }) {
  const { pending } = useFormStatus();
  return pending ? <LoaderCircle className="animate-spin" /> : <>{children}</>;
}

/** Activar / desactivar con confirmación explícita (desactivar libera la licencia). */
export function MemberActions({
  professionalId,
  name,
  status,
  isSelf,
}: {
  professionalId: string;
  name: string;
  status: ProfessionalStatus;
  isSelf: boolean;
}) {
  const [confirming, setConfirming] = useState(false);
  const [offState, deactivate] = useActionState<FormState, FormData>(deactivateProfessional, {});
  const [onState, reactivate] = useActionState<FormState, FormData>(reactivateProfessional, {});
  const error = offState.error ?? onState.error;

  if (status === "inactive") {
    return (
      <form action={reactivate} className="flex flex-col items-end gap-1">
        <input type="hidden" name="professionalId" value={professionalId} />
        <Button type="submit" variant="outline" size="sm" className="bg-white">
          <Pending>
            <RotateCcw />
          </Pending>
          Reactivar
        </Button>
        {error && <p className="text-xs text-destructive">{error}</p>}
      </form>
    );
  }

  if (!confirming) {
    return (
      <Button type="button" variant="ghost" size="sm" className="text-muted-foreground" onClick={() => setConfirming(true)}>
        <Power /> Desactivar
      </Button>
    );
  }

  return (
    <form action={deactivate} className="w-full rounded-xl border border-red-200 bg-red-50 p-3 text-sm sm:w-72">
      <input type="hidden" name="professionalId" value={professionalId} />
      <p className="font-semibold text-red-800">¿Desactivar a {isSelf ? "tu propia agenda" : name}?</p>
      <p className="mt-1 text-xs text-red-700">
        Se libera su licencia y deja de recibir reservas. Conserva la consulta de sus clientes y citas.
      </p>
      {error && <p className="mt-2 text-xs font-semibold text-red-800">{error}</p>}
      <div className="mt-3 flex justify-end gap-2">
        <Button type="button" variant="ghost" size="sm" onClick={() => setConfirming(false)}>
          Cancelar
        </Button>
        <Button type="submit" variant="destructive" size="sm">
          <Pending>
            <Power />
          </Pending>
          Desactivar
        </Button>
      </div>
    </form>
  );
}
