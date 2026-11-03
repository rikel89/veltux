import type { Metadata } from "next";
import Link from "next/link";
import { Building2, ChevronRight, KeyRound, Plus, Users } from "lucide-react";
import { SalonTable } from "@/components/admin/salon-table";
import { StatCard } from "@/components/dashboard/stat-card";
import { PageHeader } from "@/components/layout/page-header";
import { Button } from "@/components/ui/button";
import { requireArea } from "@/modules/auth/access";
import { listSalonOverview } from "@/modules/salons/queries";

export const metadata: Metadata = { title: "Administración" };

export default async function AdminDashboardPage() {
  await requireArea("admin");
  const salons = await listSalonOverview();
  const live = salons.filter((s) => s.status === "trial" || s.status === "active");
  const licensesUsed = live.reduce((sum, s) => sum + s.licenses_in_use, 0);
  const licensesTotal = live.reduce((sum, s) => sum + s.license_quantity, 0);
  const professionals = live.reduce((sum, s) => sum + s.professionals, 0);

  return (
    <div className="mx-auto flex max-w-[1400px] flex-col gap-6">
      <PageHeader
        eyebrow="Plataforma VELTUX"
        title="Visión global"
        description="Establecimientos del piloto y uso de licencias."
        actions={
          <Button asChild size="lg" className="shadow-lime">
            <Link href="/admin/establecimientos/nuevo">
              <Plus /> Nuevo establecimiento
            </Link>
          </Button>
        }
      />

      <div className="grid grid-cols-2 gap-3 xl:grid-cols-4 xl:gap-5">
        <StatCard variant="highlight" icon={Building2} label="Establecimientos activos" value={String(live.length)} hint={`${salons.length} en total`} />
        <StatCard icon={KeyRound} label="Licencias en uso" value={`${licensesUsed}/${licensesTotal}`} hint="Sobre las contratadas" />
        <StatCard icon={Users} label="Profesionales" value={String(professionals)} hint="Invitados o activos" />
        <StatCard
          icon={KeyRound}
          label="Licencias libres"
          value={String(Math.max(0, licensesTotal - licensesUsed))}
          hint="Disponibles para asignar"
        />
      </div>

      <section className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-base font-bold">Últimas altas</h2>
          <Link
            href="/admin/establecimientos"
            className="inline-flex items-center gap-1 rounded-lg px-2 py-1 text-sm font-semibold text-lime-ink hover:bg-lime-soft"
          >
            Ver todos <ChevronRight className="size-4" />
          </Link>
        </div>
        <SalonTable rows={salons.slice(0, 5)} />
      </section>
    </div>
  );
}
