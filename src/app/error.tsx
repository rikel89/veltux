"use client";

import { useEffect } from "react";
import { VeltuxLogo } from "@/components/brand/veltux-logo";
import { Button } from "@/components/ui/button";

export default function ErrorPage({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <main className="flex min-h-dvh flex-col items-center justify-center bg-surface px-6 text-center">
      <VeltuxLogo tone="dark" />
      <h1 className="mt-10 text-2xl font-extrabold tracking-tight">Algo ha fallado</h1>
      <p className="mt-2 max-w-sm text-sm text-muted-foreground">No se ha guardado nada nuevo. Vuelve a intentarlo y, si se repite, avísanos.</p>
      {error.digest && <p className="mt-2 text-xs text-muted-foreground">Referencia: {error.digest}</p>}
      <Button size="lg" className="mt-6 h-12 shadow-lime" onClick={reset}>
        Reintentar
      </Button>
    </main>
  );
}
