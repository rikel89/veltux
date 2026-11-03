"use client";

import Link from "next/link";
import { Suspense } from "react";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import type { Area } from "@/modules/auth/access-rules";
import { CURRENT_SPRINT, isNavItemActive, NAVS } from "./nav-config";

// Los iconos son componentes: la lista se resuelve aquí a partir del área, no se pasa desde el servidor.
type Props = { area: Area; onNavigate?: () => void };

/**
 * En rutas con parámetros dinámicos la ruta solo se conoce al pedirla: mientras
 * tanto se muestra la misma lista sin elemento activo (Cache Components).
 */
export function SidebarNav(props: Props) {
  return (
    <Suspense fallback={<NavList {...props} pathname={null} />}>
      <ActiveNav {...props} />
    </Suspense>
  );
}

function ActiveNav(props: Props) {
  return <NavList {...props} pathname={usePathname()} />;
}

function NavList({ area, onNavigate, pathname }: Props & { pathname: string | null }) {
  return (
    <nav aria-label="Navegación principal" className="flex flex-col gap-1">
      {NAVS[area].items.map((item) => {
        const active = pathname !== null && isNavItemActive(pathname, item.href);
        const Icon = item.icon;
        return (
          <Link
            key={item.href}
            href={item.href}
            onClick={onNavigate}
            aria-current={active ? "page" : undefined}
            className={cn(
              "group flex h-11 items-center gap-3 rounded-xl px-3 text-sm font-medium transition-colors",
              active
                ? "bg-lime text-graphite shadow-lime"
                : "text-sidebar-foreground hover:bg-sidebar-accent hover:text-white",
            )}
          >
            <Icon className={cn("size-[18px]", active ? "text-graphite" : "text-neutral-500 group-hover:text-lime")} />
            <span className="flex-1">{item.label}</span>
            {item.sprint > CURRENT_SPRINT && !active && (
              <span className="rounded-md bg-white/5 px-1.5 py-0.5 text-[10px] font-semibold text-neutral-500">
                S{item.sprint}
              </span>
            )}
          </Link>
        );
      })}
    </nav>
  );
}
