import type { ReactNode } from "react";
import Link from "next/link";
import { VeltuxLogo } from "@/components/brand/veltux-logo";

/** Estructura de las páginas públicas de reserva (sin sesión ni panel). */
export default function PublicLayout({ children }: { children: ReactNode }) {
  return (
    <div className="flex min-h-dvh flex-col bg-surface">
      <main className="mx-auto w-full max-w-xl flex-1 px-4 pt-6 pb-10 sm:pt-10">{children}</main>
      <footer className="border-t border-border bg-card">
        <div className="mx-auto flex max-w-xl items-center justify-between gap-3 px-4 py-4 text-xs text-muted-foreground">
          <span>Reservas con</span>
          <Link href="/" aria-label="VELTUX">
            <VeltuxLogo tone="dark" className="scale-75 origin-right" />
          </Link>
        </div>
      </footer>
    </div>
  );
}
