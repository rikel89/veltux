"use client";

import { useActionState, useState } from "react";
import { FormField, FormSelect } from "@/components/forms/form-field";
import { FormMessage, SubmitButton } from "@/components/forms/form-status";
import { slugify, type FormState } from "@/lib/validations/common";
import { createSalon } from "@/modules/salons/actions";
import { SALON_KINDS } from "@/modules/salons/schemas";

function Section({ title, description, children }: { title: string; description: string; children: React.ReactNode }) {
  return (
    <section className="rounded-2xl border border-border bg-card p-5 shadow-card sm:p-6">
      <h2 className="text-base font-bold">{title}</h2>
      <p className="text-xs text-muted-foreground">{description}</p>
      <div className="mt-5 grid gap-4 sm:grid-cols-2">{children}</div>
    </section>
  );
}

export function NewSalonForm() {
  const [state, action] = useActionState<FormState, FormData>(createSalon, {});
  const e = state.fieldErrors ?? {};

  // Las direcciones se sugieren a partir de los nombres hasta que se editan a mano.
  const [salonSlug, setSalonSlug] = useState("");
  const [salonSlugTouched, setSalonSlugTouched] = useState(false);
  const [proSlug, setProSlug] = useState("");
  const [proSlugTouched, setProSlugTouched] = useState(false);
  const [ownerWorks, setOwnerWorks] = useState(true);

  return (
    <form action={action} className="space-y-5" noValidate>
      <Section title="Propietario" description="Persona que gestiona el establecimiento y sus licencias.">
        <FormField
          name="ownerFullName"
          label="Nombre y apellidos"
          autoComplete="off"
          required
          error={e.ownerFullName}
          onChange={(ev) => !proSlugTouched && setProSlug(slugify(ev.target.value.split(" ")[0] ?? ""))}
        />
        <FormField name="ownerEmail" label="Email" type="email" inputMode="email" required error={e.ownerEmail} />
      </Section>

      <Section title="Establecimiento" description="Datos públicos de la peluquería.">
        <FormField
          name="salonName"
          label="Nombre comercial"
          required
          error={e.salonName}
          onChange={(ev) => !salonSlugTouched && setSalonSlug(slugify(ev.target.value))}
        />
        <FormField
          name="salonSlug"
          label="Dirección de reservas"
          required
          value={salonSlug}
          onChange={(ev) => {
            setSalonSlugTouched(true);
            setSalonSlug(ev.target.value.toLowerCase());
          }}
          hint={`veltux.es/${salonSlug || "tu-peluqueria"}`}
          error={e.salonSlug}
        />
        <FormSelect name="salonKind" label="Tipo" options={SALON_KINDS} defaultValue="barberia" error={e.salonKind} />
        <FormField name="salonCity" label="Ciudad" error={e.salonCity} />
        <FormField
          name="salonPhone"
          label="Teléfono (opcional)"
          type="tel"
          inputMode="tel"
          placeholder="+34 600 000 000"
          error={e.salonPhone}
        />
      </Section>

      <Section title="Piloto" description="Licencias contratadas y agenda del propietario.">
        <FormField
          name="licenseQuantity"
          label="Licencias contratadas"
          type="number"
          inputMode="numeric"
          min={1}
          max={50}
          defaultValue={3}
          required
          hint="Cada profesional activo con agenda consume una."
          error={e.licenseQuantity}
        />
        <div className="flex items-start gap-3 rounded-xl border border-border bg-surface p-4 sm:row-span-2">
          <input
            id="ownerWorks"
            name="ownerWorks"
            type="checkbox"
            checked={ownerWorks}
            onChange={(ev) => setOwnerWorks(ev.target.checked)}
            className="mt-0.5 size-5 accent-[var(--veltux-graphite)]"
          />
          <label htmlFor="ownerWorks" className="text-sm">
            <span className="font-semibold">El propietario también atiende</span>
            <span className="block text-xs text-muted-foreground">
              Se le crea agenda propia y consume una licencia.
            </span>
          </label>
        </div>
        {ownerWorks && (
          <FormField
            name="professionalSlug"
            label="Dirección de su agenda"
            value={proSlug}
            onChange={(ev) => {
              setProSlugTouched(true);
              setProSlug(ev.target.value.toLowerCase());
            }}
            hint={`veltux.es/${salonSlug || "tu-peluqueria"}/${proSlug || "nombre"}`}
            error={e.professionalSlug}
          />
        )}
      </Section>

      <FormMessage state={state} />
      <div className="flex justify-end">
        <SubmitButton className="w-full sm:w-auto">Crear establecimiento e invitar</SubmitButton>
      </div>
    </form>
  );
}
