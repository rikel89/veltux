"use client";

import { useActionState, useState } from "react";
import { useFormStatus } from "react-dom";
import { Clock, EyeOff, LoaderCircle, Pencil, Trash2 } from "lucide-react";
import { DemoTag } from "@/components/dashboard/demo-tag";
import { Button } from "@/components/ui/button";
import { formatDuration, formatMoney } from "@/lib/format";
import { cn } from "@/lib/utils";
import type { FormState } from "@/lib/validations/common";
import { deleteService } from "@/modules/services/actions";
import type { ServiceItem } from "@/modules/services/queries";
import { ServiceForm } from "./service-form";

function DeleteButton() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" variant="destructive" size="sm" disabled={pending}>
      {pending ? <LoaderCircle className="animate-spin" /> : <Trash2 />}
      Eliminar
    </Button>
  );
}

export function ServiceCard({ service, readOnly = false, demo = false }: { service: ServiceItem; readOnly?: boolean; demo?: boolean }) {
  const [mode, setMode] = useState<"view" | "edit" | "delete">("view");
  const [deleteState, remove] = useActionState<FormState, FormData>(async (prev, formData) => {
    const result = await deleteService(prev, formData);
    if (result.ok) setMode("view");
    return result;
  }, {});

  return (
    <li
      className={cn(
        "rounded-2xl border border-border bg-card p-4 shadow-card sm:p-5",
        !service.isActive && "bg-surface",
      )}
    >
      <div className="flex items-start gap-3">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <p className={cn("font-semibold", !service.isActive && "text-muted-foreground")}>{service.name}</p>
            {demo && <DemoTag />}
            {!service.isActive && (
              <span className="rounded-full bg-muted px-2 py-0.5 text-[11px] font-semibold text-muted-foreground">Inactivo</span>
            )}
            {service.isActive && !service.isPublic && (
              <span className="inline-flex items-center gap-1 rounded-full bg-muted px-2 py-0.5 text-[11px] font-semibold text-muted-foreground">
                <EyeOff className="size-3" /> Solo en tu agenda
              </span>
            )}
          </div>
          <p className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-muted-foreground">
            <span className="inline-flex items-center gap-1">
              <Clock className="size-3.5" /> {formatDuration(service.durationMinutes)}
              {service.bufferAfterMinutes > 0 && ` + ${service.bufferAfterMinutes} min de margen`}
            </span>
          </p>
          {service.description && mode === "view" && (
            <p className="mt-2 line-clamp-2 text-sm text-muted-foreground">{service.description}</p>
          )}
        </div>
        <p className="shrink-0 text-lg font-extrabold tabular-nums">{formatMoney(service.priceCents, service.currency)}</p>
      </div>

      {mode === "view" && !readOnly && (
        <div className="mt-3 flex justify-end gap-1 border-t border-border pt-3">
          <Button type="button" variant="ghost" size="sm" onClick={() => setMode("edit")}>
            <Pencil /> Editar
          </Button>
          <Button type="button" variant="ghost" size="sm" className="text-muted-foreground" onClick={() => setMode("delete")}>
            <Trash2 /> Eliminar
          </Button>
        </div>
      )}

      {deleteState.ok && deleteState.message && mode === "view" && (
        <p role="status" className="mt-2 text-xs text-muted-foreground">
          {deleteState.message}
        </p>
      )}

      {mode === "edit" && (
        <div className="mt-4 border-t border-border pt-4">
          <ServiceForm service={service} onCancel={() => setMode("view")} />
        </div>
      )}

      {mode === "delete" && (
        <form
          action={remove}
          className="mt-4 rounded-xl border border-red-200 bg-red-50 p-3 text-sm"
        >
          <input type="hidden" name="serviceId" value={service.id} />
          <p className="font-semibold text-red-800">¿Eliminar «{service.name}»?</p>
          <p className="mt-1 text-xs text-red-700">
            Si ya tiene citas, se desactivará en lugar de borrarse para conservar tu historial.
          </p>
          {deleteState.error && <p className="mt-2 text-xs font-semibold text-red-800">{deleteState.error}</p>}
          <div className="mt-3 flex justify-end gap-2">
            <Button type="button" variant="ghost" size="sm" onClick={() => setMode("view")}>
              Cancelar
            </Button>
            <DeleteButton />
          </div>
        </form>
      )}
    </li>
  );
}
