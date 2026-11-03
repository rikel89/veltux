import type { ReactNode } from "react";
import { VeltuxLogo } from "@/components/brand/veltux-logo";

/** Estructura de las pantallas de acceso: panel de marca + columna de formulario. */
export function AuthSplit({ title, description, children }: { title: string; description: string; children: ReactNode }) {
  return (
    <main className="grid min-h-dvh lg:grid-cols-[1fr_1.1fr]">
      <section className="relative hidden overflow-hidden bg-graphite p-12 text-white lg:flex lg:flex-col lg:justify-between">
        <div aria-hidden className="absolute -bottom-32 -left-32 size-[460px] rounded-full bg-lime/25 blur-[110px]" />
        <VeltuxLogo className="relative" />
        <div className="relative">
          <p className="text-4xl leading-tight font-extrabold">
            Tu agenda. Tu negocio.
            <br />
            <span className="text-lime">Tu ritmo.</span>
          </p>
          <p className="mt-4 max-w-sm text-neutral-400">
            Cada profesional con su agenda, sus servicios y sus clientes. Sin mezclar nada.
          </p>
        </div>
        <p className="relative text-xs text-neutral-600">© VELTUX</p>
      </section>

      <section className="flex flex-col justify-center px-6 py-12 sm:px-12">
        <div className="mx-auto w-full max-w-sm">
          <div className="mb-10 lg:hidden">
            <span className="inline-flex rounded-xl bg-graphite px-4 py-3">
              <VeltuxLogo />
            </span>
          </div>
          <h1 className="text-3xl font-extrabold tracking-tight">{title}</h1>
          <p className="mt-2 text-sm text-muted-foreground">{description}</p>
          <div className="mt-8">{children}</div>
        </div>
      </section>
    </main>
  );
}
