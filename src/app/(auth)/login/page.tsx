import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { FlaskConical } from "lucide-react";
import { VeltuxLogo } from "@/components/brand/veltux-logo";
import { Skeleton } from "@/components/ui/skeleton";
import { isSupabaseConfigured } from "@/lib/supabase/env";
import { LoginForm } from "./login-form";

export const metadata: Metadata = { title: "Acceder" };

export default function LoginPage() {
  const configured = isSupabaseConfigured();

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
          <h1 className="text-3xl font-extrabold tracking-tight">Accede a tu espacio</h1>
          <p className="mt-2 text-sm text-muted-foreground">Introduce tus credenciales de profesional o propietario.</p>

          {!configured && (
            <div className="mt-6 flex gap-3 rounded-xl border border-dashed border-border bg-white p-4 text-sm">
              <FlaskConical className="mt-0.5 size-4 shrink-0 text-lime-ink" />
              <p className="text-muted-foreground">
                Supabase no está configurado. Puedes revisar el{" "}
                <Link href="/profesional" className="font-semibold text-foreground underline underline-offset-4">
                  panel en modo demostración
                </Link>
                .
              </p>
            </div>
          )}

          <div className="mt-8">
            <Suspense fallback={<Skeleton className="h-64 rounded-xl" />}>
              <LoginForm />
            </Suspense>
          </div>
        </div>
      </section>
    </main>
  );
}
