"use client";

import { useState, useTransition } from "react";
import { LoaderCircle } from "lucide-react";
import { FormField, FormSelect } from "@/components/forms/form-field";
import { Button } from "@/components/ui/button";
import { formatLongDate } from "@/lib/datetime";
import { previewSlots, type SlotPreview as Preview } from "@/modules/scheduling/actions";

/**
 * Comprueba qué huecos verá un cliente. Es solo una consulta: no reserva nada.
 */
export function SlotPreview({
  services,
  todayKey,
  disabled = false,
}: {
  services: { id: string; label: string }[];
  todayKey: string;
  disabled?: boolean;
}) {
  const [serviceId, setServiceId] = useState(services[0]?.id ?? "");
  const [dateKey, setDateKey] = useState(todayKey);
  const [result, setResult] = useState<Preview | null>(null);
  const [pending, startTransition] = useTransition();

  if (services.length === 0) {
    return <p className="text-sm text-muted-foreground">Añade un servicio activo para ver tu disponibilidad.</p>;
  }

  return (
    <div className="space-y-4">
      <form
        className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_180px_auto] sm:items-end"
        onSubmit={(e) => {
          e.preventDefault();
          startTransition(async () => setResult(await previewSlots(serviceId, dateKey)));
        }}
      >
        <FormSelect
          id="preview-service"
          name="serviceId"
          label="Servicio"
          value={serviceId}
          onChange={(e) => setServiceId(e.target.value)}
          options={services.map((s) => ({ value: s.id, label: s.label }))}
          disabled={disabled}
        />
        <FormField
          id="preview-date"
          name="date"
          label="Día"
          type="date"
          min={todayKey}
          value={dateKey}
          onChange={(e) => setDateKey(e.target.value)}
          disabled={disabled}
        />
        <Button type="submit" variant="dark" size="lg" className="h-12" disabled={disabled || pending}>
          {pending && <LoaderCircle className="animate-spin" />}
          Ver huecos
        </Button>
      </form>

      {result && "error" in result && (
        <p role="alert" className="rounded-xl bg-red-50 px-4 py-3 text-sm text-red-700">
          {result.error}
        </p>
      )}
      {result && "times" in result && (
        <div role="status" aria-live="polite">
          <p className="text-sm font-semibold">
            {formatLongDate(result.dateKey)} ·{" "}
            <span className="font-normal text-muted-foreground">
              {result.times.length === 0
                ? "sin huecos libres"
                : `${result.times.length} ${result.times.length === 1 ? "hueco libre" : "huecos libres"}`}
            </span>
          </p>
          {result.times.length > 0 && (
            <ul className="mt-3 flex flex-wrap gap-2" aria-label="Horas disponibles">
              {result.times.map((t) => (
                <li key={t} className="rounded-lg border border-border bg-surface px-3 py-1.5 text-sm font-semibold tabular-nums">
                  {t}
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}
