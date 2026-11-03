import type { Metadata } from "next";
import { PageHeader } from "@/components/layout/page-header";
import { createClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/supabase/env";
import { requireArea } from "@/modules/auth/access";
import { getMyProfessionalProfile } from "@/modules/professionals/queries";
import { ProfileForm } from "./profile-form";

export const metadata: Metadata = { title: "Mi perfil" };

export default async function ProfilePage() {
  if (!isSupabaseConfigured()) {
    return (
      <div className="mx-auto max-w-3xl">
        <PageHeader title="Mi perfil" description="Disponible al conectar Supabase (sin datos de demostración editables)." />
      </div>
    );
  }

  const access = await requireArea("professional");
  const profile = access.userId ? await getMyProfessionalProfile(await createClient(), access.userId) : null;
  if (!profile) return <p className="text-sm text-muted-foreground">No tienes ficha de profesional.</p>;

  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-6">
      <PageHeader
        title="Mi perfil"
        description="Así te verán tus clientes en la página de reservas."
      />
      <ProfileForm profile={profile} />
    </div>
  );
}
