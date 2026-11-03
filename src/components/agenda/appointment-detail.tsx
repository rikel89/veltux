"use client";

import Link from "next/link";
import { useActionState, useState } from "react";
import { CalendarClock, Check, Phone, UserRound, UserX, X } from "lucide-react";
import { AppointmentStatusBadge } from "@/components/dashboard/appointment-status";
import { DemoTag } from "@/components/dashboard/demo-tag";
import { FormField } from "@/components/forms/form-field";
import { FormMessage, SubmitButton } from "@/components/forms/form-status";
import { Button } from "@/components/ui/button";
import { formatLongDate, formatTime, minutesBetween, toLocalDateKey } from "@/lib/datetime";
import { formatDuration, formatMoney } from "@/lib/format";
import type { FormState } from "@/lib/validations/common";
import { changeAppointmentStatus, rescheduleAppointment } from "@/modules/appointments/actions";
import type { AgendaAppointment } from "@/modules/appointments/agenda";

type Mode = "view" | "move" | "cancel";

function StatusButton({
  action,
  id,
  status,
  children,
  variant = "outline",
}: {
  action: (formData: FormData) => void;
  id: string;
  status: string;
  children: React.ReactNode;
  variant?: "outline" | "dark";
}) {
  return (
    <form action={action} className="flex-1">
      <input type="hidden" name="appointmentId" value={id} />
      <input type="hidden" name="status" value={status} />
      <Button type="submit" variant={variant} size="lg" className="h-11 w-full">
        {children}
      </Button>
    </form>
  );
}

export function AppointmentDetail({
  appointment: a,
  timeZone,
  nowIso,
  readOnly,
  demo,
  onDone,
}: {
  appointment: AgendaAppointment;
  timeZone: string;
  nowIso: string;
  readOnly: boolean;
  demo: boolean;
  onDone: (message: string) => void;
}) {
  const [mode, setMode] = useState<Mode>("view");
  const finish = (action: typeof changeAppointmentStatus) => async (prev: FormState, formData: FormData) => {
    const result = await action(prev, formData);
    if (result.ok) onDone(result.message ?? "Hecho.");
    return result;
  };
  const [statusState, setStatus] = useActionState<FormState, FormData>(finish(changeAppointmentStatus), {});
  const [moveState, move] = useActionState<FormState, FormData>(finish(rescheduleAppointment), {});

  const dateKey = toLocalDateKey(new Date(a.startsAt), timeZone);
  const started = new Date(a.startsAt).getTime() <= new Date(nowIso).getTime();
  const active = a.status === "pending" || a.status === "confirmed";
  const locked = readOnly || demo;

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-wrap items-center gap-2">
        {demo ? <DemoTag /> : <AppointmentStatusBadge status={a.status} />}
        <span className="text-sm text-muted-foreground">
          {formatLongDate(dateKey)} · {formatTime(a.startsAt, timeZone)}–{formatTime(a.endsAt, timeZone)}
        </span>
      </div>

      <dl className="divide-y divide-border rounded-xl border border-border bg-white text-sm">
        <div className="flex items-center gap-3 px-4 py-3">
          <UserRound className="size-4 text-muted-foreground" />
          <dt className="sr-only">Cliente</dt>
          <dd className="min-w-0 flex-1">
            {demo ? (
              <span className="font-semibold">{a.clientName}</span>
            ) : (
              <Link href={`/profesional/clientes/${a.clientId}`} className="font-semibold underline-offset-4 hover:underline">
                {a.clientName}
              </Link>
            )}
          </dd>
          {a.clientPhone && (
            <a href={`tel:${a.clientPhone}`} className="inline-flex items-center gap-1 text-xs font-semibold text-lime-ink tabular-nums">
              <Phone className="size-3.5" /> {a.clientPhone}
            </a>
          )}
        </div>
        <div className="flex items-center justify-between gap-3 px-4 py-3">
          <dt className="sr-only">Servicio</dt>
          <dd>
            <span className="font-semibold">{a.serviceName}</span>{" "}
            <span className="text-muted-foreground">· {formatDuration(minutesBetween(a.startsAt, a.endsAt))}</span>
          </dd>
          <dd className="font-bold tabular-nums">{formatMoney(a.priceCents, a.currency)}</dd>
        </div>
        {a.notes && (
          <div className="px-4 py-3">
            <dt className="text-xs text-muted-foreground">Nota</dt>
            <dd className="mt-0.5 whitespace-pre-line">{a.notes}</dd>
          </div>
        )}
      </dl>

      {!locked && mode === "view" && (
        <div className="flex flex-col gap-2">
          {active && started && (
            <div className="flex gap-2">
              <StatusButton action={setStatus} id={a.id} status="completed" variant="dark">
                <Check /> Completada
              </StatusButton>
              <StatusButton action={setStatus} id={a.id} status="no_show">
                <UserX /> No se presentó
              </StatusButton>
            </div>
          )}
          {(a.status === "completed" || a.status === "no_show") && (
            <div className="flex gap-2">
              <StatusButton action={setStatus} id={a.id} status={a.status === "completed" ? "no_show" : "completed"}>
                {a.status === "completed" ? "Marcar no presentada" : "Marcar completada"}
              </StatusButton>
              <StatusButton action={setStatus} id={a.id} status="confirmed">Deshacer</StatusButton>
            </div>
          )}
          {active && (
            <div className="flex gap-2">
              <Button type="button" variant="outline" size="lg" className="h-11 flex-1" onClick={() => setMode("move")}>
                <CalendarClock /> Mover
              </Button>
              <Button type="button" variant="ghost" size="lg" className="h-11 flex-1 text-destructive" onClick={() => setMode("cancel")}>
                <X /> Cancelar cita
              </Button>
            </div>
          )}
          <FormMessage state={statusState} />
        </div>
      )}

      {mode === "move" && (
        <form action={move} className="space-y-4 rounded-xl border border-border bg-surface p-4" noValidate>
          <input type="hidden" name="appointmentId" value={a.id} />
          <p className="text-sm font-semibold">Mover la cita</p>
          <div className="grid grid-cols-2 gap-3">
            <FormField id="move-date" name="date" label="Día" type="date" defaultValue={dateKey} error={moveState.fieldErrors?.date} />
            <FormField
              id="move-time"
              name="time"
              label="Hora"
              type="time"
              step={300}
              defaultValue={formatTime(a.startsAt, timeZone)}
              error={moveState.fieldErrors?.time}
            />
          </div>
          <label className="flex items-start gap-2.5 text-sm">
            <input type="checkbox" name="force" className="mt-0.5 size-4 accent-[var(--veltux-graphite)]" />
            <span>
              Aunque esté fuera de mi horario
              {moveState.fieldErrors?.force && <span className="block text-xs font-medium text-destructive">{moveState.fieldErrors.force}</span>}
            </span>
          </label>
          <FormMessage state={moveState} />
          <div className="flex justify-end gap-2">
            <Button type="button" variant="ghost" size="lg" className="h-12" onClick={() => setMode("view")}>
              Volver
            </Button>
            <SubmitButton>Mover cita</SubmitButton>
          </div>
        </form>
      )}

      {mode === "cancel" && (
        <form action={setStatus} className="space-y-3 rounded-xl border border-red-200 bg-red-50 p-4" noValidate>
          <input type="hidden" name="appointmentId" value={a.id} />
          <input type="hidden" name="status" value="cancelled" />
          <p className="text-sm font-semibold text-red-800">¿Cancelar la cita de {a.clientName}?</p>
          <p className="text-xs text-red-700">El hueco vuelve a quedar libre. La cita se conserva en el historial del cliente.</p>
          <FormField id="cancel-reason" name="reason" label="Motivo (opcional)" maxLength={300} error={statusState.fieldErrors?.reason} />
          <FormMessage state={statusState} />
          <div className="flex justify-end gap-2">
            <Button type="button" variant="ghost" size="sm" onClick={() => setMode("view")}>
              Volver
            </Button>
            <Button type="submit" variant="destructive" size="sm">
              Cancelar cita
            </Button>
          </div>
        </form>
      )}
    </div>
  );
}
