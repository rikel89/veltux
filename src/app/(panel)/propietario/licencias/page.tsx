import type { Metadata } from "next";
import { History } from "lucide-react";
import { PageHeader } from "@/components/layout/page-header";
import { AssignLicenseButton, RevokeLicenseForm } from "@/components/team/license-actions";
import { LicenseQuota, ProfessionalStatusBadge } from "@/components/team/status-badges";
import { initials } from "@/lib/format";
import { ownerSalon, requireArea } from "@/modules/auth/access";
import { getLicenseHistory, getSalonTeam } from "@/modules/licensing/queries";

export const metadata: Metadata = { title: "Licencias" };

const dateTime = new Intl.DateTimeFormat("es-ES", { day: "numeric", month: "short", year: "numeric" });

export default async function OwnerLicensesPage() {
  const access = await requireArea("owner");
  const salon = ownerSalon(access);
  if (!salon) return <p className="text-sm text-muted-foreground">No se encontró tu establecimiento.</p>;
  const [team, history] = await Promise.all([getSalonTeam(salon.salonId, access.userId), getLicenseHistory(salon.salonId)]);
  if (!team) return <p className="text-sm text-muted-foreground">No se encontró tu establecimiento.</p>;

  const free = Math.max(0, team.quantity - team.inUse);

  return (
    <div className="mx-auto flex max-w-[1400px] flex-col gap-6">
      <PageHeader
        title="Licencias"
        description="Cada profesional activo con agenda consume una licencia. También la tuya, si atiendes clientes."
      />

      <div className="grid gap-5 lg:grid-cols-3 lg:gap-6">
        <section className="relative overflow-hidden rounded-2xl bg-graphite p-6 text-white" aria-label="Cupo de licencias">
          <div aria-hidden className="pointer-events-none absolute -right-16 -bottom-20 size-56 rounded-full bg-lime/15 blur-3xl" />
          <div className="relative">
            <LicenseQuota inUse={team.inUse} quantity={team.quantity} />
            <p className="mt-6 border-t border-white/10 pt-4 text-xs text-neutral-400">
              Durante el piloto, el número de licencias contratadas lo ajusta VELTUX. Escríbenos para ampliarlo.
            </p>
          </div>
        </section>

        <section aria-labelledby="asignaciones" className="rounded-2xl border border-border bg-card shadow-card lg:col-span-2">
          <header className="border-b border-border px-5 py-4 sm:px-6">
            <h2 id="asignaciones" className="text-base font-bold">
              Asignaciones
            </h2>
          </header>
          {team.members.length === 0 ? (
            <p className="px-6 py-10 text-center text-sm text-muted-foreground">Aún no hay profesionales.</p>
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
                    <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                      <ProfessionalStatusBadge status={m.status} />
                      {m.license && <span>Asignada el {dateTime.format(new Date(m.license.assignedAt))}</span>}
                    </div>
                  </div>
                  <div className="ml-auto">
                    {m.license ? (
                      <RevokeLicenseForm assignmentId={m.license.assignmentId} name={m.displayName} />
                    ) : (
                      <AssignLicenseButton
                        professionalId={m.id}
                        disabledReason={
                          m.status === "inactive"
                            ? "Reactívalo primero"
                            : free === 0
                              ? "No quedan licencias libres"
                              : undefined
                        }
                      />
                    )}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>

      <section aria-labelledby="historial" className="rounded-2xl border border-border bg-card shadow-card">
        <header className="flex items-center gap-2 border-b border-border px-5 py-4 sm:px-6">
          <History className="size-4 text-muted-foreground" />
          <h2 id="historial" className="text-base font-bold">
            Historial
          </h2>
        </header>
        {history.length === 0 ? (
          <p className="px-6 py-8 text-center text-sm text-muted-foreground">Sin movimientos.</p>
        ) : (
          <ol className="divide-y divide-border">
            {history.map((h) => (
              <li key={h.id} className="grid gap-1 px-5 py-3 text-sm sm:grid-cols-[1fr_auto] sm:px-6">
                <p>
                  <span className="font-semibold">{h.professionalName}</span>
                  <span className="text-muted-foreground">
                    {" "}
                    · asignada el {dateTime.format(new Date(h.assignedAt))}
                    {h.revokedAt && ` · liberada el ${dateTime.format(new Date(h.revokedAt))}`}
                  </span>
                </p>
                <p className="text-xs text-muted-foreground sm:text-right">
                  {h.revokedAt ? (h.reason ?? "Liberada") : <span className="font-semibold text-lime-ink">En uso</span>}
                </p>
              </li>
            ))}
          </ol>
        )}
      </section>
    </div>
  );
}
