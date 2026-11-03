import type { Metadata } from "next";
import { connection } from "next/server";
import { AgendaBoard } from "@/components/agenda/agenda-board";
import { ReadOnlyNotice } from "@/components/scheduling/read-only-notice";
import { addDays, DEFAULT_TIMEZONE, formatLongDate, LOCALE, startOfIsoWeek, toLocalDateKey, zonedTimeToUtc } from "@/lib/datetime";
import { formatDuration } from "@/lib/format";
import { isSupabaseConfigured } from "@/lib/supabase/env";
import { type AgendaAppointment, buildAgendaDays, minuteOfDay } from "@/modules/appointments/agenda";
import { listAgendaAppointments, listAgendaExceptions } from "@/modules/appointments/queries";
import { parseAgendaParams, type AgendaView } from "@/modules/appointments/schemas";
import { buildDemoDashboard } from "@/modules/dashboard/demo";
import { requireMyProfessional } from "@/modules/professionals/context";
import { DEMO_SERVICES, DEMO_WEEKLY_SCHEDULE } from "@/modules/scheduling/demo";
import { getWeeklySchedule } from "@/modules/scheduling/queries";
import { WEEKDAYS } from "@/modules/scheduling/schemas";
import { listServices } from "@/modules/services/queries";

export const metadata: Metadata = { title: "Mi agenda" };

function visibleDays(dateKey: string, view: AgendaView): string[] {
  if (view === "dia") return [dateKey];
  const monday = startOfIsoWeek(dateKey);
  return Array.from({ length: 7 }, (_, i) => addDays(monday, i));
}

function rangeTitle(dayKeys: string[], view: AgendaView): string {
  if (view === "dia") return formatLongDate(dayKeys[0]);
  const fmt = (key: string, opts: Intl.DateTimeFormatOptions) =>
    new Intl.DateTimeFormat(LOCALE, { timeZone: "UTC", ...opts }).format(new Date(`${key}T12:00:00Z`));
  return `Semana del ${fmt(dayKeys[0], { day: "numeric", month: "short" })} al ${fmt(dayKeys[6], { day: "numeric", month: "short" })}`;
}

const dayLabels = (dayKeys: string[]) =>
  dayKeys.map((key, i) => ({ dateKey: key, short: WEEKDAYS[i].short, day: String(Number(key.slice(8))) }));

export default async function AgendaPage({ searchParams }: PageProps<"/profesional/agenda">) {
  const params = await searchParams;

  if (!isSupabaseConfigured()) {
    await connection();
    const now = new Date();
    const tz = DEFAULT_TIMEZONE;
    const todayKey = toLocalDateKey(now, tz);
    const { dateKey, view } = parseAgendaParams(params, todayKey);
    const dayKeys = visibleDays(dateKey, view);
    // Citas de ejemplo solo para hoy, marcadas DEMO en la interfaz.
    const demo: AgendaAppointment[] = buildDemoDashboard(now).agenda.map((a) => ({
      ...a,
      clientId: a.id,
      clientPhone: "",
      notes: null,
    }));
    return (
      <AgendaBoard
        view={view}
        title={rangeTitle(dayKeys, view)}
        dateKey={dateKey}
        todayKey={todayKey}
        prevKey={addDays(dateKey, view === "dia" ? -1 : -7)}
        nextKey={addDays(dateKey, view === "dia" ? 1 : 7)}
        days={buildAgendaDays(dayKeys, DEMO_WEEKLY_SCHEDULE, demo, [], tz)}
        dayLabels={dayLabels(dayKeys)}
        services={DEMO_SERVICES.map((s) => ({ id: s.id, label: s.name }))}
        timeZone={tz}
        nowIso={now.toISOString()}
        nowMin={minuteOfDay(now, todayKey, tz)}
        demo
      />
    );
  }

  const { supabase, ctx } = await requireMyProfessional();
  if (!ctx) return <p className="text-sm text-muted-foreground">No tienes ficha de profesional.</p>;

  const tz = ctx.timeZone;
  const now = new Date();
  const todayKey = toLocalDateKey(now, tz);
  const { dateKey, view } = parseAgendaParams(params, todayKey);
  const dayKeys = visibleDays(dateKey, view);
  const from = zonedTimeToUtc(dayKeys[0], "00:00", tz);
  const to = zonedTimeToUtc(addDays(dayKeys[dayKeys.length - 1], 1), "00:00", tz);

  const [appointments, exceptions, schedule, services] = await Promise.all([
    listAgendaAppointments(supabase, ctx.professionalId, from, to),
    listAgendaExceptions(supabase, ctx.professionalId, from, to),
    getWeeklySchedule(supabase, ctx.professionalId, dayKeys[0]),
    listServices(supabase, ctx.professionalId),
  ]);
  const readOnly = ctx.status !== "active";

  return (
    <>
      {readOnly && (
        <div className="mx-auto mb-4 max-w-[1400px]">
          <ReadOnlyNotice />
        </div>
      )}
      <AgendaBoard
        view={view}
        title={rangeTitle(dayKeys, view)}
        dateKey={dateKey}
        todayKey={todayKey}
        prevKey={addDays(dateKey, view === "dia" ? -1 : -7)}
        nextKey={addDays(dateKey, view === "dia" ? 1 : 7)}
        days={buildAgendaDays(dayKeys, schedule, appointments, exceptions, tz)}
        dayLabels={dayLabels(dayKeys)}
        services={services
          .filter((s) => s.isActive)
          .map((s) => ({ id: s.id, label: `${s.name} · ${formatDuration(s.durationMinutes)}` }))}
        timeZone={tz}
        nowIso={now.toISOString()}
        nowMin={minuteOfDay(now, todayKey, tz)}
        readOnly={readOnly}
        openNew={params.nueva === "1"}
      />
    </>
  );
}
