"use client";

import { useActionState, useEffect, useState } from "react";
import { LoaderCircle } from "lucide-react";
import { FormField, FormSelect, FormTextarea } from "@/components/forms/form-field";
import { FormMessage, SubmitButton } from "@/components/forms/form-status";
import { cn } from "@/lib/utils";
import type { FormState } from "@/lib/validations/common";
import { createAppointment } from "@/modules/appointments/actions";
import { previewSlots, type SlotPreview } from "@/modules/scheduling/actions";
import { ClientPicker, type PickedClient } from "./client-picker";

export type ServiceOption = { id: string; label: string };

/** Alta de cita: cliente, servicio y hueco libre (o una hora concreta confirmada). */
export function NewAppointmentForm({
  services,
  todayKey,
  initialDate,
  initialTime,
  onDone,
}: {
  services: ServiceOption[];
  todayKey: string;
  initialDate: string;
  initialTime: string | null;
  onDone: (message: string) => void;
}) {
  const [client, setClient] = useState<PickedClient | null>(null);
  const [serviceId, setServiceId] = useState(services[0]?.id ?? "");
  const [date, setDate] = useState(initialDate);
  const [time, setTime] = useState(initialTime ?? "");
  const [slots, setSlots] = useState<{ key: string; result: SlotPreview } | null>(null);
  const [state, action] = useActionState<FormState, FormData>(async (prev, formData) => {
    const result = await createAppointment(prev, formData);
    if (result.ok) onDone(result.message ?? "Cita creada.");
    return result;
  }, {});
  const e = state.fieldErrors ?? {};

  const slotKey = `${serviceId}|${date}`;
  const canPreview = Boolean(serviceId) && date >= todayKey;
  useEffect(() => {
    if (!canPreview) return;
    let alive = true;
    previewSlots(serviceId, date).then((result) => alive && setSlots({ key: `${serviceId}|${date}`, result }));
    return () => {
      alive = false;
    };
  }, [serviceId, date, canPreview]);

  const current = slots?.key === slotKey ? slots.result : null;
  const times = current && "times" in current ? current.times : [];

  if (services.length === 0) {
    return <p className="text-sm text-muted-foreground">Primero añade un servicio activo en «Mis servicios».</p>;
  }

  return (
    <form action={action} className="flex flex-col gap-5" noValidate>
      <ClientPicker value={client} onChange={setClient} error={e.clientId} />

      <FormSelect
        id="appt-service"
        name="serviceId"
        label="Servicio"
        value={serviceId}
        onChange={(ev) => setServiceId(ev.target.value)}
        options={services.map((s) => ({ value: s.id, label: s.label }))}
        error={e.serviceId}
      />

      <FormField id="appt-date" name="date" label="Día" type="date" value={date} onChange={(ev) => setDate(ev.target.value)} error={e.date} />

      <fieldset>
        <legend className="text-sm font-medium">Hora</legend>
        <input type="hidden" name="time" value={time} />
        {canPreview && !current && (
          <p className="mt-2 flex items-center gap-2 text-xs text-muted-foreground">
            <LoaderCircle className="size-3.5 animate-spin" /> Buscando huecos libres…
          </p>
        )}
        {current && "error" in current && <p className="mt-2 text-xs text-muted-foreground">{current.error}</p>}
        {current && "times" in current && times.length === 0 && (
          <p className="mt-2 text-xs text-muted-foreground">No quedan huecos libres ese día para este servicio.</p>
        )}
        {times.length > 0 && (
          <div className="mt-2 flex max-h-40 flex-wrap gap-1.5 overflow-y-auto" role="group" aria-label="Huecos libres">
            {times.map((t) => (
              <button
                key={t}
                type="button"
                aria-pressed={time === t}
                onClick={() => setTime(t)}
                className={cn(
                  "rounded-lg border px-2.5 py-1.5 text-sm font-semibold tabular-nums transition-colors",
                  time === t ? "border-graphite bg-graphite text-lime" : "border-border bg-white hover:bg-surface",
                )}
              >
                {t}
              </button>
            ))}
          </div>
        )}
        <div className="mt-3 flex items-end gap-3">
          <FormField
            id="appt-time"
            name="_time"
            label="Otra hora"
            type="time"
            step={300}
            value={time}
            onChange={(ev) => setTime(ev.target.value)}
            className="w-36"
            error={e.time}
          />
        </div>
        <label className="mt-3 flex items-start gap-2.5 text-sm">
          <input type="checkbox" name="force" className="mt-0.5 size-4 accent-[var(--veltux-graphite)]" />
          <span>
            Reservar aunque esté fuera de mi horario
            {e.force && <span className="block text-xs font-medium text-destructive">{e.force}</span>}
          </span>
        </label>
      </fieldset>

      <FormTextarea id="appt-notes" name="notes" label="Nota (opcional)" maxLength={1000} className="[&_textarea]:min-h-20" error={e.notes} />

      <FormMessage state={state} />
      <SubmitButton className="w-full">Crear cita</SubmitButton>
    </form>
  );
}
