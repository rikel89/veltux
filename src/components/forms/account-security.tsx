import { Mail, ShieldCheck } from "lucide-react";
import { NewPasswordForm } from "./new-password-form";

/** Bloque de cuenta: email de acceso y cambio de contraseña. */
export function AccountSecurity({ email }: { email: string | null }) {
  return (
    <section className="rounded-2xl border border-border bg-card p-5 shadow-card sm:p-6">
      <h2 className="flex items-center gap-2 text-base font-bold">
        <ShieldCheck className="size-4 text-lime-ink" /> Cuenta y seguridad
      </h2>
      <p className="mt-3 flex items-center gap-2 rounded-xl bg-surface px-4 py-3 text-sm">
        <Mail className="size-4 text-muted-foreground" />
        <span className="text-muted-foreground">Accedes con</span>
        <strong className="truncate font-semibold">{email ?? "—"}</strong>
      </p>
      <h3 className="mt-6 text-sm font-bold">Cambiar contraseña</h3>
      <div className="mt-4">
        <NewPasswordForm submitLabel="Actualizar contraseña" stay />
      </div>
    </section>
  );
}
