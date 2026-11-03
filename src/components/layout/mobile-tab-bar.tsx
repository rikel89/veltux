"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { Menu, Plus } from "lucide-react";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { VeltuxLogo } from "@/components/brand/veltux-logo";
import { cn } from "@/lib/utils";
import { findNavItem, isNavItemActive, PROFESSIONAL_MOBILE_PRIMARY } from "./nav-config";
import { SidebarNav } from "./sidebar-nav";

const SHORT_LABELS: Record<string, string> = {
  "/profesional": "Inicio",
  "/profesional/agenda": "Agenda",
  "/profesional/clientes": "Clientes",
};

/** Barra de pestañas inferior con acción central "Nueva cita" (solo móvil/tablet). */
export function MobileTabBar() {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const [home, agenda, clients] = PROFESSIONAL_MOBILE_PRIMARY.map((href) => findNavItem(href)!);
  const moreActive = !PROFESSIONAL_MOBILE_PRIMARY.some((href) => isNavItemActive(pathname, href));

  const tab = (item: typeof home) => {
    const active = isNavItemActive(pathname, item.href);
    const Icon = item.icon;
    return (
      <Link
        key={item.href}
        href={item.href}
        aria-current={active ? "page" : undefined}
        className={cn(
          "flex flex-1 flex-col items-center justify-center gap-1 text-[11px] font-semibold",
          active ? "text-lime" : "text-neutral-400",
        )}
      >
        <Icon className="size-[22px]" />
        {SHORT_LABELS[item.href]}
      </Link>
    );
  };

  return (
    <nav
      aria-label="Navegación inferior"
      className="fixed inset-x-0 bottom-0 z-30 border-t border-white/10 bg-graphite/95 pb-safe backdrop-blur-md lg:hidden"
    >
      <div className="mx-auto flex h-16 max-w-lg items-stretch px-2">
        {tab(home)}
        {tab(agenda)}
        <div className="flex flex-1 items-start justify-center">
          <Link
            href="/profesional/agenda"
            aria-label="Nueva cita"
            className="-mt-5 grid size-14 place-items-center rounded-2xl bg-lime text-graphite shadow-lime ring-4 ring-surface transition-transform active:scale-95"
          >
            <Plus className="size-7" strokeWidth={2.5} />
          </Link>
        </div>
        {tab(clients)}
        <Sheet open={open} onOpenChange={setOpen}>
          <SheetTrigger
            className={cn(
              "flex flex-1 flex-col items-center justify-center gap-1 text-[11px] font-semibold outline-none",
              moreActive ? "text-lime" : "text-neutral-400",
            )}
          >
            <Menu className="size-[22px]" />
            Más
          </SheetTrigger>
          <SheetContent side="bottom" className="rounded-t-3xl border-none bg-graphite px-4 pt-2 pb-8 text-white">
            <div className="mx-auto mt-2 h-1.5 w-12 rounded-full bg-white/15" />
            <SheetHeader className="px-1">
              <SheetTitle className="text-white">
                <VeltuxLogo className="[&_svg]:h-5 [&>span:nth-child(2)]:text-base" />
              </SheetTitle>
              <SheetDescription className="text-neutral-500">Todas las secciones de tu espacio</SheetDescription>
            </SheetHeader>
            <SidebarNav onNavigate={() => setOpen(false)} />
          </SheetContent>
        </Sheet>
      </div>
    </nav>
  );
}
