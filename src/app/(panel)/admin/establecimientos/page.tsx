import type { Metadata } from "next";
import Link from "next/link";
import { Plus } from "lucide-react";
import { SalonTable } from "@/components/admin/salon-table";
import { FormMessage } from "@/components/forms/form-status";
import { PageHeader } from "@/components/layout/page-header";
import { Button } from "@/components/ui/button";
import { requireArea } from "@/modules/auth/access";
import { listSalonOverview } from "@/modules/salons/queries";

export const metadata: Metadata = { title: "Establecimientos" };

export default async function SalonsPage({ searchParams }: PageProps<"/admin/establecimientos">) {
  await requireArea("admin");
  const params = await searchParams;
  const created = typeof params.creado === "string" ? params.creado : null;
  const invited = params.invitado === "1";
  const salons = await listSalonOverview();

  return (
    <div className="mx-auto flex max-w-[1400px] flex-col gap-6">
      <PageHeader
        title="Establecimientos"
        description={`${salons.length} ${salons.length === 1 ? "peluquería" : "peluquerías"} en VELTUX`}
        actions={
          <Button asChild size="lg" className="shadow-lime">
            <Link href="/admin/establecimientos/nuevo">
              <Plus /> Nuevo establecimiento
            </Link>
          </Button>
        }
      />
      {created && (
        <FormMessage
          state={{
            ok: true,
            message: invited
              ? `Establecimiento creado. Hemos enviado al propietario un email para crear su contraseña.`
              : `Establecimiento creado y vinculado a una cuenta que ya existía (sin nueva invitación).`,
          }}
        />
      )}
      <SalonTable rows={salons} highlightSlug={created} />
    </div>
  );
}
