"use client";

import Link from "next/link";
import { ArrowLeftRight, LogOut, Settings, UserRound } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { initials } from "@/lib/format";
import { AREA_HOME, AREA_LABEL, type Area } from "@/modules/auth/access-rules";

type Props = {
  displayName: string;
  email: string | null;
  isDemo: boolean;
  area: Area;
  areas: Area[];
};

const SETTINGS_HREF: Record<Area, string> = {
  professional: "/profesional/configuracion",
  owner: "/propietario/configuracion",
  admin: "/admin/configuracion",
};

export function UserMenu({ displayName, email, isDemo, area, areas }: Props) {
  const otherAreas = areas.filter((a) => a !== area);

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        className="grid size-10 place-items-center rounded-full bg-graphite text-xs font-bold text-lime ring-offset-2 outline-none focus-visible:ring-2 focus-visible:ring-ring"
        aria-label="Menú de usuario"
      >
        {initials(displayName)}
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-64">
        <DropdownMenuLabel className="font-normal">
          <p className="text-sm font-semibold text-foreground">{displayName}</p>
          <p className="truncate text-xs text-muted-foreground">{isDemo ? "Modo demostración" : email}</p>
        </DropdownMenuLabel>
        {otherAreas.length > 0 && (
          <>
            <DropdownMenuSeparator />
            {otherAreas.map((a) => (
              <DropdownMenuItem key={a} asChild>
                <Link href={AREA_HOME[a]}>
                  <ArrowLeftRight /> {AREA_LABEL[a]}
                </Link>
              </DropdownMenuItem>
            ))}
          </>
        )}
        <DropdownMenuSeparator />
        {area === "professional" && (
          <DropdownMenuItem asChild>
            <Link href="/profesional/perfil">
              <UserRound /> Mi perfil
            </Link>
          </DropdownMenuItem>
        )}
        <DropdownMenuItem asChild>
          <Link href={SETTINGS_HREF[area]}>
            <Settings /> Configuración
          </Link>
        </DropdownMenuItem>
        {!isDemo && (
          <>
            <DropdownMenuSeparator />
            <form action="/auth/signout" method="post">
              <DropdownMenuItem asChild variant="destructive">
                <button type="submit" className="w-full">
                  <LogOut /> Cerrar sesión
                </button>
              </DropdownMenuItem>
            </form>
          </>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
