import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { ChevronRight, MapPin } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { initials } from "@/lib/format";
import { getPublicSalon } from "@/modules/booking/server";

export const metadata: Metadata = { title: "Reservar cita" };

export default function SalonPage({ params }: PageProps<"/[salon]">) {
  return (
    <Suspense fallback={<Skeleton className="h-72 rounded-2xl" />}>
      <SalonContent params={params} />
    </Suspense>
  );
}

async function SalonContent({ params }: { params: PageProps<"/[salon]">["params"] }) {
  const { salon: slug } = await params;
  const salon = await getPublicSalon(slug);
  if (!salon) notFound();

  return (
    <>
      <p className="text-sm font-medium text-muted-foreground">Reserva tu cita en</p>
      <h1 className="mt-1 text-3xl font-extrabold tracking-tight">{salon.name}</h1>
      {(salon.address_line || salon.city) && (
        <p className="mt-2 flex items-center gap-1 text-sm text-muted-foreground">
          <MapPin className="size-4" /> {[salon.address_line, salon.city].filter(Boolean).join(", ")}
        </p>
      )}

      <h2 className="mt-8 text-base font-bold">Elige profesional</h2>
      {salon.professionals.length === 0 ? (
        <p className="mt-3 rounded-2xl border border-dashed border-border bg-card px-4 py-8 text-center text-sm text-muted-foreground">
          Ahora mismo no hay agendas abiertas para reservar online.
        </p>
      ) : (
        <ul className="mt-3 space-y-2">
          {salon.professionals.map((p) => (
            <li key={p.id}>
              <Link
                href={`/${salon.slug}/${p.slug}`}
                className="flex items-center gap-4 rounded-2xl border border-border bg-card p-4 shadow-card transition hover:border-graphite"
              >
                <span
                  className="grid size-12 shrink-0 place-items-center rounded-xl font-extrabold text-graphite"
                  style={{ backgroundColor: p.color }}
                  aria-hidden
                >
                  {initials(p.display_name)}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="font-semibold">{p.display_name}</p>
                  <p className="text-xs text-muted-foreground">
                    {p.services.length === 1 ? "1 servicio" : `${p.services.length} servicios`}
                  </p>
                </div>
                <ChevronRight className="size-5 text-muted-foreground" />
              </Link>
            </li>
          ))}
        </ul>
      )}
    </>
  );
}
