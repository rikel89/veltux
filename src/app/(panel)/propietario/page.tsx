import type { Metadata } from "next";
import Link from "next/link";
import { connection } from "next/server";
import { CalendarRange, KeyRound, Settings, ShieldCheck, Users } from "lucide-react";
import { StatCard } from "@/components/dashboard/stat-card";
import { CopyBookingLink } from "@/components/dashboard/copy-booking-link";
import { PageHeader } from "@/components/layout/page-header";
import { Button } from "@/components/ui/button";
import { initials } from "@/lib/format";
import { ownerSalon, requireArea } from "@/modules/auth/access";
import { buildLoads } from "@/modules/salons/overview";
import { currentWeekKeys, getSalonOverview } from "@/modules/salons/overview-queries";
import { getOwnerSalonSummary } from "@/modules/salons/queries";

export const metadata: Metadata = { title: "Mi establecimiento" };

const PRO_STATUS: Record<string, string> = { invited: "Invitado", active: "Activo", inactive: "Inactivo" };
const longDate = new Intl.DateTimeFormat("es-ES", { day: "numeric", month: "long", year: "numeric" });

export default async function OwnerDashboardPage() {
  const membership = ownerSalon(await requireArea("owner"));
  const summary = membership ? await getOwnerSalonSummary(membership.salonId) : null;
  if (!summary) {
    return <p className="text-sm text-muted-foreground">No se encontró tu establecimiento.</p>;
  }

  const { salon, subscription, licensesInUse, professionals } = summary;
  const quantity = subscription?.license_quantity ?? 0;

  await connection(); // la semana en curso depende de la fecha actual
  const weekKeys = currentWeekKeys(new Date(), salon.timezone);
  const overview = await getSalonOverview(salon.id, weekKeys);
  const weekTotals = overview
    ? buildLoads(overview.professionals, weekKeys, overview.schedule, overview.spans, overview.timeZone).totals
    : null;

  return (
    <div className="mx-auto flex max-w-[1400px] flex-col gap-6">
      <PageHeader
        eyebrow="Mi establecimiento"
        title={salon.name}
        description={[salon.city, salon.address_line].filter(Boolean).join(" · ") || undefined}
        actions={
          <Button asChild variant="outline" size="lg" className="bg-white">
            <Link href="/propietario/configuracion">
              <Settings /> Configuración
            </Link>
          </Button>
        }
      />

      <div className="grid grid-cols-2 gap-3 xl:grid-cols-4 xl:gap-5">
        <StatCard
          variant="highlight"
          icon={KeyRound}
          label="Licencias en uso"
          value={`${licensesInUse}/${quantity}`}
          hint={quantity - licensesInUse > 0 ? `${quantity - licensesInUse} libres` : "Cupo completo"}
        />
        <StatCard icon={Users} label="Profesionales" value={String(professionals.length)} hint="En tu establecimiento" />
        <StatCard
          icon={ShieldCheck}
          label="Plan"
          value={subscription?.plan === "pilot" ? "Piloto" : (subscription?.plan ?? "—")}
          hint={
            subscription?.trial_ends_at
              ? `Prueba hasta el ${longDate.format(new Date(subscription.trial_ends_at))}`
              : undefined
          }
        />
        <StatCard
          icon={CalendarRange}
          label="Ocupación esta semana"
          value={weekTotals?.percentage === null || !weekTotals ? "—" : `${weekTotals.percentage}%`}
          hint={weekTotals && weekTotals.availableMinutes > 0 ? "De todas las agendas" : "Sin horarios publicados"}
        />
      </div>

      <div className="grid gap-5 lg:grid-cols-3 lg:gap-6">
        <section className="rounded-2xl border border-border bg-card shadow-card lg:col-span-2" aria-labelledby="equipo">
          <header className="border-b border-border px-5 py-4 sm:px-6">
            <h2 id="equipo" className="text-base font-bold">
              Equipo
            </h2>
            <p className="text-xs text-muted-foreground">
              Ves el estado de cada profesional, nunca su cartera de clientes ni sus citas.
            </p>
          </header>
          {professionals.length === 0 ? (
            <p className="px-6 py-10 text-center text-sm text-muted-foreground">
              Aún no hay profesionales.{" "}
              <Link href="/propietario/profesionales" className="font-semibold text-lime-ink hover:underline">
                Invita al primero
              </Link>
            </p>
          ) : (
            <ul className="divide-y divide-border">
              {professionals.map((p) => (
                <li key={p.id} className="flex items-center gap-3 px-5 py-3.5 sm:px-6">
                  <span className="grid size-9 place-items-center rounded-full bg-graphite text-xs font-bold text-lime">
                    {initials(p.displayName)}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-semibold">{p.displayName}</p>
                    <p className="text-xs text-muted-foreground">{PRO_STATUS[p.status] ?? p.status}</p>
                  </div>
                  <span
                    className={
                      p.hasLicense
                        ? "rounded-full bg-lime-soft px-2 py-0.5 text-[11px] font-semibold text-lime-ink"
                        : "rounded-full bg-muted px-2 py-0.5 text-[11px] font-semibold text-muted-foreground"
                    }
                  >
                    {p.hasLicense ? "Con licencia" : "Sin licencia"}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className="rounded-2xl bg-graphite p-5 text-white sm:p-6" aria-labelledby="enlace">
          <h2 id="enlace" className="text-sm font-semibold text-neutral-300">
            Página de reservas del establecimiento
          </h2>
          <CopyBookingLink path={`/${salon.slug}`} />
          <p className="mt-3 text-xs text-neutral-500">
            Tus clientes eligen profesional, servicio y hora, y confirman la reserva con un código por email.
          </p>
        </section>
      </div>
    </div>
  );
}
