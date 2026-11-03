import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { PageHeader } from "@/components/layout/page-header";
import { requireArea } from "@/modules/auth/access";
import { NewSalonForm } from "./new-salon-form";

export const metadata: Metadata = { title: "Nuevo establecimiento" };

export default async function NewSalonPage() {
  await requireArea("admin");
  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-6">
      <Link
        href="/admin/establecimientos"
        className="inline-flex w-fit items-center gap-1.5 text-sm font-semibold text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="size-4" /> Establecimientos
      </Link>
      <PageHeader
        title="Nuevo establecimiento"
        description="El propietario recibirá un email para crear su contraseña. Todo se crea en una única operación."
      />
      <NewSalonForm />
    </div>
  );
}
