import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { AuthSplit } from "@/components/layout/auth-split";
import { RecoverForm } from "./recover-form";

export const metadata: Metadata = { title: "Recuperar contraseña" };

export default function RecoverPage() {
  return (
    <AuthSplit
      title="Recupera tu acceso"
      description="Te enviaremos un enlace para crear una contraseña nueva."
    >
      <RecoverForm />
      <Link
        href="/login"
        className="mt-8 inline-flex items-center gap-1.5 text-sm font-semibold text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="size-4" /> Volver a iniciar sesión
      </Link>
    </AuthSplit>
  );
}
