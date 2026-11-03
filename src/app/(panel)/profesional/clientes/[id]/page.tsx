import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, CalendarPlus, Phone } from "lucide-react";
import { z } from "zod";
import { ArchiveClient } from "@/components/clients/archive-client";
import { ClientForm } from "@/components/clients/client-form";
import { AppointmentStatusBadge } from "@/components/dashboard/appointment-status";
import { PageHeader } from "@/components/layout/page-header";
import { Button } from "@/components/ui/button";
import { formatTime } from "@/lib/datetime";
import { formatDate, formatMoney } from "@/lib/format";
import { isSupabaseConfigured } from "@/lib/supabase/env";
import { getClientDetail } from "@/modules/clients/queries";
import { requireMyProfessional } from "@/modules/professionals/context";

export const metadata: Metadata = { title: "Ficha de cliente" };

export default async function ClientDetailPage({ params }: PageProps<"/profesional/clientes/[id]">) {
  const { id } = await params;
  if (!isSupabaseConfigured() || !z.uuid().safeParse(id).success) notFound();

  const { supabase, ctx } = await requireMyProfessional();
  if (!ctx) notFound();
  const client = await getClientDetail(supabase, ctx.professionalId, id);
  if (!client) notFound();
  const readOnly = ctx.status !== "active";
  const spentCents = client.history.filter((a) => a.status === "completed").reduce((sum, a) => sum + a.priceCents, 0);

  return (
    <div className="mx-auto flex max-w-[1400px] flex-col gap-6">
      <Link href="/profesional/clientes" className="inline-flex w-fit items-center gap-1 text-sm font-medium text-muted-foreground hover:text-foreground">
        <ArrowLeft className="size-4" /> Mis clientes
      </Link>
      <PageHeader
        title={client.fullName}
        description={
          <span className="inline-flex flex-wrap items-center gap-x-3 gap-y-1">
            <a href={`tel:${client.phone}`} className="inline-flex items-center gap-1 font-semibold text-lime-ink tabular-nums">
              <Phone className="size-3.5" /> {client.phone}
            </a>
            <span>Cliente desde {formatDate(client.createdAt, ctx.timeZone)}</span>
            {client.archived && <span className="rounded-full bg-muted px-2 py-0.5 text-[11px] font-semibold">Archivado</span>}
          </span>
        }
        actions={
          !readOnly &&
          !client.archived && (
            <Button asChild size="lg" className="h-11 shadow-lime">
              <Link href="/profesional/agenda?nueva=1">
                <CalendarPlus /> Nueva cita
              </Link>
            </Button>
          )
        }
      />

      <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_400px]">
        <div className="flex flex-col gap-6">
          <dl className="grid grid-cols-2 gap-3 sm:grid-cols-3">
            {[
              { label: "Visitas", value: String(client.visits) },
              { label: "Última visita", value: client.lastVisit ? formatDate(client.lastVisit, ctx.timeZone) : "—" },
              { label: "Total gastado", value: formatMoney(spentCents) },
            ].map((s) => (
              <div key={s.label} className="rounded-2xl border border-border bg-card p-4 shadow-card">
                <dt className="text-xs text-muted-foreground">{s.label}</dt>
                <dd className="mt-1 text-lg font-extrabold tabular-nums">{s.value}</dd>
              </div>
            ))}
          </dl>

          <section className="rounded-2xl border border-border bg-card shadow-card" aria-labelledby="history-title">
            <h2 id="history-title" className="border-b border-border px-5 py-4 text-base font-bold">
              Historial de citas
            </h2>
            {client.history.length === 0 ? (
              <p className="px-5 py-10 text-center text-sm text-muted-foreground">Todavía no tiene citas.</p>
            ) : (
              <ul className="divide-y divide-border">
                {client.history.map((a) => (
                  <li key={a.id} className="flex items-center gap-3 px-5 py-3">
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-semibold">{a.serviceName}</p>
                      <p className="text-xs text-muted-foreground">
                        {formatDate(a.startsAt, ctx.timeZone)} · {formatTime(a.startsAt, ctx.timeZone)}
                        {a.cancelReason && ` · ${a.cancelReason}`}
                      </p>
                    </div>
                    <AppointmentStatusBadge status={a.status} />
                    <span className="w-16 text-right text-sm font-semibold tabular-nums">{formatMoney(a.priceCents, a.currency)}</span>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </div>

        <div className="flex flex-col gap-6">
          <section className="rounded-2xl border border-border bg-card p-5 shadow-card sm:p-6">
            <h2 className="text-base font-bold">Ficha</h2>
            <div className="mt-5">
              <ClientForm client={client} readOnly={readOnly} />
            </div>
          </section>
          {!readOnly && (
            <section className="rounded-2xl border border-border bg-card p-5 shadow-card sm:p-6">
              <ArchiveClient clientId={client.id} archived={client.archived} />
            </section>
          )}
        </div>
      </div>
    </div>
  );
}
