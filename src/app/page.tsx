import Link from "next/link";
import { ArrowRight, BarChart3, BellRing, CalendarCheck, CalendarDays, Users } from "lucide-react";
import { VeltuxLogo, VeltuxMark } from "@/components/brand/veltux-logo";
import { Button } from "@/components/ui/button";

const FEATURES = [
  { icon: CalendarDays, title: "Agenda inteligente" },
  { icon: Users, title: "Profesionales independientes" },
  { icon: CalendarCheck, title: "Reservas online" },
  { icon: BellRing, title: "Notificaciones SMS" },
  { icon: BarChart3, title: "Control del negocio" },
];

export default function HomePage() {
  return (
    <main className="relative isolate flex min-h-dvh flex-col overflow-hidden bg-graphite text-white">
      {/* Destello lima en diagonal, como en la identidad corporativa */}
      <div aria-hidden className="pointer-events-none absolute -bottom-40 -left-40 -z-10 size-[520px] rounded-full bg-lime/25 blur-[120px]" />
      <div aria-hidden className="pointer-events-none absolute bottom-0 left-0 -z-10 h-[2px] w-[420px] origin-bottom-left -rotate-[35deg] bg-gradient-to-r from-lime to-transparent" />
      <div aria-hidden className="pointer-events-none absolute -top-32 right-0 -z-10 size-[420px] rounded-full bg-white/[0.03] blur-3xl" />

      <header className="flex items-center justify-between px-6 py-6 sm:px-10">
        <VeltuxLogo />
        <Button asChild variant="ghost" className="text-white hover:bg-white/10 hover:text-white">
          <Link href="/login">Acceder</Link>
        </Button>
      </header>

      <section className="flex flex-1 flex-col items-center justify-center px-6 py-12 text-center">
        <VeltuxMark className="h-20 text-white sm:h-28" />
        <h1 className="mt-6 -skew-x-6 text-6xl font-extrabold tracking-[0.02em] sm:text-8xl">
          VELTU<span className="text-lime">X</span>
        </h1>
        <p className="mt-5 text-xl font-medium text-neutral-200 sm:text-2xl">
          Tu agenda. Tu negocio.{" "}
          <span className="relative inline-block font-extrabold text-lime">
            Tu ritmo.
            <svg aria-hidden viewBox="0 0 120 8" className="absolute -bottom-2 left-0 w-full" preserveAspectRatio="none">
              <path d="M2 6 Q60 0 118 4" className="fill-none stroke-lime" strokeWidth="2.5" strokeLinecap="round" />
            </svg>
          </span>
        </p>
        <p className="mt-6 max-w-xl text-sm text-neutral-400 sm:text-base">
          La plataforma de reservas para barberías y peluquerías donde cada profesional trabaja con su propia agenda,
          sus servicios y su cartera de clientes.
        </p>
        <div className="mt-9 flex flex-col gap-3 sm:flex-row">
          <Button asChild size="lg" className="shadow-lime">
            <Link href="/login">
              Acceder a mi agenda <ArrowRight />
            </Link>
          </Button>
          <Button asChild size="lg" variant="outline" className="border-white/15 bg-transparent text-white hover:bg-white/10 hover:text-white">
            <Link href="/profesional">Ver panel profesional</Link>
          </Button>
        </div>
      </section>

      <ul className="mx-auto grid w-full max-w-5xl grid-cols-2 gap-y-8 px-6 pb-14 sm:grid-cols-5 sm:divide-x sm:divide-white/10">
        {FEATURES.map(({ icon: Icon, title }) => (
          <li key={title} className="flex flex-col items-center gap-3 px-4 text-center last:col-span-2 sm:last:col-span-1">
            <Icon className="size-7 text-lime" strokeWidth={1.75} />
            <span className="max-w-[9rem] text-sm font-semibold text-neutral-200">{title}</span>
          </li>
        ))}
      </ul>
    </main>
  );
}
