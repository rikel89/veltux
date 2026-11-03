"use client";

import { useActionState } from "react";
import { FormField, FormSelect } from "@/components/forms/form-field";
import { FormMessage, SubmitButton } from "@/components/forms/form-status";
import type { FormState } from "@/lib/validations/common";
import { updateSalonSettings } from "@/modules/salons/actions";
import { SALON_KINDS, SALON_TIMEZONES } from "@/modules/salons/schemas";

type Defaults = Record<
  "name" | "kind" | "timezone" | "phone" | "email" | "addressLine" | "city" | "postalCode",
  string
>;

export function SalonSettingsForm({ defaults }: { defaults: Defaults }) {
  const [state, action] = useActionState<FormState, FormData>(updateSalonSettings, {});
  const e = state.fieldErrors ?? {};

  return (
    <form action={action} className="space-y-5" noValidate>
      <section className="rounded-2xl border border-border bg-card p-5 shadow-card sm:p-6">
        <h2 className="text-base font-bold">Datos generales</h2>
        <div className="mt-5 grid gap-4 sm:grid-cols-2">
          <FormField name="name" label="Nombre comercial" defaultValue={defaults.name} required error={e.name} />
          <FormSelect name="kind" label="Tipo" options={SALON_KINDS} defaultValue={defaults.kind} error={e.kind} />
          <FormField
            name="phone"
            label="Teléfono"
            type="tel"
            inputMode="tel"
            defaultValue={defaults.phone}
            placeholder="+34 600 000 000"
            error={e.phone}
          />
          <FormField
            name="email"
            label="Email de contacto"
            type="email"
            inputMode="email"
            defaultValue={defaults.email}
            error={e.email}
          />
        </div>
      </section>

      <section className="rounded-2xl border border-border bg-card p-5 shadow-card sm:p-6">
        <h2 className="text-base font-bold">Ubicación</h2>
        <div className="mt-5 grid gap-4 sm:grid-cols-2">
          <FormField
            name="addressLine"
            label="Dirección"
            defaultValue={defaults.addressLine}
            className="sm:col-span-2"
            error={e.addressLine}
          />
          <FormField name="city" label="Ciudad" defaultValue={defaults.city} error={e.city} />
          <FormField
            name="postalCode"
            label="Código postal"
            inputMode="numeric"
            defaultValue={defaults.postalCode}
            error={e.postalCode}
          />
          <FormSelect
            name="timezone"
            label="Zona horaria"
            options={SALON_TIMEZONES}
            defaultValue={defaults.timezone}
            className="sm:col-span-2"
            error={e.timezone}
          />
        </div>
      </section>

      <FormMessage state={state} />
      <div className="flex justify-end">
        <SubmitButton className="w-full sm:w-auto">Guardar cambios</SubmitButton>
      </div>
    </form>
  );
}
