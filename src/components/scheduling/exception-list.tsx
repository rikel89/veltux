"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import { CalendarOff, CalendarPlus, LoaderCircle, Lock, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { FormState } from "@/lib/validations/common";
import { deleteException } from "@/modules/scheduling/actions";
import type { ScheduleExceptionType } from "@/types/database";

export type ExceptionRow = {
  id: string;
  type: ScheduleExceptionType;
  label: string;
  when: string;
  reason: string | null;
};

const ICON = { day_off: CalendarOff, block: Lock, break: Lock, extra_availability: CalendarPlus } as const;

function RemoveButton({ label }: { label: string }) {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" variant="ghost" size="icon" className="size-10 text-muted-foreground" aria-label={label} disabled={pending}>
      {pending ? <LoaderCircle className="animate-spin" /> : <Trash2 />}
    </Button>
  );
}

function ExceptionItem({ row, readOnly }: { row: ExceptionRow; readOnly: boolean }) {
  const [state, action] = useActionState<FormState, FormData>(deleteException, {});
  const Icon = ICON[row.type];
  const extra = row.type === "extra_availability";

  return (
    <li className="flex items-center gap-3 py-3">
      <span
        className={cn(
          "grid size-10 shrink-0 place-items-center rounded-xl",
          extra ? "bg-lime-soft text-lime-ink" : "bg-surface text-muted-foreground",
        )}
      >
        <Icon className="size-5" />
      </span>
      <div className="min-w-0 flex-1">
        <p className="text-sm font-semibold">
          {row.label} <span className="font-normal text-muted-foreground">· {row.when}</span>
        </p>
        {row.reason && <p className="truncate text-xs text-muted-foreground">{row.reason}</p>}
        {state.error && <p className="text-xs font-medium text-destructive">{state.error}</p>}
      </div>
      {!readOnly && (
        <form action={action}>
          <input type="hidden" name="exceptionId" value={row.id} />
          <RemoveButton label={`Eliminar ${row.label.toLowerCase()} del ${row.when}`} />
        </form>
      )}
    </li>
  );
}

export function ExceptionList({ rows, readOnly = false }: { rows: ExceptionRow[]; readOnly?: boolean }) {
  if (rows.length === 0) {
    return <p className="py-6 text-center text-sm text-muted-foreground">No tienes días libres ni bloqueos próximos.</p>;
  }
  return (
    <ul className="divide-y divide-border" aria-label="Próximas excepciones">
      {rows.map((row) => (
        <ExceptionItem key={row.id} row={row} readOnly={readOnly} />
      ))}
    </ul>
  );
}
