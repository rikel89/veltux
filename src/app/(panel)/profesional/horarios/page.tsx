import type { Metadata } from "next";
import { connection } from "next/server";
import { PageHeader } from "@/components/layout/page-header";
import { ExceptionForm } from "@/components/scheduling/exception-form";
import { ExceptionList, type ExceptionRow } from "@/components/scheduling/exception-list";
import { ReadOnlyNotice } from "@/components/scheduling/read-only-notice";
import { SlotPreview } from "@/components/scheduling/slot-preview";
import { WeeklyScheduleEditor } from "@/components/scheduling/weekly-schedule-editor";
import { DEFAULT_TIMEZONE, toLocalDateKey } from "@/lib/datetime";
import { formatDuration } from "@/lib/format";
import { isSupabaseConfigured } from "@/lib/supabase/env";
import { requireMyProfessional } from "@/modules/professionals/context";
import { DEMO_SERVICES, DEMO_WEEKLY_SCHEDULE } from "@/modules/scheduling/demo";
import { describeExceptionWhen, EXCEPTION_LABEL } from "@/modules/scheduling/format";
import type { WeeklyScheduleSlot } from "@/modules/scheduling/occupancy";
import { getWeeklySchedule, listUpcomingExceptions } from "@/modules/scheduling/queries";
import { listServices, type ServiceItem } from "@/modules/services/queries";

export const metadata: Metadata = { title: "Mis horarios" };

export default async function HorariosPage() {
  if (!isSupabaseConfigured()) {
    await connection();
    return (
      <HorariosView
        todayKey={toLocalDateKey(new Date(), DEFAULT_TIMEZONE)}
        schedule={DEMO_WEEKLY_SCHEDULE}
        exceptions={[]}
        services={DEMO_SERVICES}
        demo
      />
    );
  }

  const { supabase, ctx } = await requireMyProfessional();
  if (!ctx) return <p className="text-sm text-muted-foreground">No tienes ficha de profesional.</p>;

  const now = new Date();
  const todayKey = toLocalDateKey(now, ctx.timeZone);
  const [schedule, exceptions, services] = await Promise.all([
    getWeeklySchedule(supabase, ctx.professionalId, todayKey),
    listUpcomingExceptions(supabase, ctx.professionalId, now),
    listServices(supabase, ctx.professionalId),
  ]);

  return (
    <HorariosView
      todayKey={todayKey}
      schedule={schedule}
      exceptions={exceptions.map((e) => ({
        id: e.id,
        type: e.type,
        label: EXCEPTION_LABEL[e.type],
        when: describeExceptionWhen(e, ctx.timeZone),
        reason: e.reason,
      }))}
      services={services}
      readOnly={ctx.status !== "active"}
      bookable={ctx.hasActiveLicense}
    />
  );
}

function HorariosView({
  todayKey,
  schedule,
  exceptions,
  services,
  readOnly = false,
  demo = false,
  bookable = true,
}: {
  todayKey: string;
  schedule: WeeklyScheduleSlot[];
  exceptions: ExceptionRow[];
  services: ServiceItem[];
  readOnly?: boolean;
  demo?: boolean;
  bookable?: boolean;
}) {
  const locked = readOnly || demo;

  return (
    <div className="mx-auto flex max-w-[1400px] flex-col gap-6">
      <PageHeader
        title="Mis horarios"
        description="Tu horario semanal, días libres y bloqueos. Con ellos se calculan los huecos que ven tus clientes."
      />
      {readOnly && <ReadOnlyNotice />}
      {demo && (
        <p className="rounded-xl border border-dashed border-border bg-card px-4 py-3 text-sm text-muted-foreground">
          Modo demostración: puedes probar el editor, pero los cambios no se guardan.
        </p>
      )}

      <div className="grid items-start gap-6 xl:grid-cols-[minmax(0,1fr)_420px]">
        <section aria-labelledby="weekly-title">
          <h2 id="weekly-title" className="mb-3 text-base font-bold">
            Horario semanal
          </h2>
          <WeeklyScheduleEditor initial={schedule} readOnly={readOnly} demo={demo} />
        </section>

        <div className="flex flex-col gap-6">
          <section className="rounded-2xl border border-border bg-card p-5 shadow-card sm:p-6" aria-labelledby="exc-title">
            <h2 id="exc-title" className="text-base font-bold">
              Días libres y bloqueos
            </h2>
            <div className="mt-2">
              <ExceptionList rows={exceptions} readOnly={locked} />
            </div>
            <div className="mt-4 border-t border-border pt-5">
              <ExceptionForm todayKey={todayKey} readOnly={locked} />
            </div>
          </section>

          <section className="rounded-2xl border border-border bg-card p-5 shadow-card sm:p-6" aria-labelledby="preview-title">
            <h2 id="preview-title" className="text-base font-bold">
              Comprobar disponibilidad
            </h2>
            <p className="mt-1 mb-4 text-xs text-muted-foreground">
              {bookable
                ? "Los huecos que verá un cliente al reservar. Es solo una consulta: no se reserva nada."
                : "Sin licencia activa no recibes reservas: pide al propietario que te asigne una."}
            </p>
            <SlotPreview
              todayKey={todayKey}
              disabled={demo || !bookable}
              services={services
                .filter((s) => s.isActive)
                .map((s) => ({ id: s.id, label: `${s.name} · ${formatDuration(s.durationMinutes)}` }))}
            />
          </section>
        </div>
      </div>
    </div>
  );
}
