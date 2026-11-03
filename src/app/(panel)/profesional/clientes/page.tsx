import type { Metadata } from "next";
import Link from "next/link";
import { ChevronRight, Lock, Search, Users } from "lucide-react";
import { ClientForm } from "@/components/clients/client-form";
import { PageHeader } from "@/components/layout/page-header";
import { ReadOnlyNotice } from "@/components/scheduling/read-only-notice";
import { formatDate } from "@/lib/format";
import { isSupabaseConfigured } from "@/lib/supabase/env";
import { cn } from "@/lib/utils";
import { listClients } from "@/modules/clients/queries";
import { requireMyProfessional } from "@/modules/professionals/context";

export const metadata: Metadata = { title: "Mis clientes" };

export default async function ClientesPage({ searchParams }: PageProps<"/profesional/clientes">) {
  const params = await searchParams;
  const query = typeof params.q === "string" ? params.q : "";
  const archived = params.archivados === "1";

  if (!isSupabaseConfigured()) {
    return (
      <div className="mx-auto max-w-3xl">
        <PageHeader title="Mis clientes" description="Disponible al conectar Supabase: la cartera de clientes no tiene datos de demostración." />
      </div>
    );
  }

  const { supabase, ctx } = await requireMyProfessional();
  if (!ctx) return <p className="text-sm text-muted-foreground">No tienes ficha de profesional.</p>;
  const clients = await listClients(supabase, ctx.professionalId, { query, archived });
  const readOnly = ctx.status !== "active";

  return (
    <div className="mx-auto flex max-w-[1400px] flex-col gap-6">
      <PageHeader
        title="Mis clientes"
        description={
          <span className="inline-flex items-center gap-1.5">
            <Lock className="size-3.5" /> Tu cartera es privada: ni el propietario ni otros profesionales pueden verla.
          </span>
        }
      />
      {readOnly && <ReadOnlyNotice />}

      <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_400px]">
        <section className="flex flex-col gap-3">
          <form className="flex gap-2" role="search">
            <label className="relative flex-1">
              <span className="sr-only">Buscar clientes</span>
              <Search className="pointer-events-none absolute top-1/2 left-3.5 size-4 -translate-y-1/2 text-muted-foreground" />
              <input
                type="search"
                name="q"
                defaultValue={query}
                placeholder="Nombre o teléfono"
                className="h-12 w-full rounded-xl border border-input bg-white pr-4 pl-10 text-base outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 md:text-sm"
              />
            </label>
            {archived && <input type="hidden" name="archivados" value="1" />}
            <button type="submit" className="h-12 rounded-xl bg-graphite px-4 text-sm font-semibold text-white">
              Buscar
            </button>
          </form>
          <div className="flex gap-2 text-sm">
            {[
              { label: "Activos", on: !archived, href: query ? `?q=${encodeURIComponent(query)}` : "?" },
              { label: "Archivados", on: archived, href: `?archivados=1${query ? `&q=${encodeURIComponent(query)}` : ""}` },
            ].map((tab) => (
              <Link
                key={tab.label}
                href={`/profesional/clientes${tab.href}`}
                aria-current={tab.on ? "page" : undefined}
                className={cn("rounded-full px-3 py-1 font-semibold", tab.on ? "bg-graphite text-white" : "text-muted-foreground hover:bg-card")}
              >
                {tab.label}
              </Link>
            ))}
          </div>

          {clients.length === 0 ? (
            <div className="flex flex-col items-center rounded-2xl border border-dashed border-border bg-card px-6 py-14 text-center">
              <span className="grid size-12 place-items-center rounded-2xl bg-graphite text-lime">
                <Users className="size-6" />
              </span>
              <p className="mt-4 font-semibold">{query ? "Sin resultados" : archived ? "No hay clientes archivados" : "Aún no tienes clientes"}</p>
              <p className="mt-1 max-w-sm text-sm text-muted-foreground">
                {query ? "Prueba con otro nombre o con parte del teléfono." : "Añádelos aquí o directamente al crear una cita."}
              </p>
            </div>
          ) : (
            <ul className="divide-y divide-border rounded-2xl border border-border bg-card shadow-card" aria-label="Clientes">
              {clients.map((c) => (
                <li key={c.id}>
                  <Link href={`/profesional/clientes/${c.id}`} className="flex items-center gap-3 px-4 py-3 hover:bg-surface sm:px-5">
                    <div className="min-w-0 flex-1">
                      <p className="truncate font-semibold">{c.fullName}</p>
                      <p className="text-xs text-muted-foreground tabular-nums">{c.phone}</p>
                    </div>
                    <div className="hidden text-right text-xs text-muted-foreground sm:block">
                      <p>{c.visits === 1 ? "1 visita" : `${c.visits} visitas`}</p>
                      {c.lastVisit && <p>Última: {formatDate(c.lastVisit, ctx.timeZone)}</p>}
                    </div>
                    <ChevronRight className="size-4 text-muted-foreground" />
                  </Link>
                </li>
              ))}
            </ul>
          )}
          {clients.length === 100 && <p className="text-xs text-muted-foreground">Se muestran los 100 primeros. Usa el buscador para encontrar al resto.</p>}
        </section>

        <section className="rounded-2xl border border-border bg-card p-5 shadow-card sm:p-6 lg:sticky lg:top-24">
          <h2 className="text-base font-bold">Nuevo cliente</h2>
          <div className="mt-5">
            <ClientForm readOnly={readOnly} />
          </div>
        </section>
      </div>
    </div>
  );
}
