import type { Metadata } from "next";
import { LicenseQuantityForm } from "@/components/admin/license-quantity-form";
import { LicenseUsage, SalonStatusBadge } from "@/components/admin/salon-status";
import { PageHeader } from "@/components/layout/page-header";
import { requireArea } from "@/modules/auth/access";
import { listSalonOverview } from "@/modules/salons/queries";

export const metadata: Metadata = { title: "Profesionales y licencias" };

export default async function AdminLicensesPage() {
  await requireArea("admin");
  const salons = await listSalonOverview();
  const inUse = salons.reduce((sum, s) => sum + s.licenses_in_use, 0);
  const total = salons.reduce((sum, s) => sum + s.license_quantity, 0);

  return (
    <div className="mx-auto flex max-w-[1400px] flex-col gap-6">
      <PageHeader
        title="Profesionales y licencias"
        description={`${inUse} de ${total} licencias en uso. Durante el piloto el cupo se ajusta aquí; con Stripe (Sprint 9) será automático.`}
      />

      {salons.length === 0 ? (
        <p className="rounded-2xl border border-dashed border-border bg-card p-10 text-center text-sm text-muted-foreground">
          Aún no hay establecimientos.
        </p>
      ) : (
        <ul className="space-y-3">
          {salons.map((s) => (
            <li
              key={s.salon_id}
              className="flex flex-wrap items-center gap-x-6 gap-y-3 rounded-2xl border border-border bg-card p-4 shadow-card sm:px-6"
            >
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <p className="truncate font-semibold">{s.name}</p>
                  <SalonStatusBadge status={s.status} />
                </div>
                <p className="truncate text-xs text-muted-foreground">
                  {s.owner_email ?? "Sin propietario"} · {s.professionals}{" "}
                  {s.professionals === 1 ? "profesional" : "profesionales"}
                </p>
              </div>
              <LicenseUsage used={s.licenses_in_use} total={s.license_quantity} />
              <LicenseQuantityForm salonId={s.salon_id} quantity={s.license_quantity} inUse={s.licenses_in_use} />
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
