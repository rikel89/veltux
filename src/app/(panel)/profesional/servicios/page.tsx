import type { Metadata } from "next";
import { Scissors } from "lucide-react";
import { PageHeader } from "@/components/layout/page-header";
import { ReadOnlyNotice } from "@/components/scheduling/read-only-notice";
import { ServiceCard } from "@/components/services/service-card";
import { ServiceForm } from "@/components/services/service-form";
import { isSupabaseConfigured } from "@/lib/supabase/env";
import { requireMyProfessional } from "@/modules/professionals/context";
import { DEMO_SERVICES } from "@/modules/scheduling/demo";
import { listServices, type ServiceItem } from "@/modules/services/queries";

export const metadata: Metadata = { title: "Mis servicios" };

export default async function ServiciosPage() {
  if (!isSupabaseConfigured()) return <ServicesView services={DEMO_SERVICES} demo />;

  const { supabase, ctx } = await requireMyProfessional();
  if (!ctx) return <p className="text-sm text-muted-foreground">No tienes ficha de profesional.</p>;
  const services = await listServices(supabase, ctx.professionalId);
  return <ServicesView services={services} readOnly={ctx.status !== "active"} />;
}

function ServicesView({ services, readOnly = false, demo = false }: { services: ServiceItem[]; readOnly?: boolean; demo?: boolean }) {
  const active = services.filter((s) => s.isActive).length;
  const locked = readOnly || demo;

  return (
    <div className="mx-auto flex max-w-[1400px] flex-col gap-6">
      <PageHeader
        title="Mis servicios"
        description={
          services.length === 0
            ? "Define qué ofreces, cuánto dura y cuánto cuesta. Es tu catálogo: nadie más del establecimiento lo modifica."
            : `${active} ${active === 1 ? "servicio activo" : "servicios activos"}. Duración y precio son tuyos: nadie más del establecimiento los modifica.`
        }
      />
      {readOnly && <ReadOnlyNotice />}

      <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_400px]">
        {services.length === 0 ? (
          <div className="flex flex-col items-center rounded-2xl border border-dashed border-border bg-card px-6 py-14 text-center">
            <span className="grid size-12 place-items-center rounded-2xl bg-graphite text-lime">
              <Scissors className="size-6" />
            </span>
            <p className="mt-4 font-semibold">Aún no tienes servicios</p>
            <p className="mt-1 max-w-sm text-sm text-muted-foreground">
              Añade el primero: sin servicios activos tus clientes no podrán reservar.
            </p>
          </div>
        ) : (
          <ul className="space-y-3" aria-label="Servicios">
            {services.map((service) => (
              <ServiceCard key={service.id} service={service} readOnly={locked} demo={demo} />
            ))}
          </ul>
        )}

        <section className="rounded-2xl border border-border bg-card p-5 shadow-card sm:p-6 lg:sticky lg:top-24">
          <h2 className="text-base font-bold">Nuevo servicio</h2>
          {demo && (
            <p className="mt-1 text-xs text-muted-foreground">En modo demostración los cambios no se guardan.</p>
          )}
          <div className="mt-5">
            <ServiceForm readOnly={locked} />
          </div>
        </section>
      </div>
    </div>
  );
}
