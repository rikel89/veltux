import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { findNavItem } from "./nav-config";

/** Estado vacío honesto para pantallas cuyo backend llega en un sprint posterior. */
export function ComingSoon({ href }: { href: string }) {
  const item = findNavItem(href);
  if (!item) return null;
  const Icon = item.icon;

  return (
    <div className="mx-auto max-w-[1400px]">
      <h1 className="text-2xl font-extrabold tracking-tight sm:text-3xl">{item.label}</h1>
      <div className="mt-6 flex flex-col items-center rounded-2xl border border-dashed border-border bg-card px-6 py-16 text-center shadow-card">
        <span className="grid size-14 place-items-center rounded-2xl bg-graphite text-lime">
          <Icon className="size-7" />
        </span>
        <span className="mt-5 rounded-full bg-lime-soft px-3 py-1 text-xs font-bold text-lime-ink">
          Disponible en el Sprint {item.sprint}
        </span>
        <p className="mt-4 max-w-md text-sm text-muted-foreground">{item.description}</p>
        <Button asChild variant="outline" size="lg" className="mt-6">
          <Link href={`/${href.split("/")[1]}`}>
            <ArrowLeft /> Volver al inicio
          </Link>
        </Button>
      </div>
    </div>
  );
}
