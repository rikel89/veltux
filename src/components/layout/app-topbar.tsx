import Link from "next/link";
import { Suspense } from "react";
import { Bell, Search } from "lucide-react";
import { VeltuxLogo } from "@/components/brand/veltux-logo";
import { Skeleton } from "@/components/ui/skeleton";
import { AREA_HOME, AREA_LABEL, type Area } from "@/modules/auth/access-rules";
import { getShellIdentity } from "@/modules/auth/identity";
import { UserMenu } from "./user-menu";

export function AppTopbar({ area }: { area: Area }) {
  return (
    <header className="sticky top-0 z-20 border-b border-border/70 bg-surface/85 backdrop-blur-md lg:bg-surface/70">
      <div className="flex h-16 items-center gap-3 px-4 sm:px-6 lg:h-[72px] lg:px-8">
        {/* Móvil: cabecera oscura compacta con logotipo */}
        <Link href={AREA_HOME[area]} className="lg:hidden" aria-label="VELTUX · Inicio">
          <span className="flex items-center rounded-xl bg-graphite px-3 py-2">
            <VeltuxLogo className="[&_svg]:h-5 [&>span:nth-child(2)]:text-base" />
          </span>
        </Link>

        {area === "professional" ? (
          <button
            type="button"
            disabled
            title="Búsqueda global disponible en el Sprint 4"
            className="hidden h-11 w-full max-w-md items-center gap-3 rounded-xl border border-border bg-white px-4 text-sm text-muted-foreground shadow-card disabled:cursor-not-allowed md:flex"
          >
            <Search className="size-4" />
            <span className="flex-1 text-left">Buscar clientes o citas…</span>
            <kbd className="rounded-md border border-border bg-muted px-1.5 py-0.5 text-[10px] font-semibold">Ctrl K</kbd>
          </button>
        ) : (
          <p className="hidden text-sm font-semibold text-muted-foreground md:block">{AREA_LABEL[area]}</p>
        )}

        <div className="ml-auto flex items-center gap-2">
          {area === "professional" && (
            <Link
              href="/profesional/notificaciones"
              aria-label="Notificaciones"
              className="grid size-10 place-items-center rounded-full border border-border bg-white text-foreground shadow-card transition-colors hover:bg-muted"
            >
              <Bell className="size-[18px]" />
            </Link>
          )}
          <Suspense fallback={<Skeleton className="size-10 rounded-full" />}>
            <TopbarUser area={area} />
          </Suspense>
        </div>
      </div>
    </header>
  );
}

async function TopbarUser({ area }: { area: Area }) {
  const identity = await getShellIdentity(area);
  return (
    <UserMenu
      displayName={identity.displayName}
      email={identity.email}
      isDemo={identity.mode === "demo"}
      area={area}
      areas={identity.areas}
    />
  );
}
