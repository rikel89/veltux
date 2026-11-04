import type { Metadata } from "next";
import Link from "next/link";
import { Building2, CalendarCheck, Globe, Users } from "lucide-react";
import { z } from "zod";
import { SalonStatusBadge } from "@/components/admin/salon-status";
import { StatCard } from "@/components/dashboard/stat-card";
import { PageHeader } from "@/components/layout/page-header";
import { createClient } from "@/lib/supabase/server";
import { cn } from "@/lib/utils";
import { requireArea } from "@/modules/auth/access";
import type { SalonStatus } from "@/types/database";

export const metadata: Metadata = { title: "Estadísticas" };

const PERIODS = [7, 30, 90] as const;

const statsSchema = z.object({
  salons_live: z.number(),
  professionals_active: z.number(),
  clients: z.number(),
  appointments: z.object({ total: z.number(), online: z.number(), completed: z.number(), cancelled: z.number(), no_show: z.number() }),
  notifications: z.object({ pending: z.number(), sent: z.number(), delivered: z.number(), failed: z.number() }),
  salons: z.array(z.object({ id: z.string(), name: z.string(), status: z.string(), professionals: z.number(), appointments: z.number(), online: z.number() })),
});

const share = (part: number, total: number) => (total === 0 ? "—" : `${Math.round((part / total) * 100)}%`);

export default async function AdminStatsPage({ searchParams }: PageProps<"/admin/estadisticas">) {
  await requireArea("admin");
  const params = await searchParams;
  const days = PERIODS.find((d) => String(d) === params.dias) ?? 30;

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("admin_platform_stats", { p_days: days });
  if (error) throw error;
  const stats = statsSchema.parse(data);
  const a = stats.appointments;
  const n = stats.notifications;

  return (
    <div className="mx-auto flex max-w-[1400px] flex-col gap-6">
      <PageHeader
        eyebrow="Plataforma VELTUX"
        title="Estadísticas"
        description="Cifras agregadas del piloto. Nunca incluyen clientes ni citas individuales."
        actions={
          <nav aria-label="Periodo" className="flex rounded-xl border border-border bg-card p-1 shadow-card">
            {PERIODS.map((d) => (
              <Link
                key={d}
                href={`/admin/estadisticas?dias=${d}`}
                aria-current={d === days ? "page" : undefined}
                className={cn("rounded-lg px-3 py-1.5 text-sm font-semibold", d === days ? "bg-graphite text-white" : "text-muted-foreground hover:text-foreground")}
              >
                {d} días
              </Link>
            ))}
          </nav>
        }
      />

      <div className="grid grid-cols-2 gap-3 xl:grid-cols-4 xl:gap-5">
        <StatCard variant="highlight" icon={CalendarCheck} label="Citas creadas" value={String(a.total)} hint={`Últimos ${days} días`} />
        <StatCard icon={Globe} label="Reservas online" value={share(a.online, a.total)} hint={`${a.online} de ${a.total}`} />
        <StatCard icon={Building2} label="Establecimientos" value={String(stats.salons_live)} hint="Activos o en prueba" />
        <StatCard icon={Users} label="Profesionales" value={String(stats.professionals_active)} hint={`${stats.clients} clientes en total`} />
      </div>

      <div className="grid gap-5 lg:grid-cols-2">
        <section className="rounded-2xl border border-border bg-card p-5 shadow-card sm:p-6" aria-labelledby="estado-citas">
          <h2 id="estado-citas" className="text-base font-bold">
            Resultado de las citas
          </h2>
          <dl className="mt-4 divide-y divide-border text-sm">
            {[
              { label: "Completadas", value: a.completed },
              { label: "Canceladas", value: a.cancelled },
              { label: "No se presentó", value: a.no_show },
            ].map((row) => (
              <div key={row.label} className="flex justify-between gap-4 py-2.5">
                <dt className="text-muted-foreground">{row.label}</dt>
                <dd className="font-semibold tabular-nums">
                  {row.value} <span className="ml-2 font-normal text-muted-foreground">{share(row.value, a.total)}</span>
                </dd>
              </div>
            ))}
          </dl>
        </section>

        <section className="rounded-2xl border border-border bg-card p-5 shadow-card sm:p-6" aria-labelledby="estado-avisos">
          <h2 id="estado-avisos" className="text-base font-bold">
            Avisos a clientes
          </h2>
          <dl className="mt-4 divide-y divide-border text-sm">
            {[
              { label: "Pendientes", value: n.pending },
              { label: "Enviadas", value: n.sent },
              { label: "Entregadas", value: n.delivered },
              { label: "Fallidas", value: n.failed },
            ].map((row) => (
              <div key={row.label} className="flex justify-between gap-4 py-2.5">
                <dt className="text-muted-foreground">{row.label}</dt>
                <dd className="font-semibold tabular-nums">{row.value}</dd>
              </div>
            ))}
          </dl>
        </section>
      </div>

      <section className="overflow-x-auto rounded-2xl border border-border bg-card shadow-card" aria-labelledby="por-establecimiento">
        <h2 id="por-establecimiento" className="border-b border-border px-5 py-4 text-base font-bold">
          Por establecimiento
        </h2>
        {stats.salons.length === 0 ? (
          <p className="px-5 py-10 text-center text-sm text-muted-foreground">Aún no hay establecimientos.</p>
        ) : (
          <table className="w-full min-w-[520px] text-sm">
            <thead>
              <tr className="border-b border-border text-left text-xs text-muted-foreground">
                <th scope="col" className="px-5 py-2.5 font-medium">Establecimiento</th>
                <th scope="col" className="px-3 py-2.5 text-right font-medium">Profesionales</th>
                <th scope="col" className="px-3 py-2.5 text-right font-medium">Citas</th>
                <th scope="col" className="px-5 py-2.5 text-right font-medium">Online</th>
              </tr>
            </thead>
            <tbody>
              {stats.salons.map((s) => (
                <tr key={s.id} className="border-b border-border last:border-0">
                  <th scope="row" className="px-5 py-3 text-left font-semibold">
                    <span className="mr-2">{s.name}</span>
                    <SalonStatusBadge status={s.status as SalonStatus} />
                  </th>
                  <td className="px-3 py-3 text-right tabular-nums">{s.professionals}</td>
                  <td className="px-3 py-3 text-right tabular-nums">{s.appointments}</td>
                  <td className="px-5 py-3 text-right tabular-nums">{s.online}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>
    </div>
  );
}
