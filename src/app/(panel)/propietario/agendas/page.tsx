import type { Metadata } from "next";
import Link from "next/link";
import { CalendarRange, ChevronLeft, ChevronRight, Clock, Lock } from "lucide-react";
import { StatCard } from "@/components/dashboard/stat-card";
import { Button } from "@/components/ui/button";
import { addDays, DEFAULT_TIMEZONE, formatLongDate, LOCALE, startOfIsoWeek, toLocalDateKey } from "@/lib/datetime";
import { formatDuration } from "@/lib/format";
import { cn } from "@/lib/utils";
import { ownerSalon, requireArea } from "@/modules/auth/access";
import { dateKeySchema, WEEKDAYS } from "@/modules/scheduling/schemas";
import { buildDayColumns, buildLoads, columnsHourRange, type DayColumn } from "@/modules/salons/overview";
import { getSalonOverview } from "@/modules/salons/overview-queries";

export const metadata: Metadata = { title: "Vista de agendas" };

const HOUR_PX = 56;

function loadClass(pct: number | null): string {
  if (pct === null) return "bg-surface text-muted-foreground";
  if (pct >= 85) return "bg-graphite text-lime";
  if (pct >= 50) return "bg-lime text-graphite";
  if (pct > 0) return "bg-lime-soft text-lime-ink";
  return "bg-white text-muted-foreground";
}

const duration = (minutes: number) => (minutes === 0 ? "0 h" : formatDuration(minutes));
const hhmm = (min: number) => `${String(Math.floor(min / 60)).padStart(2, "0")}:${String(min % 60).padStart(2, "0")}`;

export default async function OwnerAgendasPage({ searchParams }: PageProps<"/propietario/agendas">) {
  const membership = ownerSalon(await requireArea("owner"));
  if (!membership) return <p className="text-sm text-muted-foreground">No se encontró tu establecimiento.</p>;

  const params = await searchParams;
  const provisional = toLocalDateKey(new Date(), DEFAULT_TIMEZONE);
  const fecha = typeof params.fecha === "string" && dateKeySchema.safeParse(params.fecha).success ? params.fecha : provisional;
  const view = params.vista === "dia" ? "dia" : "semana";
  const dayKeys = view === "dia" ? [fecha] : Array.from({ length: 7 }, (_, i) => addDays(startOfIsoWeek(fecha), i));

  const data = await getSalonOverview(membership.salonId, dayKeys);
  if (!data) return <p className="text-sm text-muted-foreground">No se encontró tu establecimiento.</p>;

  const todayKey = toLocalDateKey(new Date(), data.timeZone);
  const { loads, totals } = buildLoads(data.professionals, dayKeys, data.schedule, data.spans, data.timeZone);
  const href = (key: string, v = view) => `/propietario/agendas?fecha=${key}&vista=${v}`;
  const step = view === "dia" ? 1 : 7;
  const shortDate = (key: string) =>
    new Intl.DateTimeFormat(LOCALE, { timeZone: "UTC", day: "numeric", month: "short" }).format(new Date(`${key}T12:00:00Z`));
  const title = view === "dia" ? formatLongDate(fecha) : `Semana del ${shortDate(dayKeys[0])} al ${shortDate(dayKeys[6])}`;

  return (
    <div className="mx-auto flex max-w-[1400px] flex-col gap-5">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <h1 className="text-2xl font-extrabold tracking-tight sm:text-3xl">Vista de agendas</h1>
          <p className="mt-1 text-sm text-muted-foreground">{title}</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex items-center rounded-xl border border-border bg-card p-1 shadow-card">
            <Button asChild variant="ghost" size="icon" className="size-9">
              <Link href={href(addDays(fecha, -step))} aria-label={view === "dia" ? "Día anterior" : "Semana anterior"}>
                <ChevronLeft />
              </Link>
            </Button>
            <Button asChild variant="ghost" size="sm" className="h-9 px-3">
              <Link href={href(todayKey)}>Hoy</Link>
            </Button>
            <Button asChild variant="ghost" size="icon" className="size-9">
              <Link href={href(addDays(fecha, step))} aria-label={view === "dia" ? "Día siguiente" : "Semana siguiente"}>
                <ChevronRight />
              </Link>
            </Button>
          </div>
          <nav aria-label="Vista" className="flex rounded-xl border border-border bg-card p-1 shadow-card">
            {(["dia", "semana"] as const).map((v) => (
              <Link
                key={v}
                href={href(fecha, v)}
                aria-current={view === v ? "page" : undefined}
                className={cn("rounded-lg px-3 py-1.5 text-sm font-semibold", view === v ? "bg-graphite text-white" : "text-muted-foreground hover:text-foreground")}
              >
                {v === "dia" ? "Día" : "Semana"}
              </Link>
            ))}
          </nav>
        </div>
      </div>

      <p className="flex items-center gap-2 text-xs text-muted-foreground">
        <Lock className="size-3.5 shrink-0" /> Solo ves si cada franja está ocupada. Clientes, servicios y motivos son privados de cada profesional, y no puedes modificar sus citas.
      </p>

      <div className="grid grid-cols-2 gap-3 xl:grid-cols-3 xl:gap-5">
        <StatCard variant="highlight" icon={CalendarRange} label="Ocupación" value={totals.percentage === null ? "—" : `${totals.percentage}%`} hint={view === "dia" ? "En el día" : "En la semana"} />
        <StatCard icon={Clock} label="Tiempo reservado" value={duration(totals.bookedMinutes)} hint={`De ${duration(totals.availableMinutes)} disponibles`} />
        <StatCard icon={Clock} label="Tiempo libre" value={duration(totals.freeMinutes)} hint="Aún sin reservar" />
      </div>

      {loads.length === 0 ? (
        <p className="rounded-2xl border border-dashed border-border bg-card px-6 py-12 text-center text-sm text-muted-foreground">
          Aún no hay profesionales activos.{" "}
          <Link href="/propietario/profesionales" className="font-semibold text-lime-ink hover:underline">
            Invita al primero
          </Link>
        </p>
      ) : view === "semana" ? (
        <section className="overflow-x-auto rounded-2xl border border-border bg-card shadow-card" aria-label="Ocupación semanal por profesional">
          <table className="w-full min-w-[720px] border-collapse text-sm">
            <thead>
              <tr className="border-b border-border">
                <th scope="col" className="px-4 py-3 text-left font-semibold">
                  Profesional
                </th>
                {dayKeys.map((key, i) => (
                  <th key={key} scope="col" className="px-1 py-3 text-center text-xs font-medium text-muted-foreground">
                    <Link href={href(key, "dia")} className={cn("hover:text-foreground", key === todayKey && "font-bold text-lime-ink")}>
                      {WEEKDAYS[i].short} {Number(key.slice(8))}
                    </Link>
                  </th>
                ))}
                <th scope="col" className="px-4 py-3 text-right text-xs font-semibold">
                  Semana
                </th>
              </tr>
            </thead>
            <tbody>
              {loads.map((load) => (
                <tr key={load.professionalId} className="border-b border-border last:border-0">
                  <th scope="row" className="px-4 py-3 text-left font-semibold">
                    {load.name}
                  </th>
                  {load.days.map((day) => (
                    <td key={day.dateKey} className="p-1 text-center">
                      <Link
                        href={href(day.dateKey, "dia")}
                        title={day.percentage === null ? "Sin horario" : `${duration(day.bookedMinutes)} de ${duration(day.availableMinutes)}`}
                        className={cn("block rounded-lg border border-border py-2.5 text-xs font-bold tabular-nums", loadClass(day.percentage))}
                      >
                        {day.percentage === null ? "—" : `${day.percentage}%`}
                      </Link>
                    </td>
                  ))}
                  <td className="px-4 py-3 text-right font-extrabold tabular-nums">{load.percentage === null ? "—" : `${load.percentage}%`}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      ) : (
        <DayGrid columns={buildDayColumns(data.professionals, fecha, data.schedule, data.spans, data.timeZone)} loads={loads.map((l) => l.days[0].percentage)} />
      )}
    </div>
  );
}

function DayGrid({ columns, loads }: { columns: DayColumn[]; loads: (number | null)[] }) {
  const { startHour, endHour } = columnsHourRange(columns);
  const hours = Array.from({ length: endHour - startHour }, (_, i) => startHour + i);
  const y = (min: number) => ((min - startHour * 60) * HOUR_PX) / 60;
  const h = (s: { startMin: number; endMin: number }) => Math.max(((s.endMin - s.startMin) * HOUR_PX) / 60, 16);

  return (
    <section className="overflow-x-auto rounded-2xl border border-border bg-card shadow-card" aria-label="Ocupación del día por profesional">
      <div style={{ minWidth: Math.max(320, 48 + columns.length * 150) }}>
        <div className="flex border-b border-border">
          <div className="w-12 shrink-0" />
          {columns.map((c, i) => (
            <div key={c.professionalId} className="flex-1 border-l border-border px-2 py-3 text-center">
              <p className="truncate text-sm font-semibold">{c.name}</p>
              <p className="text-xs text-muted-foreground tabular-nums">{loads[i] === null ? "Sin horario" : `${loads[i]}% ocupado`}</p>
            </div>
          ))}
        </div>
        <div className="flex py-3 pr-2" style={{ height: hours.length * HOUR_PX + 24 }}>
          <div className="relative w-12 shrink-0" aria-hidden>
            {hours.map((hour) => (
              <span key={hour} className="absolute right-2 -translate-y-1/2 text-[11px] text-muted-foreground tabular-nums" style={{ top: y(hour * 60) }}>
                {hour > startHour && hhmm(hour * 60)}
              </span>
            ))}
          </div>
          {columns.map((c) => (
            <div key={c.professionalId} className="relative flex-1 border-l border-border bg-surface">
              {c.windows.map((w, i) => (
                <div key={i} className="absolute inset-x-0 bg-white" style={{ top: y(w.startMin), height: h(w) }} />
              ))}
              {hours.map((hour) => (
                <div key={hour} className="absolute inset-x-0 border-t border-border/70" style={{ top: y(hour * 60) }} />
              ))}
              {c.unavailable.map((s, i) => (
                <div
                  key={i}
                  className="absolute inset-x-0 bg-[repeating-linear-gradient(135deg,var(--color-muted)_0_6px,transparent_6px_12px)] px-2 py-1"
                  style={{ top: y(s.startMin), height: h(s) }}
                >
                  <span className="rounded bg-white/90 px-1.5 text-[10px] font-semibold text-muted-foreground">No disponible</span>
                </div>
              ))}
              {c.busy.map((s, i) => (
                <div
                  key={i}
                  className="absolute inset-x-1 overflow-hidden rounded-md border-l-4 border-lime-ink bg-lime-soft px-2 py-0.5 text-[11px] font-semibold text-graphite tabular-nums"
                  style={{ top: y(s.startMin) + 1, height: h(s) - 2 }}
                >
                  {hhmm(s.startMin)}–{hhmm(s.endMin)}
                </div>
              ))}
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
