"use client";

import { useActionState, useState } from "react";
import { FormField } from "@/components/forms/form-field";
import { FormMessage, SubmitButton } from "@/components/forms/form-status";
import { cn } from "@/lib/utils";
import type { FormState } from "@/lib/validations/common";
import { createException } from "@/modules/scheduling/actions";
import { EXCEPTION_TYPES, type ExceptionKind } from "@/modules/scheduling/schemas";

export function ExceptionForm({ todayKey, readOnly = false }: { todayKey: string; readOnly?: boolean }) {
  const [state, action] = useActionState<FormState, FormData>(createException, {});

  return (
    <form action={action} className="space-y-4" noValidate>
      <fieldset key={state.ok ? state.message : "fields"} disabled={readOnly} className="space-y-4 disabled:opacity-70">
        <ExceptionFields todayKey={todayKey} errors={state.ok ? {} : (state.fieldErrors ?? {})} />
      </fieldset>
      <FormMessage state={state} />
      {!readOnly && <SubmitButton className="w-full">Añadir a mi agenda</SubmitButton>}
    </form>
  );
}

function ExceptionFields({ todayKey, errors: e }: { todayKey: string; errors: Record<string, string> }) {
  const [type, setType] = useState<ExceptionKind>("day_off");
  const [startDate, setStartDate] = useState(todayKey);
  const hint = EXCEPTION_TYPES.find((t) => t.value === type)?.hint;

  return (
    <>
      <fieldset>
        <legend className="text-sm font-medium">Tipo</legend>
        <div className="mt-2 grid grid-cols-3 gap-2">
          {EXCEPTION_TYPES.map((t) => (
            <label
              key={t.value}
              className={cn(
                "flex min-h-12 cursor-pointer items-center justify-center rounded-xl border px-2 py-2 text-center text-xs font-semibold transition-colors has-focus-visible:ring-3 has-focus-visible:ring-ring/50",
                type === t.value ? "border-graphite bg-graphite text-white" : "border-border bg-white hover:bg-surface",
              )}
            >
              <input
                type="radio"
                name="type"
                value={t.value}
                checked={type === t.value}
                onChange={() => setType(t.value)}
                className="sr-only"
              />
              {t.label}
            </label>
          ))}
        </div>
        {hint && <p className="mt-2 text-xs text-muted-foreground">{hint}</p>}
      </fieldset>

      {type === "day_off" ? (
        <div className="grid grid-cols-2 gap-3">
          <FormField
            id="exc-start"
            name="startDate"
            label="Desde"
            type="date"
            min={todayKey}
            value={startDate}
            onChange={(ev) => setStartDate(ev.target.value)}
            error={e.startDate}
          />
          <FormField
            id="exc-end"
            name="endDate"
            label="Hasta (incluido)"
            type="date"
            min={startDate}
            defaultValue={todayKey}
            error={e.endDate}
          />
        </div>
      ) : (
        <>
          <FormField id="exc-date" name="date" label="Día" type="date" min={todayKey} defaultValue={todayKey} error={e.date} />
          <div className="grid grid-cols-2 gap-3">
            <FormField
              id="exc-from"
              name="startTime"
              label="Desde"
              type="time"
              step={300}
              defaultValue={type === "block" ? "10:00" : "16:00"}
              error={e.startTime}
            />
            <FormField
              id="exc-to"
              name="endTime"
              label="Hasta"
              type="time"
              step={300}
              defaultValue={type === "block" ? "11:00" : "20:00"}
              error={e.endTime}
            />
          </div>
        </>
      )}

      <FormField
        id="exc-reason"
        name="reason"
        label="Nota privada (opcional)"
        maxLength={300}
        placeholder={type === "day_off" ? "Vacaciones" : "Médico, formación…"}
        hint="Solo la ves tú. Tus clientes y el propietario no ven el motivo."
        error={e.reason}
      />
    </>
  );
}
