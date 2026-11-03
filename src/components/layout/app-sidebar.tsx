import Link from "next/link";
import { Suspense } from "react";
import { ArrowLeftRight, BadgeCheck, CircleAlert } from "lucide-react";
import { VeltuxLogo } from "@/components/brand/veltux-logo";
import { Skeleton } from "@/components/ui/skeleton";
import { initials } from "@/lib/format";
import { AREA_HOME, AREA_LABEL, type Area } from "@/modules/auth/access-rules";
import { getShellIdentity } from "@/modules/auth/identity";
import { NAVS } from "./nav-config";
import { SidebarNav } from "./sidebar-nav";

export function AppSidebar({ area }: { area: Area }) {
  return (
    <aside className="fixed inset-y-0 left-0 z-30 hidden w-[260px] flex-col bg-sidebar lg:flex">
      <div className="flex h-[72px] items-center px-6">
        <Link href={AREA_HOME[area]} aria-label="VELTUX · Inicio">
          <VeltuxLogo />
        </Link>
      </div>

      <div className="px-4 pb-4">
        <Suspense fallback={<Skeleton className="h-14 rounded-xl bg-white/5" />}>
          <ContextChip area={area} />
        </Suspense>
      </div>

      <div className="flex-1 overflow-y-auto px-4 scrollbar-none">
        <p className="px-3 pb-2 text-[11px] font-semibold tracking-[0.12em] text-neutral-600 uppercase">
          {NAVS[area].sectionLabel}
        </p>
        <SidebarNav area={area} />
      </div>

      <div className="border-t border-sidebar-border p-4">
        <Suspense fallback={<Skeleton className="h-12 rounded-xl bg-white/5" />}>
          <SidebarAccount area={area} />
        </Suspense>
      </div>
    </aside>
  );
}

async function ContextChip({ area }: { area: Area }) {
  const identity = await getShellIdentity(area);
  return (
    <div className="rounded-xl border border-sidebar-border bg-graphite-800 p-3">
      <p className="text-[11px] font-medium text-neutral-500">{identity.contextCaption}</p>
      <p className="truncate text-sm font-semibold text-white">{identity.contextLabel}</p>
    </div>
  );
}

async function SidebarAccount({ area }: { area: Area }) {
  const identity = await getShellIdentity(area);
  const otherAreas = identity.areas.filter((a) => a !== area);

  return (
    <div className="space-y-3">
      {otherAreas.map((a) => (
        <Link
          key={a}
          href={AREA_HOME[a]}
          className="flex items-center gap-2 rounded-lg px-3 py-2 text-xs font-semibold text-neutral-400 transition-colors hover:bg-sidebar-accent hover:text-white"
        >
          <ArrowLeftRight className="size-3.5 text-lime" /> {AREA_LABEL[a]}
        </Link>
      ))}
      {identity.badge && (
        <div
          className={
            identity.badge.tone === "ok"
              ? "flex items-center gap-2 rounded-lg bg-lime/10 px-3 py-2 text-xs font-medium text-lime"
              : "flex items-center gap-2 rounded-lg bg-amber-400/10 px-3 py-2 text-xs font-medium text-amber-300"
          }
        >
          {identity.badge.tone === "ok" ? <BadgeCheck className="size-4" /> : <CircleAlert className="size-4" />}
          {identity.badge.label}
        </div>
      )}
      <div className="flex items-center gap-3 px-1">
        <span className="grid size-9 place-items-center rounded-full bg-lime text-xs font-bold text-graphite">
          {initials(identity.displayName)}
        </span>
        <div className="min-w-0">
          <p className="truncate text-sm font-semibold text-white">{identity.displayName}</p>
          <p className="truncate text-xs text-neutral-500">
            {identity.mode === "demo" ? "Modo demostración" : (identity.email ?? "")}
          </p>
        </div>
      </div>
    </div>
  );
}
