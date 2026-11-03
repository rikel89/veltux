import type { Metadata } from "next";
import { AuthSplit } from "@/components/layout/auth-split";
import { NewPasswordForm } from "@/components/forms/new-password-form";

export const metadata: Metadata = { title: "Nueva contraseña" };

/** Destino de los enlaces de invitación y recuperación (sesión creada en /auth/confirm). */
export default function NewPasswordPage() {
  return (
    <AuthSplit
      title="Crea tu contraseña"
      description="Mínimo 8 caracteres, con al menos una letra y un número."
    >
      <NewPasswordForm submitLabel="Guardar y entrar" />
    </AuthSplit>
  );
}
