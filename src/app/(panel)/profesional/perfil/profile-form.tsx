"use client";

import { useActionState, useState } from "react";
import { Check } from "lucide-react";
import { FormField, FormTextarea } from "@/components/forms/form-field";
import { FormMessage, SubmitButton } from "@/components/forms/form-status";
import { CopyBookingLink } from "@/components/dashboard/copy-booking-link";
import { cn } from "@/lib/utils";
import type { FormState } from "@/lib/validations/common";
import { updateMyProfessionalProfile } from "@/modules/professionals/actions";
import type { ProfessionalProfile } from "@/modules/professionals/queries";
import { PROFESSIONAL_COLORS } from "@/modules/professionals/schemas";

export function ProfileForm({ profile }: { profile: ProfessionalProfile }) {
  const [state, action] = useActionState<FormState, FormData>(updateMyProfessionalProfile, {});
  const [color, setColor] = useState(profile.color.toUpperCase());
  const e = state.fieldErrors ?? {};

  return (
    <form action={action} className="space-y-5" noValidate>
      <section className="rounded-2xl bg-graphite p-5 text-white sm:p-6">
        <p className="text-xs font-semibold text-neutral-400">Tu enlace personal de reservas</p>
        <CopyBookingLink path={`veltux.es/${profile.salonSlug}/${profile.slug}`} />
        <p className="mt-2 text-[11px] text-neutral-500">El portal público de reservas se activa en el Sprint 5.</p>
      </section>

      <section className="rounded-2xl border border-border bg-card p-5 shadow-card sm:p-6">
        <h2 className="text-base font-bold">Datos públicos</h2>
        <div className="mt-5 grid gap-4">
          <FormField
            name="displayName"
            label="Nombre visible"
            defaultValue={profile.displayName}
            required
            error={e.displayName}
          />
          <FormTextarea
            name="bio"
            label="Presentación (opcional)"
            defaultValue={profile.bio ?? ""}
            maxLength={500}
            placeholder="Especialista en degradados y barba clásica…"
            error={e.bio}
          />
        </div>
      </section>

      <section className="rounded-2xl border border-border bg-card p-5 shadow-card sm:p-6">
        <h2 className="text-base font-bold">Contacto y agenda</h2>
        <div className="mt-5 grid gap-5">
          <FormField
            name="phone"
            label="Teléfono profesional"
            type="tel"
            inputMode="tel"
            defaultValue={profile.phone ?? ""}
            placeholder="+34 600 000 000"
            hint="No se muestra a los clientes. Lo usaremos para avisos de la plataforma."
            error={e.phone}
          />

          <fieldset>
            <legend className="text-sm font-medium">Color de tu agenda</legend>
            <input type="hidden" name="color" value={color} />
            <div className="mt-3 flex flex-wrap gap-2.5">
              {PROFESSIONAL_COLORS.map((c) => (
                <button
                  key={c.value}
                  type="button"
                  onClick={() => setColor(c.value)}
                  aria-label={c.label}
                  aria-pressed={color === c.value}
                  className={cn(
                    "grid size-11 place-items-center rounded-xl ring-offset-2 transition-transform active:scale-95",
                    color === c.value && "ring-2 ring-graphite",
                  )}
                  style={{ backgroundColor: c.value }}
                >
                  {color === c.value && <Check className="size-5 text-graphite" strokeWidth={3} />}
                </button>
              ))}
            </div>
            {e.color && <p className="mt-2 text-xs font-medium text-destructive">{e.color}</p>}
          </fieldset>

          <label className="flex items-start gap-3 rounded-xl border border-border bg-surface p-4">
            <input
              type="checkbox"
              name="acceptsOnlineBooking"
              defaultChecked={profile.acceptsOnlineBooking}
              className="mt-0.5 size-5 accent-[var(--veltux-graphite)]"
            />
            <span className="text-sm">
              <span className="font-semibold">Aceptar reservas online</span>
              <span className="block text-xs text-muted-foreground">
                Si lo desactivas, no aparecerás en la página pública de reservas.
              </span>
            </span>
          </label>
        </div>
      </section>

      <FormMessage state={state} />
      <div className="flex justify-end">
        <SubmitButton className="w-full sm:w-auto">Guardar perfil</SubmitButton>
      </div>
    </form>
  );
}
