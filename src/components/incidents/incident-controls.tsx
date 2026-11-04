"use client";

import { useActionState, useState } from "react";
import { Ban, CalendarClock, CalendarOff, UserRoundCheck, Users, X } from "lucide-react";
import { FormField, FormSelect } from "@/components/forms/form-field";
import { FormMessage, SubmitButton } from "@/components/forms/form-status";
import { Button } from "@/components/ui/button";
import type { FormState } from "@/lib/validations/common";
import {
  blockDay,
  cancelDayAppointments,
  proposeReschedule,
  requestReassignment,
  respondReassignment,
  withdrawRequest,
} from "@/modules/incidents/actions";

type Option = { value: string; label: string };

/** Bloquear la jornada y cancelar todas sus citas. */
export function DayControls({ date, blocked, activeCount }: { date: string; blocked: boolean; activeCount: number }) {
  const [blockState, block] = useActionState<FormState, FormData>(blockDay, {});
  const [cancelState, cancel] = useActionState<FormState, FormData>(cancelDayAppointments, {});
  const [confirming, setConfirming] = useState(false);

  return (
    <div className="space-y-3">
      <form action={block} className="space-y-3">
        <input type="hidden" name="date" value={date} />
        <FormField id="block-reason" name="reason" label="Motivo (privado, opcional)" maxLength={300} error={blockState.fieldErrors?.reason ?? cancelState.fieldErrors?.reason} />
        <FormMessage state={blockState} />
        {blocked ? (
          <p className="flex items-center gap-2 rounded-xl bg-surface px-4 py-3 text-sm font-medium">
            <CalendarOff className="size-4" /> Esta jornada ya está bloqueada.
          </p>
        ) : (
          <SubmitButton className="w-full">
            <CalendarOff /> Bloquear la jornada
          </SubmitButton>
        )}
      </form>

      {activeCount > 0 && !confirming && (
        <Button type="button" variant="ghost" size="lg" className="h-11 w-full text-destructive" onClick={() => setConfirming(true)}>
          <Ban /> Cancelar todas las citas ({activeCount})
        </Button>
      )}
      {confirming && (
        <form action={cancel} className="space-y-3 rounded-xl border border-red-200 bg-red-50 p-4">
          <input type="hidden" name="date" value={date} />
          <p className="text-sm font-semibold text-red-800">¿Cancelar {activeCount === 1 ? "la cita" : `las ${activeCount} citas`} de esta jornada?</p>
          <p className="text-xs text-red-700">Los clientes con email recibirán un aviso. No se puede deshacer.</p>
          <FormField id="bulk-reason" name="reason" label="Motivo (privado, opcional)" maxLength={300} />
          <FormMessage state={cancelState} />
          <div className="flex justify-end gap-2">
            <Button type="button" variant="ghost" size="sm" onClick={() => setConfirming(false)}>
              Volver
            </Button>
            <Button type="submit" variant="destructive" size="sm">
              Cancelar todas
            </Button>
          </div>
        </form>
      )}
      {!confirming && <FormMessage state={cancelState} />}
    </div>
  );
}

type Mode = "none" | "reschedule" | "reassign" | "cancel";

/** Acciones sobre una cita afectada. */
export function AppointmentControls({
  appointmentId,
  date,
  time,
  colleagues,
}: {
  appointmentId: string;
  date: string;
  time: string;
  colleagues: Option[];
}) {
  const [mode, setMode] = useState<Mode>("none");
  const closeOnOk = <A,>(action: (prev: FormState, data: A) => Promise<FormState>) => async (prev: FormState, data: A) => {
    const result = await action(prev, data);
    if (result.ok) setMode("none");
    return result;
  };
  const [rescheduleState, reschedule] = useActionState<FormState, FormData>(closeOnOk(proposeReschedule), {});
  const [reassignState, reassign] = useActionState<FormState, FormData>(closeOnOk(requestReassignment), {});
  const [cancelState, cancel] = useActionState<FormState, FormData>(closeOnOk(cancelDayAppointments), {});
  const lastOk = [rescheduleState, reassignState, cancelState].find((s) => s.ok);

  return (
    <div className="mt-3 border-t border-border pt-3">
      {mode === "none" && (
        <div className="flex flex-wrap gap-1">
          <Button type="button" variant="ghost" size="sm" onClick={() => setMode("reschedule")}>
            <CalendarClock /> Proponer otra hora
          </Button>
          <Button type="button" variant="ghost" size="sm" disabled={colleagues.length === 0} onClick={() => setMode("reassign")}>
            <Users /> Reasignar
          </Button>
          <Button type="button" variant="ghost" size="sm" className="text-destructive" onClick={() => setMode("cancel")}>
            <Ban /> Cancelar
          </Button>
        </div>
      )}
      {mode === "none" && lastOk && (
        <div className="mt-2">
          <FormMessage state={lastOk} />
        </div>
      )}

      {mode === "reschedule" && (
        <form action={reschedule} className="space-y-3 rounded-xl bg-surface p-4" noValidate>
          <input type="hidden" name="appointmentId" value={appointmentId} />
          <p className="text-sm font-semibold">Proponer otra hora al cliente</p>
          <div className="grid grid-cols-2 gap-3">
            <FormField id={`r-date-${appointmentId}`} name="date" label="Día" type="date" defaultValue={date} error={rescheduleState.fieldErrors?.date} />
            <FormField id={`r-time-${appointmentId}`} name="time" label="Hora" type="time" step={300} defaultValue={time} error={rescheduleState.fieldErrors?.time} />
          </div>
          <FormField id={`r-msg-${appointmentId}`} name="message" label="Mensaje (opcional)" maxLength={500} error={rescheduleState.fieldErrors?.message} />
          <FormMessage state={rescheduleState} />
          <Actions onBack={() => setMode("none")} label="Enviar propuesta" />
        </form>
      )}

      {mode === "reassign" && (
        <form action={reassign} className="space-y-3 rounded-xl bg-surface p-4" noValidate>
          <input type="hidden" name="appointmentId" value={appointmentId} />
          <p className="text-sm font-semibold">Pedir a un compañero que atienda esta cita</p>
          <p className="text-xs text-muted-foreground">Debe aceptar y después confirmar el cliente. Hasta entonces, la cita sigue en tu agenda.</p>
          <FormSelect id={`t-${appointmentId}`} name="targetProfessionalId" label="Profesional" options={colleagues} error={reassignState.fieldErrors?.targetProfessionalId} />
          <FormField id={`t-msg-${appointmentId}`} name="message" label="Mensaje para tu compañero (opcional)" maxLength={500} error={reassignState.fieldErrors?.message} />
          <FormMessage state={reassignState} />
          <Actions onBack={() => setMode("none")} label="Enviar solicitud" />
        </form>
      )}

      {mode === "cancel" && (
        <form action={cancel} className="space-y-3 rounded-xl border border-red-200 bg-red-50 p-4">
          <input type="hidden" name="date" value={date} />
          <input type="hidden" name="appointmentId" value={appointmentId} />
          <p className="text-sm font-semibold text-red-800">¿Cancelar esta cita?</p>
          <FormField id={`c-${appointmentId}`} name="reason" label="Motivo (privado, opcional)" maxLength={300} />
          <FormMessage state={cancelState} />
          <div className="flex justify-end gap-2">
            <Button type="button" variant="ghost" size="sm" onClick={() => setMode("none")}>
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

function Actions({ onBack, label }: { onBack: () => void; label: string }) {
  return (
    <div className="flex justify-end gap-2">
      <Button type="button" variant="ghost" size="lg" className="h-12" onClick={onBack}>
        Volver
      </Button>
      <SubmitButton>{label}</SubmitButton>
    </div>
  );
}

export function WithdrawRequest({ requestId }: { requestId: string }) {
  const [state, action] = useActionState<FormState, FormData>(withdrawRequest, {});
  return (
    <form action={action}>
      <input type="hidden" name="requestId" value={requestId} />
      {state.error && <p className="mb-1 text-xs text-destructive">{state.error}</p>}
      <Button type="submit" variant="ghost" size="sm">
        <X /> Retirar
      </Button>
    </form>
  );
}

/** El receptor acepta (eligiendo su servicio) o rechaza una reasignación. */
export function IncomingControls({ requestId, services }: { requestId: string; services: Option[] }) {
  const [state, action] = useActionState<FormState, FormData>(respondReassignment, {});
  return (
    <form action={action} className="mt-3 space-y-3" noValidate>
      <input type="hidden" name="requestId" value={requestId} />
      {services.length === 0 ? (
        <p className="text-xs text-muted-foreground">Añade un servicio activo para poder aceptar.</p>
      ) : (
        <FormSelect id={`in-${requestId}`} name="serviceId" label="Tu servicio y precio para esta cita" options={services} error={state.fieldErrors?.serviceId} />
      )}
      <FormMessage state={state} />
      <div className="flex justify-end gap-2">
        <Button type="submit" name="decision" value="reject" variant="ghost" size="sm">
          Rechazar
        </Button>
        <Button type="submit" name="decision" value="accept" variant="dark" size="sm" disabled={services.length === 0}>
          <UserRoundCheck /> Aceptar
        </Button>
      </div>
    </form>
  );
}
