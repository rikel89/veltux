import { Suspense, type ReactNode } from "react";
import { Skeleton } from "@/components/ui/skeleton";
import { isSupabaseConfigured } from "@/lib/supabase/env";
import { requireArea } from "@/modules/auth/access";
import type { Area } from "@/modules/auth/access-rules";
import { AppSidebar } from "./app-sidebar";
import { AppTopbar } from "./app-topbar";
import { DemoBanner } from "./demo-banner";
import { MobileTabBar } from "./mobile-tab-bar";

/**
 * Estructura común de las áreas privadas. La estructura se prerenderiza.
 *
 * AreaGuard redirige a quien no tiene acceso al área, pero en App Router el
 * layout y la página se renderizan en paralelo: cada página y cada función de
 * datos debe llamar también a requireArea(). La autorización final es RLS.
 */
export function AppShell({ area, children }: { area: Area; children: ReactNode }) {
  return (
    <div className="min-h-dvh bg-surface">
      <AppSidebar area={area} />
      <div className="flex min-h-dvh flex-col lg:pl-[260px]">
        {!isSupabaseConfigured() && <DemoBanner />}
        <AppTopbar area={area} />
        <main className="flex-1 px-4 pt-5 pb-28 sm:px-6 lg:px-8 lg:pt-8 lg:pb-12">
          <Suspense fallback={<PageSkeleton />}>
            <AreaGuard area={area}>{children}</AreaGuard>
          </Suspense>
        </main>
      </div>
      {/* Lee la ruta actual: en rutas con parámetros dinámicos se resuelve al pedirla. */}
      <Suspense fallback={null}>
        <MobileTabBar area={area} />
      </Suspense>
    </div>
  );
}

async function AreaGuard({ area, children }: { area: Area; children: ReactNode }) {
  await requireArea(area);
  return children;
}

function PageSkeleton() {
  return (
    <div className="mx-auto max-w-[1400px] space-y-6" aria-busy="true">
      <Skeleton className="h-8 w-64" />
      <Skeleton className="h-72 rounded-2xl" />
    </div>
  );
}
