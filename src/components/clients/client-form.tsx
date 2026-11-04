"use client";

import { useActionState } from "react";
import { FormField, FormTextarea } from "@/components/forms/form-field";
import { FormMessage, SubmitButton } from "@/components/forms/form-status";
import type { FormState } from "@/lib/validations/common";
import { addClient, updateClient } from "@/modules/clients/actions";
import type { ClientDetail } from "@/modules/clients/queries";

/** Alta (sin `client`) o edición de la ficha de un cliente de la cartera propia. */
export function ClientForm({ client, readOnly = false }: { client?: ClientDetail; readOnly?: boolean }) {
  const [state, action] = useActionState<FormState, FormData>(client ? updateClient : addClient, {});
  const e = state.fieldErrors ?? {};
  const id = (name: string) => `client-${client ? "edit" : "new"}-${name}`;

  return (
    <form action={action} className="space-y-4" noValidate>
      {client && <input type="hidden" name="clientId" value={client.id} />}
      <fieldset disabled={readOnly} className="space-y-4 disabled:opacity-70">
        <FormField id={id("name")} name="fullName" label="Nombre y apellidos" defaultValue={client?.fullName} required maxLength={120} error={e.fullName} />
        <FormField
          id={id("phone")}
          name="phone"
          label="Teléfono"
          type="tel"
          inputMode="tel"
          defaultValue={client?.phone}
          placeholder="600 000 000"
          required
          error={e.phone}
        />
        <FormField id={id("email")} name="email" label="Email (opcional)" type="email" inputMode="email" defaultValue={client?.email ?? ""} hint="Sin email no recibirá confirmaciones ni recordatorios." error={e.email} />
        <FormTextarea
          id={id("notes")}
          name="notes"
          label="Notas privadas (opcional)"
          defaultValue={client?.notes ?? ""}
          maxLength={2000}
          placeholder="Preferencias, alergias, cómo le gusta el degradado…"
          error={e.notes}
        />
        <label className="flex items-start gap-3 rounded-xl border border-border bg-surface p-4">
          <input
            type="checkbox"
            name="marketingConsent"
            defaultChecked={client?.marketingConsent ?? false}
            className="mt-0.5 size-5 shrink-0 accent-[var(--veltux-graphite)]"
          />
          <span className="text-sm">
            <span className="font-semibold">Acepta comunicaciones comerciales</span>
            <span className="block text-xs text-muted-foreground">
              Solo si el cliente lo ha aceptado expresamente. Los recordatorios de citas no lo necesitan.
            </span>
          </span>
        </label>
      </fieldset>
      <FormMessage state={state} />
      {!readOnly && <SubmitButton className="w-full sm:w-auto">{client ? "Guardar ficha" : "Añadir cliente"}</SubmitButton>}
    </form>
  );
}
