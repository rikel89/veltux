import Link from "next/link";
import { CalendarPlus, Clock, Link2, TriangleAlert } from "lucide-react";
import { CopyBookingLink } from "./copy-booking-link";

const ACTIONS = [
  { label: "Nueva cita", href: "/profesional/agenda", icon: CalendarPlus, primary: true },
  { label: "Bloquear hueco", href: "/profesional/agenda", icon: Clock },
  { label: "Gestionar imprevisto", href: "/profesional/imprevistos", icon: TriangleAlert },
] as const;

export function QuickActions({ salonSlug }: { salonSlug: string }) {
  return (
    <section aria-labelledby="acciones-rapidas" className="rounded-2xl border border-border bg-card p-5 shadow-card sm:p-6">
      <h2 id="acciones-rapidas" className="text-base font-bold">
        Acciones rápidas
      </h2>
      <div className="mt-4 grid grid-cols-3 gap-2.5">
        {ACTIONS.map(({ label, href, icon: Icon, ...rest }) => (
          <Link
            key={label}
            href={href}
            className={
              "primary" in rest
                ? "flex min-h-24 flex-col items-center justify-center gap-2 rounded-xl bg-lime p-3 text-center text-xs font-bold text-graphite shadow-lime transition-transform active:scale-[0.97]"
                : "flex min-h-24 flex-col items-center justify-center gap-2 rounded-xl border border-border bg-surface p-3 text-center text-xs font-semibold transition-colors hover:border-graphite/20 hover:bg-muted active:scale-[0.97]"
            }
          >
            <Icon className="size-5" />
            {label}
          </Link>
        ))}
      </div>

      <div className="mt-4 rounded-xl bg-graphite p-4 text-white">
        <p className="flex items-center gap-2 text-xs font-semibold text-neutral-400">
          <Link2 className="size-3.5 text-lime" /> Tu enlace de reservas
        </p>
        <CopyBookingLink path={`veltux.es/${salonSlug}`} />
        <p className="mt-2 text-[11px] text-neutral-500">Tus clientes confirman la reserva con un código por SMS.</p>
      </div>
    </section>
  );
}
