import type { Metadata } from "next";
import { AccountSecurity } from "@/components/forms/account-security";
import { PageHeader } from "@/components/layout/page-header";
import { ownerSalon, requireArea } from "@/modules/auth/access";
import { getOwnerSalonSummary } from "@/modules/salons/queries";
import { SalonSettingsForm } from "./salon-settings-form";

export const metadata: Metadata = { title: "Configuración del establecimiento" };

export default async function OwnerSettingsPage() {
  const access = await requireArea("owner");
  const membership = ownerSalon(access);
  const summary = membership ? await getOwnerSalonSummary(membership.salonId) : null;
  if (!summary) return <p className="text-sm text-muted-foreground">No se encontró tu establecimiento.</p>;

  const s = summary.salon;
  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-6">
      <PageHeader
        title="Configuración"
        description={`Datos de ${s.name}. La dirección de reservas (veltux.es/${s.slug}) la gestiona VELTUX.`}
      />
      <SalonSettingsForm
        defaults={{
          name: s.name,
          kind: s.kind,
          timezone: s.timezone,
          phone: s.phone ?? "",
          email: s.email ?? "",
          addressLine: s.address_line ?? "",
          city: s.city ?? "",
          postalCode: s.postal_code ?? "",
        }}
      />
      <AccountSecurity email={access.email} />
    </div>
  );
}
