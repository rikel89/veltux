import type { Metadata } from "next";
import { AccountSecurity } from "@/components/forms/account-security";
import { PageHeader } from "@/components/layout/page-header";
import { requireArea } from "@/modules/auth/access";

export const metadata: Metadata = { title: "Configuración" };

export default async function ProfessionalSettingsPage() {
  const access = await requireArea("professional");

  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-6">
      <PageHeader title="Configuración" description="Preferencias de tu cuenta." />
      {access.mode === "demo" ? (
        <p className="rounded-2xl border border-dashed border-border bg-card p-6 text-sm text-muted-foreground">
          Disponible al conectar Supabase.
        </p>
      ) : (
        <AccountSecurity email={access.email} />
      )}
    </div>
  );
}
