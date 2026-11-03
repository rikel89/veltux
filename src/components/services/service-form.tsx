"use client";

import { useActionState } from "react";
import { FormField, FormSelect, FormTextarea } from "@/components/forms/form-field";
import { FormMessage, SubmitButton } from "@/components/forms/form-status";
import { Button } from "@/components/ui/button";
import { formatDuration } from "@/lib/format";
import type { FormState } from "@/lib/validations/common";
import { createService, updateService } from "@/modules/services/actions";
import type { ServiceItem } from "@/modules/services/queries";
import { BUFFER_OPTIONS, centsToInput, DURATION_OPTIONS } from "@/modules/services/schemas";

const minutesOptions = (values: readonly number[], current: number | undefined, zeroLabel?: string) =>
  [...new Set([...values, ...(current === undefined ? [] : [current])])]
    .sort((a, b) => a - b)
    .map((m) => ({ value: String(m), label: m === 0 && zeroLabel ? zeroLabel : formatDuration(m) }));

/** Alta (sin `service`) o edición de un servicio del catálogo propio. */
export function ServiceForm({
  service,
  readOnly = false,
  onCancel,
}: {
  service?: ServiceItem;
  readOnly?: boolean;
  onCancel?: () => void;
}) {
  const [state, action] = useActionState<FormState, FormData>(service ? updateService : createService, {});
  const idPrefix = service ? `svc-${service.id}` : "svc-new";

  return (
    <form action={action} className="space-y-4" noValidate>
      {service && <input type="hidden" name="serviceId" value={service.id} />}
      {/* Tras crear un servicio, la nueva clave vacía el formulario para el siguiente. */}
      <fieldset
        key={!service && state.ok ? state.message : "fields"}
        disabled={readOnly}
        className="space-y-4 disabled:opacity-70"
      >
        <ServiceFields service={service} idPrefix={idPrefix} errors={state.ok ? {} : (state.fieldErrors ?? {})} />
      </fieldset>
      <FormMessage state={state} />
      <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
        {onCancel && (
          <Button type="button" variant="ghost" size="lg" className="h-12" onClick={onCancel}>
            Cancelar
          </Button>
        )}
        {!readOnly && <SubmitButton className="w-full sm:w-auto">{service ? "Guardar cambios" : "Añadir servicio"}</SubmitButton>}
      </div>
    </form>
  );
}

function ServiceFields({
  service,
  idPrefix,
  errors: e,
}: {
  service?: ServiceItem;
  idPrefix: string;
  errors: Record<string, string>;
}) {
  const id = (name: string) => `${idPrefix}-${name}`;
  return (
    <>
      <FormField
        id={id("name")}
        name="name"
        label="Nombre del servicio"
        defaultValue={service?.name}
        placeholder="Corte + barba"
        required
        maxLength={80}
        error={e.name}
      />
      <div className="grid grid-cols-2 gap-3">
        <FormSelect
          id={id("duration")}
          name="durationMinutes"
          label="Duración"
          defaultValue={String(service?.durationMinutes ?? 30)}
          options={minutesOptions(DURATION_OPTIONS, service?.durationMinutes)}
          error={e.durationMinutes}
        />
        <FormField
          id={id("price")}
          name="price"
          label="Precio (€)"
          inputMode="decimal"
          defaultValue={service ? centsToInput(service.priceCents) : ""}
          placeholder="15,00"
          required
          error={e.price}
        />
      </div>
      <FormSelect
        id={id("buffer")}
        name="bufferAfterMinutes"
        label="Margen después de la cita"
        defaultValue={String(service?.bufferAfterMinutes ?? 0)}
        options={minutesOptions(BUFFER_OPTIONS, service?.bufferAfterMinutes, "Sin margen")}
        error={e.bufferAfterMinutes}
      />
      <FormTextarea
        id={id("description")}
        name="description"
        label="Descripción (opcional)"
        defaultValue={service?.description ?? ""}
        maxLength={500}
        placeholder="Qué incluye, para quién es…"
        className="[&_textarea]:min-h-20"
        error={e.description}
      />
      <div className="grid gap-3 sm:grid-cols-2">
        <Toggle
          name="isPublic"
          defaultChecked={service?.isPublic ?? true}
          title="Reservable online"
          hint="Aparece en tu página pública de reservas."
        />
        <Toggle
          name="isActive"
          defaultChecked={service?.isActive ?? true}
          title="Activo"
          hint="Si lo desactivas, solo queda en tu historial."
        />
      </div>
    </>
  );
}

function Toggle({ name, defaultChecked, title, hint }: { name: string; defaultChecked: boolean; title: string; hint: string }) {
  return (
    <label className="flex items-start gap-3 rounded-xl border border-border bg-surface p-4">
      <input
        type="checkbox"
        name={name}
        defaultChecked={defaultChecked}
        className="mt-0.5 size-5 shrink-0 accent-[var(--veltux-graphite)]"
      />
      <span className="text-sm">
        <span className="font-semibold">{title}</span>
        <span className="block text-xs text-muted-foreground">{hint}</span>
      </span>
    </label>
  );
}
