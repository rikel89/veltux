import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { FlaskConical } from "lucide-react";
import { AuthSplit } from "@/components/layout/auth-split";
import { Skeleton } from "@/components/ui/skeleton";
import { isSupabaseConfigured } from "@/lib/supabase/env";
import { LoginForm } from "./login-form";

export const metadata: Metadata = { title: "Acceder" };

export default function LoginPage() {
  return (
    <AuthSplit title="Accede a tu espacio" description="Introduce tus credenciales de profesional o propietario.">
      {!isSupabaseConfigured() && (
        <div className="mb-6 flex gap-3 rounded-xl border border-dashed border-border bg-white p-4 text-sm">
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
      <Suspense fallback={<Skeleton className="h-64 rounded-xl" />}>
        <LoginForm />
      </Suspense>
      <p className="mt-8 text-center text-xs text-muted-foreground">
        ¿Tu peluquería aún no usa VELTUX? El acceso al piloto es por invitación.
      </p>
    </AuthSplit>
  );
}
