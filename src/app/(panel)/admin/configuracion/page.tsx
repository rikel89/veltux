import type { Metadata } from "next";
import { CircleAlert, CircleCheck, ClipboardCheck } from "lucide-react";
import { PageHeader } from "@/components/layout/page-header";
import { getRealEmailSender } from "@/lib/email";
import { cn } from "@/lib/utils";
import { requireArea } from "@/modules/auth/access";
import { buildReadiness, type ReadinessStatus } from "@/modules/salons/readiness";

export const metadata: Metadata = { title: "Configuración" };

const STATUS: Record<ReadinessStatus, { label: string; icon: typeof CircleCheck; className: string }> = {
  ok: { label: "Listo", icon: CircleCheck, className: "bg-lime-soft text-lime-ink" },
  pending: { label: "Pendiente", icon: CircleAlert, className: "bg-amber-50 text-amber-800" },
  manual: { label: "Revisar a mano", icon: ClipboardCheck, className: "bg-slate-100 text-slate-700" },
};

export default async function AdminConfiguracionPage() {
  await requireArea("admin");
  const items = buildReadiness({
    hasSecretKey: Boolean(process.env.SUPABASE_SECRET_KEY),
    siteUrl: process.env.NEXT_PUBLIC_SITE_URL,
    hasEmailProvider: getRealEmailSender() !== null,
    hasCronSecret: Boolean(process.env.CRON_SECRET),
  });
  const pending = items.filter((i) => i.status === "pending").length;

  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-6">
      <PageHeader
        eyebrow="Plataforma VELTUX"
        title="Preparación del piloto"
        description={pending === 0 ? "Nada pendiente de configurar. Revisa los puntos manuales." : `${pending} ${pending === 1 ? "punto pendiente" : "puntos pendientes"} de configurar.`}
      />
      <ul className="divide-y divide-border rounded-2xl border border-border bg-card shadow-card" aria-label="Lista de comprobación">
        {items.map((item) => {
          const s = STATUS[item.status];
          const Icon = s.icon;
          return (
            <li key={item.id} className="flex items-start gap-3 px-5 py-4">
              <Icon className={cn("mt-0.5 size-5 shrink-0", item.status === "ok" ? "text-lime-ink" : item.status === "pending" ? "text-amber-600" : "text-muted-foreground")} />
              <div className="min-w-0 flex-1">
                <p className="flex flex-wrap items-center gap-2 text-sm font-semibold">
                  {item.title}
                  <span className={cn("rounded-full px-2 py-0.5 text-[11px] font-semibold", s.className)}>{s.label}</span>
                </p>
                <p className="mt-0.5 text-sm text-muted-foreground">{item.detail}</p>
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
