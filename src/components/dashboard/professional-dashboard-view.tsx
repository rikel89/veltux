import Link from "next/link";
import { CalendarCheck2, Euro, Gauge, Plus, TriangleAlert, UserPlus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { formatLongDate, greetingFor } from "@/lib/datetime";
import { formatMoney } from "@/lib/format";
import type { ProfessionalDashboard } from "@/modules/dashboard/types";
import { NextAppointmentCard } from "./next-appointment-card";
import { QuickActions } from "./quick-actions";
import { StatCard } from "./stat-card";
import { TodayAgenda } from "./today-agenda";
import { WeekOccupancyCard } from "./week-occupancy-card";

export function ProfessionalDashboardView({ data }: { data: ProfessionalDashboard }) {
  const isDemo = data.mode === "demo";
  const tz = data.professional.timeZone;
  const firstName = data.professional.displayName.split(" ")[0];

  return (
    <div className="mx-auto flex max-w-[1400px] flex-col gap-5 lg:gap-6">
      {/* Cabecera */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-sm font-medium text-muted-foreground">
            {formatLongDate(data.todayKey)} · {data.professional.salonName}
          </p>
          <h1 className="mt-1 text-2xl font-extrabold tracking-tight sm:text-3xl">
            {greetingFor(new Date(data.now), tz)}, {firstName}
          </h1>
        </div>
        <div className="hidden gap-2 sm:flex">
          <Button asChild variant="outline" size="lg" className="bg-white">
            <Link href="/profesional/imprevistos">
              <TriangleAlert /> Gestionar imprevisto
            </Link>
          </Button>
          <Button asChild size="lg" className="shadow-lime">
            <Link href="/profesional/agenda">
              <Plus /> Nueva cita
            </Link>
          </Button>
        </div>
      </div>

      {!data.professional.hasActiveLicense && (
        <div role="alert" className="rounded-2xl border border-amber-200 bg-amber-50 px-5 py-4 text-sm text-amber-900">
          <strong className="font-semibold">Tu licencia no está activa.</strong> Pide al propietario del establecimiento
          que te asigne una licencia para recibir reservas.
        </div>
      )}

      {/* Móvil: la próxima cita es lo primero que se ve */}
      <div className="lg:hidden">
        <NextAppointmentCard appointment={data.nextAppointment} now={data.now} timeZone={tz} isDemo={isDemo} />
      </div>

      {/* Indicadores: carrusel horizontal en móvil, rejilla en escritorio */}
      <div className="-mx-4 flex snap-x snap-mandatory scroll-px-4 gap-3 overflow-x-auto px-4 pb-1 scrollbar-none sm:mx-0 sm:grid sm:grid-cols-2 sm:overflow-visible sm:px-0 xl:grid-cols-4 xl:gap-5">
        <StatCard
          variant="highlight"
          icon={CalendarCheck2}
          label="Citas hoy"
          value={String(data.stats.appointmentsToday)}
          hint={data.nextAppointment ? "Siguiente marcada en tu agenda" : "Sin más citas pendientes"}
          isDemo={isDemo}
        />
        <StatCard
          icon={Euro}
          label="Ingresos previstos hoy"
          value={formatMoney(data.stats.revenueTodayCents)}
          hint="Según el precio de cada servicio"
          isDemo={isDemo}
        />
        <StatCard
          icon={Gauge}
          label="Ocupación semanal"
          value={data.stats.occupancyWeekPct === null ? "—" : `${data.stats.occupancyWeekPct}%`}
          hint={data.stats.occupancyWeekPct === null ? "Configura tu horario" : "Sobre tus horas de trabajo"}
          isDemo={isDemo}
        />
        <StatCard
          icon={UserPlus}
          label="Clientes nuevos"
          value={String(data.stats.newClientsMonth)}
          hint="Este mes"
          isDemo={isDemo}
        />
      </div>

      <div className="grid gap-5 lg:grid-cols-3 lg:gap-6">
        <div className="lg:col-span-2">
          <TodayAgenda
            agenda={data.agenda}
            nextId={data.nextAppointment?.id ?? null}
            now={data.now}
            timeZone={tz}
            isDemo={isDemo}
          />
        </div>
        <div className="flex flex-col gap-5 lg:gap-6">
          <div className="hidden lg:block">
            <NextAppointmentCard appointment={data.nextAppointment} now={data.now} timeZone={tz} isDemo={isDemo} />
          </div>
          <WeekOccupancyCard
            week={data.week}
            todayKey={data.todayKey}
            average={data.stats.occupancyWeekPct}
            isDemo={isDemo}
          />
          <QuickActions salonSlug={data.professional.salonSlug} />
        </div>
      </div>
    </div>
  );
}
