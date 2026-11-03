import type { Metadata } from "next";
import { AuthSplit } from "@/components/layout/auth-split";
import { Button } from "@/components/ui/button";

export const metadata: Metadata = { title: "Sin acceso" };

export default function NoAccessPage() {
  return (
    <AuthSplit
      title="Tu cuenta aún no tiene acceso"
      description="Has iniciado sesión, pero tu usuario no está vinculado a ningún establecimiento de VELTUX."
    >
      <p className="text-sm text-muted-foreground">
        Pide al propietario de tu peluquería que te invite o contacta con VELTUX para dar de alta tu establecimiento.
      </p>
      <form action="/auth/signout" method="post" className="mt-8">
        <Button type="submit" variant="outline" size="lg" className="h-12 w-full">
          Cerrar sesión
        </Button>
      </form>
    </AuthSplit>
  );
}
