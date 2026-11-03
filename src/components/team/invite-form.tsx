"use client";

import { useActionState, useState } from "react";
import { FormField } from "@/components/forms/form-field";
import { FormMessage, SubmitButton } from "@/components/forms/form-status";
import { slugify, type FormState } from "@/lib/validations/common";
import { inviteProfessional } from "@/modules/licensing/actions";
import { publicLabel } from "@/lib/site";

export function InviteForm({ salonSlug, freeLicenses }: { salonSlug: string; freeLicenses: number }) {
  const [state, action] = useActionState<FormState, FormData>(inviteProfessional, {});

  return (
    <form action={action} className="space-y-4" noValidate>
      {/* Tras una invitación correcta, la nueva clave vacía los campos para la siguiente. */}
      <InviteFields
        key={state.ok ? state.message : "pending"}
        salonSlug={salonSlug}
        freeLicenses={freeLicenses}
        errors={state.ok ? {} : (state.fieldErrors ?? {})}
      />
      <FormMessage state={state} />
      <SubmitButton className="w-full">Enviar invitación</SubmitButton>
    </form>
  );
}

function InviteFields({
  salonSlug,
  freeLicenses,
  errors: e,
}: {
  salonSlug: string;
  freeLicenses: number;
  errors: Record<string, string>;
}) {
  const [slug, setSlug] = useState("");
  const [slugTouched, setSlugTouched] = useState(false);

  return (
    <>
      <FormField
        name="displayName"
        label="Nombre visible"
        required
        error={e.displayName}
        onChange={(ev) => !slugTouched && setSlug(slugify(ev.target.value.split(" ")[0] ?? ""))}
      />
      <FormField name="email" label="Email" type="email" inputMode="email" required error={e.email} />
      <FormField
        name="slug"
        label="Dirección de su agenda"
        value={slug}
        onChange={(ev) => {
          setSlugTouched(true);
          setSlug(ev.target.value.toLowerCase());
        }}
        hint={publicLabel(`/${salonSlug}/${slug || "nombre"}`)}
        error={e.slug}
      />
      <label className="flex items-start gap-3 rounded-xl border border-border bg-surface p-4">
        <input
          type="checkbox"
          name="assignLicense"
          defaultChecked={freeLicenses > 0}
          disabled={freeLicenses === 0}
          className="mt-0.5 size-5 accent-[var(--veltux-graphite)]"
        />
        <span className="text-sm">
          <span className="font-semibold">Asignarle una licencia</span>
          <span className="block text-xs text-muted-foreground">
            {freeLicenses > 0
              ? `Quedan ${freeLicenses} libres. Sin licencia no podrá recibir reservas.`
              : "No quedan licencias libres: podrás asignarla más tarde."}
          </span>
        </span>
      </label>
    </>
  );
}
