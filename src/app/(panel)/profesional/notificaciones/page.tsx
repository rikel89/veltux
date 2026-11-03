import type { Metadata } from "next";
import { Info } from "lucide-react";
import { PageHeader } from "@/components/layout/page-header";
import { formatTime } from "@/lib/datetime";
import { formatDate } from "@/lib/format";
import { getRealSmsSender } from "@/lib/sms";
import { isSupabaseConfigured } from "@/lib/supabase/env";
import { cn } from "@/lib/utils";
import { appointmentLink } from "@/modules/notifications/links";
import { NOTIFICATION_STATUS_LABEL, needsClientLink, renderSms, TEMPLATE_LABEL, type NotificationPayload } from "@/modules/notifications/templates";
import { requireMyProfessional } from "@/modules/professionals/context";
import type { NotificationStatus } from "@/types/database";

export const metadata: Metadata = { title: "Notificaciones" };

const STATUS_STYLE: Record<NotificationStatus, string> = {
  pending: "bg-amber-50 text-amber-700 ring-amber-200",
  processing: "bg-amber-50 text-amber-700 ring-amber-200",
  sent: "bg-slate-100 text-slate-700 ring-slate-200",
  delivered: "bg-lime-soft text-lime-ink ring-lime/60",
  failed: "bg-red-50 text-red-700 ring-red-200",
};

export default async function NotificacionesPage() {
  if (!isSupabaseConfigured()) {
    return (
      <div className="mx-auto max-w-3xl">
        <PageHeader title="Notificaciones" description="Disponible al conectar Supabase." />
      </div>
    );
  }

  const { supabase, ctx } = await requireMyProfessional();
  if (!ctx) return <p className="text-sm text-muted-foreground">No tienes ficha de profesional.</p>;

  const { data, error } = await supabase
    .from("notifications")
    .select("id, template, status, recipient_phone, payload, appointment_id, next_attempt_at, sent_at, last_error, created_at")
    .eq("professional_id", ctx.professionalId)
    .eq("channel", "sms")
    .order("created_at", { ascending: false })
    .limit(100);
  if (error) throw error;

  const hasProvider = getRealSmsSender() !== null;
  const showLinks = process.env.NODE_ENV !== "production";

  return (
    <div className="mx-auto flex max-w-[1400px] flex-col gap-6">
      <PageHeader title="Notificaciones" description="Los SMS que VELTUX envía a tus clientes y su estado." />

      {!hasProvider && (
        <p role="status" className="flex items-start gap-3 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
          <Info className="mt-0.5 size-4 shrink-0" />
          Aún no hay proveedor de SMS conectado: los mensajes se guardan como pendientes y no se ha enviado ninguno a tus clientes.
        </p>
      )}

      {data.length === 0 ? (
        <p className="rounded-2xl border border-dashed border-border bg-card px-6 py-12 text-center text-sm text-muted-foreground">Todavía no hay notificaciones.</p>
      ) : (
        <ul className="divide-y divide-border rounded-2xl border border-border bg-card shadow-card" aria-label="Notificaciones">
          {data.map((n) => {
            const link = showLinks && needsClientLink(n.template) && n.appointment_id ? appointmentLink(n.appointment_id) : null;
            const scheduled = n.status === "pending" && new Date(n.next_attempt_at) > new Date();
            return (
              <li key={n.id} className="px-4 py-3 sm:px-5">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-sm font-semibold">{TEMPLATE_LABEL[n.template] ?? n.template}</span>
                  <span className={cn("inline-flex rounded-full px-2 py-0.5 text-[11px] font-semibold ring-1 ring-inset", STATUS_STYLE[n.status])}>
                    {NOTIFICATION_STATUS_LABEL[n.status]}
                  </span>
                  <span className="ml-auto text-xs text-muted-foreground tabular-nums">{n.recipient_phone}</span>
                </div>
                <p className="mt-1 text-sm text-muted-foreground">{renderSms(n.template, n.payload as NotificationPayload)}</p>
                <p className="mt-1 text-xs text-muted-foreground">
                  {scheduled
                    ? `Programado para el ${formatDate(n.next_attempt_at, ctx.timeZone)} a las ${formatTime(n.next_attempt_at, ctx.timeZone)}`
                    : n.sent_at
                      ? `Enviado el ${formatDate(n.sent_at, ctx.timeZone)} a las ${formatTime(n.sent_at, ctx.timeZone)}`
                      : `Creado el ${formatDate(n.created_at, ctx.timeZone)} a las ${formatTime(n.created_at, ctx.timeZone)}`}
                  {n.last_error && ` · ${n.last_error}`}
                </p>
                {link && (
                  <a href={link} target="_blank" rel="noreferrer" className="mt-1 inline-block text-xs font-semibold text-lime-ink underline-offset-4 hover:underline">
                    Abrir la página del cliente (solo en desarrollo)
                  </a>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
