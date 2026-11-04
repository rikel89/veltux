import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { connection } from "next/server";
import { Suspense } from "react";
import { z } from "zod";
import { VeltuxLogo } from "@/components/brand/veltux-logo";
import { CancelAppointment, ProposalActions } from "@/components/booking/client-appointment-actions";
import { Skeleton } from "@/components/ui/skeleton";
import { formatLongDate, formatTime, toLocalDateKey } from "@/lib/datetime";
import { formatMoney } from "@/lib/format";
import { createAdminClient } from "@/lib/supabase/admin";
import { isSupabaseConfigured } from "@/lib/supabase/env";
import { verifyAppointmentToken } from "@/modules/notifications/links";

export const metadata: Metadata = { title: "Tu cita", robots: { index: false, follow: false } };

const STATUS_TEXT: Record<string, string> = {
  pending: "Pendiente",
  confirmed: "Confirmada",
  cancelled: "Cancelada",
  completed: "Realizada",
  no_show: "No realizada",
};

const viewSchema = z.object({
  starts_at: z.string(),
  ends_at: z.string(),
  status: z.string(),
  service_name: z.string(),
  price_cents: z.number(),
  currency: z.string(),
  salon_name: z.string(),
  salon_phone: z.string().nullable(),
  salon_address: z.string().nullable(),
  professional_name: z.string(),
  timezone: z.string(),
  proposal: z
    .object({
      type: z.enum(["reschedule", "reassignment"]),
      starts_at: z.string(),
      ends_at: z.string(),
      expires_at: z.string(),
      message: z.string().nullable(),
      target_name: z.string().nullable(),
      service_name: z.string().nullable(),
      price_cents: z.number().nullable(),
    })
    .nullable(),
});

export default function ClientAppointmentPage({ params }: PageProps<"/cita/[token]">) {
  return (
    <div className="flex min-h-dvh flex-col bg-surface">
      <main className="mx-auto w-full max-w-xl flex-1 px-4 py-8">
        <VeltuxLogo tone="dark" />
        <div className="mt-8">
          <Suspense fallback={<Skeleton className="h-72 rounded-2xl" />}>
            <AppointmentContent params={params} />
          </Suspense>
        </div>
      </main>
    </div>
  );
}

async function AppointmentContent({ params }: { params: PageProps<"/cita/[token]">["params"] }) {
  await connection();
  const { token } = await params;
  const id = isSupabaseConfigured() && process.env.SUPABASE_SECRET_KEY ? verifyAppointmentToken(token) : null;
  if (!id) notFound();

  const { data, error } = await createAdminClient().rpc("get_appointment_for_client", { p_appointment_id: id });
  if (error) throw error;
  if (!data) notFound();
  const a = viewSchema.parse(data);

  const tz = a.timezone;
  const label = (instant: string) => `${formatLongDate(toLocalDateKey(new Date(instant), tz))} a las ${formatTime(instant, tz)}`;
  const active = a.status === "pending" || a.status === "confirmed";
  const future = new Date(a.starts_at) > new Date();
  const p = a.proposal;

  return (
    <div className="flex flex-col gap-5">
      <section className="rounded-2xl border border-border bg-card p-5 shadow-card sm:p-6">
        <p className="text-sm font-medium text-muted-foreground">
          {a.salon_name} · {STATUS_TEXT[a.status] ?? a.status}
        </p>
        <h1 className={active ? "mt-1 text-2xl font-extrabold tracking-tight" : "mt-1 text-2xl font-extrabold tracking-tight text-muted-foreground line-through"}>
          {label(a.starts_at)}
        </h1>
        <dl className="mt-4 space-y-2 text-sm">
          <div className="flex justify-between gap-4">
            <dt className="text-muted-foreground">Servicio</dt>
            <dd className="text-right font-semibold">
              {a.service_name} · {formatMoney(a.price_cents, a.currency)}
            </dd>
          </div>
          <div className="flex justify-between gap-4">
            <dt className="text-muted-foreground">Con</dt>
            <dd className="text-right font-semibold">{a.professional_name}</dd>
          </div>
          {a.salon_address && (
            <div className="flex justify-between gap-4">
              <dt className="text-muted-foreground">Dónde</dt>
              <dd className="text-right font-semibold">{a.salon_address}</dd>
            </div>
          )}
          {a.salon_phone && (
            <div className="flex justify-between gap-4">
              <dt className="text-muted-foreground">Teléfono</dt>
              <dd className="text-right font-semibold">
                <a href={`tel:${a.salon_phone}`} className="text-lime-ink underline-offset-4 hover:underline">
                  {a.salon_phone}
                </a>
              </dd>
            </div>
          )}
        </dl>
      </section>

      {p && active && (
        <section className="rounded-2xl border-2 border-lime bg-card p-5 shadow-card sm:p-6" aria-labelledby="proposal-title">
          <h2 id="proposal-title" className="text-base font-bold">
            {p.type === "reschedule" ? `${a.professional_name} te propone otra hora` : `Te proponemos cambiar de profesional`}
          </h2>
          <p className="mt-2 text-sm">
            <span className="font-semibold">{label(p.starts_at)}</span>
            {p.type === "reassignment" && (
              <>
                {" "}con <span className="font-semibold">{p.target_name}</span>: {p.service_name}
                {p.price_cents !== null && ` · ${formatMoney(p.price_cents, a.currency)}`}
              </>
            )}
          </p>
          {p.type === "reassignment" && (
            <p className="mt-2 text-xs text-muted-foreground">Si aceptas, compartiremos tu nombre y teléfono con {p.target_name} para atender tu cita. Tu email solo se usará para los avisos de esta cita.</p>
          )}
          {p.message && p.type === "reschedule" && <p className="mt-2 text-sm italic">«{p.message}»</p>}
          <p className="mt-2 text-xs text-muted-foreground">Si no respondes o rechazas, tu cita seguirá como está.</p>
          <ProposalActions token={token} />
        </section>
      )}

      {active && future && <CancelAppointment token={token} />}
    </div>
  );
}
