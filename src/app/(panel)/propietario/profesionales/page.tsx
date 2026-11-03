import type { Metadata } from "next";
import Link from "next/link";
import { KeyRound, UserPlus } from "lucide-react";
import { PageHeader } from "@/components/layout/page-header";
import { InviteForm } from "@/components/team/invite-form";
import { MemberActions } from "@/components/team/member-actions";
import { LicenseBadge, ProfessionalStatusBadge } from "@/components/team/status-badges";
import { Button } from "@/components/ui/button";
import { initials } from "@/lib/format";
import { ownerSalon, requireArea } from "@/modules/auth/access";
import { getSalonTeam } from "@/modules/licensing/queries";

export const metadata: Metadata = { title: "Profesionales" };

export default async function OwnerProfessionalsPage() {
  const access = await requireArea("owner");
  const salon = ownerSalon(access);
  const team = salon ? await getSalonTeam(salon.salonId, access.userId) : null;
  if (!team) return <p className="text-sm text-muted-foreground">No se encontró tu establecimiento.</p>;

  const free = Math.max(0, team.quantity - team.inUse);

  return (
    <div className="mx-auto flex max-w-[1400px] flex-col gap-6">
      <PageHeader
        title="Profesionales"
        description="Autónomos de tu establecimiento. Cada uno gestiona su agenda, sus servicios y sus clientes."
        actions={
          <Button asChild variant="outline" size="lg" className="bg-white">
            <Link href="/propietario/licencias">
              <KeyRound /> {team.inUse}/{team.quantity} licencias
            </Link>
          </Button>
        }
      />

      <div className="grid gap-5 lg:grid-cols-3 lg:gap-6">
        <section aria-labelledby="equipo" className="rounded-2xl border border-border bg-card shadow-card lg:col-span-2">
          <header className="border-b border-border px-5 py-4 sm:px-6">
            <h2 id="equipo" className="text-base font-bold">
              Equipo · {team.members.length}
            </h2>
            <p className="text-xs text-muted-foreground">No tienes acceso a las carteras de clientes ni a las citas de cada profesional.</p>
          </header>
          {team.members.length === 0 ? (
            <p className="px-6 py-12 text-center text-sm text-muted-foreground">Aún no hay profesionales. Invita al primero.</p>
          ) : (
            <ul className="divide-y divide-border">
              {team.members.map((m) => (
                <li key={m.id} className="flex flex-wrap items-center gap-x-4 gap-y-3 px-5 py-4 sm:px-6">
                  <span className="grid size-10 shrink-0 place-items-center rounded-full bg-graphite text-xs font-bold text-lime">
                    {initials(m.displayName)}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-semibold">
                      {m.displayName}
                      {m.isSelf && <span className="ml-1.5 text-xs font-medium text-muted-foreground">(tú)</span>}
                    </p>
                    <p className="truncate text-xs text-muted-foreground">
                      {m.email ?? "—"} · veltux.es/{team.salonSlug}/{m.slug}
                    </p>
                    <div className="mt-2 flex flex-wrap gap-1.5">
                      <ProfessionalStatusBadge status={m.status} />
                      <LicenseBadge licensed={Boolean(m.license)} />
                    </div>
                  </div>
                  <div className="ml-auto">
                    <MemberActions professionalId={m.id} name={m.displayName} status={m.status} isSelf={m.isSelf} />
                  </div>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section aria-labelledby="invitar" className="h-fit rounded-2xl border border-border bg-card p-5 shadow-card sm:p-6">
          <h2 id="invitar" className="flex items-center gap-2 text-base font-bold">
            <UserPlus className="size-4 text-lime-ink" /> Invitar profesional
          </h2>
          <p className="mt-1 mb-5 text-xs text-muted-foreground">
            Recibirá un email para crear su contraseña y empezar con su propia agenda.
          </p>
          <InviteForm salonSlug={team.salonSlug} freeLicenses={free} />
        </section>
      </div>
    </div>
  );
}
