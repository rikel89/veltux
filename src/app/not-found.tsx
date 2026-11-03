import Link from "next/link";
import { VeltuxLogo } from "@/components/brand/veltux-logo";
import { Button } from "@/components/ui/button";

export default function NotFound() {
  return (
    <main className="flex min-h-dvh flex-col items-center justify-center bg-surface px-6 text-center">
      <VeltuxLogo tone="dark" />
      <h1 className="mt-10 text-2xl font-extrabold tracking-tight">No encontramos esta página</h1>
      <p className="mt-2 max-w-sm text-sm text-muted-foreground">
        Puede que el enlace esté mal escrito o que este establecimiento ya no acepte reservas online.
      </p>
      <Button asChild size="lg" className="mt-6 h-12 shadow-lime">
        <Link href="/">Ir al inicio</Link>
      </Button>
    </main>
  );
}
