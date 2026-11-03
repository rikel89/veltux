import type { Metadata } from "next";
import { Hourglass, UserRound } from "lucide-react";
import { AppointmentControls, DayControls, IncomingControls, WithdrawRequest } from "@/components/incidents/incident-controls";
import { PageHeader } from "@/components/layout/page-header";
import { ReadOnlyNotice } from "@/components/scheduling/read-only-notice";
import { formatLongDate, formatTime, toLocalDateKey } from "@/lib/datetime";
import { formatDuration, formatMoney } from "@/lib/format";
import { isSupabaseConfigured } from "@/lib/supabase/env";
import { parseAgendaParams } from "@/modules/appointments/schemas";
import { getIncidentDay, listColleagues, listIncomingReassignments } from "@/modules/incidents/queries";
import { requireMyProfessional } from "@/modules/professionals/context";
import { listServices } from "@/modules/services/queries";

export const metadata: Metadata = { title: "Imprevistos" };

export default async function ImprevistosPage({ searchParams }: PageProps<"/profesional/imprevistos">) {
  const params = await searchParams;

  if (!isSupabaseConfigured()) {
    return (
      <div className="mx-auto max-w-3xl">
        <PageHeader title="Imprevistos" description="Disponible al conectar Supabase: actúa sobre citas reales y no tiene datos de demostración." />
      </div>
    );
  }

  const { supabase, ctx } = await requireMyProfessional();
  if (!ctx) return <p className="text-sm text-muted-foreground">No tienes ficha de profesional.</p>;

  const tz = ctx.timeZone;
  const todayKey = toLocalDateKey(new Date(), tz);
  const { dateKey } = parseAgendaParams(params, todayKey);
  const readOnly = ctx.status !== "active";

  const [day, colleagues, incoming, services] = await Promise.all([
    getIncidentDay(supabase, ctx.professionalId, dateKey, tz),
    listColleagues(supabase, ctx.salonId, ctx.professionalId),
    readOnly ? Promise.resolve([]) : listIncomingReassignments(supabase),
    listServices(supabase, ctx.professionalId),
  ]);
  const serviceOptions = services
    .filter((s) => s.isActive)
    .map((s) => ({ value: s.id, label: `${s.name} · ${formatDuration(s.durationMinutes)} · ${formatMoney(s.priceCents, s.currency)}` }));
  const colleagueOptions = colleagues.map((c) => ({ value: c.id, label: c.name }));

  return (
    <div className="mx-auto flex max-w-[1400px] flex-col gap-6">
      <PageHeader title="Gestionar imprevisto" description="Elige la jornada afectada y decide qué hacer con cada cita. Todos los cambios quedan registrados." />
      {readOnly && <ReadOnlyNotice />}

      {incoming.length > 0 && (
        <section className="rounded-2xl border-2 border-lime bg-card p-5 shadow-card sm:p-6" aria-labelledby="incoming-title">
          <h2 id="incoming-title" className="text-base font-bold">
            Te piden atender estas citas
          </h2>
          <ul className="mt-3 divide-y divide-border">
            {incoming.map((r) => (
              <li key={r.request_id} className="py-3">
                <p className="text-sm font-semibold">
                  {formatLongDate(toLocalDateKey(new Date(r.starts_at), tz))} · {formatTime(r.starts_at, tz)}–{formatTime(r.ends_at, tz)}
                </p>
                <p className="text-sm text-muted-foreground">
                  {r.requester_name}: {r.service_name} ({formatMoney(r.price_cents, r.currency)}). Verás al cliente si confirma el cambio.
                </p>
                {r.message && <p className="mt-1 text-sm italic">«{r.message}»</p>}
                <IncomingControls requestId={r.request_id} services={serviceOptions} />
              </li>
            ))}
          </ul>
        </section>
      )}

      <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_360px]">
        <section className="flex flex-col gap-3" aria-labelledby="affected-title">
          <form className="flex items-end gap-2">
            <label className="flex-1 text-sm font-medium">
              Jornada
              <input
                type="date"
                name="fecha"
                defaultValue={dateKey}
                className="mt-2 block h-12 w-full rounded-xl border border-input bg-white px-4 text-base outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 md:text-sm"
              />
            </label>
            <button type="submit" className="h-12 rounded-xl bg-graphite px-4 text-sm font-semibold text-white">
              Ver citas
            </button>
          </form>

          <h2 id="affected-title" className="mt-2 text-base font-bold">
            {formatLongDate(dateKey)} · {day.appointments.length === 0 ? "sin citas activas" : day.appointments.length === 1 ? "1 cita afectada" : `${day.appointments.length} citas afectadas`}
          </h2>

          {day.appointments.length === 0 ? (
            <p className="rounded-2xl border border-dashed border-border bg-card px-6 py-10 text-center text-sm text-muted-foreground">No hay citas activas en esta jornada.</p>
          ) : (
            <ul className="space-y-3">
              {day.appointments.map((a) => {
                const request = day.requests[a.id];
                return (
                  <li key={a.id} className="rounded-2xl border border-border bg-card p-4 shadow-card sm:p-5">
                    <div className="flex items-start gap-3">
                      <span className="text-lg font-extrabold tabular-nums">{formatTime(a.startsAt, tz)}</span>
                      <div className="min-w-0 flex-1">
                        <p className="flex items-center gap-1.5 font-semibold">
                          <UserRound className="size-4 text-muted-foreground" /> {a.clientName}
                        </p>
                        <p className="text-sm text-muted-foreground">{a.serviceName}</p>
                      </div>
                    </div>
                    {request ? (
                      <div className="mt-3 flex flex-wrap items-center justify-between gap-2 rounded-xl bg-amber-50 px-3 py-2 text-sm text-amber-900">
                        <span className="inline-flex items-center gap-2">
                          <Hourglass className="size-4 shrink-0" />
                          {request.type === "reschedule"
                            ? `Propuesta: ${formatLongDate(toLocalDateKey(new Date(request.proposedStartsAt), tz))} a las ${formatTime(request.proposedStartsAt, tz)}. Falta la respuesta del cliente.`
                            : request.status === "pending_target"
                              ? `Reasignación: falta la respuesta de ${request.targetName ?? "tu compañero"}.`
                              : `Reasignación aceptada por ${request.targetName ?? "tu compañero"}. Falta la respuesta del cliente.`}
                        </span>
                        {!readOnly && <WithdrawRequest requestId={request.id} />}
                      </div>
                    ) : (
                      !readOnly && <AppointmentControls appointmentId={a.id} date={dateKey} time={formatTime(a.startsAt, tz)} colleagues={colleagueOptions} />
                    )}
                  </li>
                );
              })}
            </ul>
          )}
        </section>

        {!readOnly && (
          <aside className="rounded-2xl border border-border bg-card p-5 shadow-card sm:p-6 lg:sticky lg:top-24">
            <h2 className="text-base font-bold">Toda la jornada</h2>
            <p className="mt-1 mb-4 text-xs text-muted-foreground">Bloquear evita nuevas reservas ese día; las citas existentes no cambian hasta que decidas.</p>
            <DayControls key={dateKey} date={dateKey} blocked={day.blocked} activeCount={day.appointments.length} />
          </aside>
        )}
      </div>
    </div>
  );
}
