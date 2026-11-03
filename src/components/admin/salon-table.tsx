import { Building2 } from "lucide-react";
import type { SalonOverviewRow } from "@/modules/salons/queries";
import { LicenseUsage, SalonStatusBadge } from "./salon-status";
import { publicLabel } from "@/lib/site";

const KIND: Record<string, string> = { barberia: "Barbería", peluqueria: "Peluquería", unisex: "Unisex" };
const date = new Intl.DateTimeFormat("es-ES", { day: "numeric", month: "short", year: "numeric" });

/** Tabla en escritorio, tarjetas en móvil. */
export function SalonTable({ rows, highlightSlug }: { rows: SalonOverviewRow[]; highlightSlug?: string | null }) {
  if (rows.length === 0) {
    return (
      <div className="flex flex-col items-center gap-3 rounded-2xl border border-dashed border-border bg-card px-6 py-14 text-center">
        <span className="grid size-12 place-items-center rounded-2xl bg-lime-soft text-lime-ink">
          <Building2 className="size-6" />
        </span>
        <p className="font-semibold">Aún no hay establecimientos</p>
        <p className="max-w-xs text-sm text-muted-foreground">Da de alta la primera peluquería del piloto.</p>
      </div>
    );
  }

  return (
    <>
      <ul className="space-y-3 md:hidden">
        {rows.map((r) => (
          <li
            key={r.salon_id}
            className={`rounded-2xl border bg-card p-4 shadow-card ${r.slug === highlightSlug ? "border-lime ring-2 ring-lime/50" : "border-border"}`}
          >
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="truncate font-semibold">{r.name}</p>
                <p className="truncate text-xs text-muted-foreground">{publicLabel(`/${r.slug}`)}</p>
              </div>
              <SalonStatusBadge status={r.status} />
            </div>
            <div className="mt-3 flex items-center justify-between text-xs text-muted-foreground">
              <span className="truncate">{r.owner_email ?? "Sin propietario"}</span>
              <LicenseUsage used={r.licenses_in_use} total={r.license_quantity} />
            </div>
          </li>
        ))}
      </ul>

      <div className="hidden overflow-hidden rounded-2xl border border-border bg-card shadow-card md:block">
        <table className="w-full text-sm">
          <thead className="border-b border-border bg-surface text-left text-xs font-semibold text-muted-foreground">
            <tr>
              <th className="px-5 py-3">Establecimiento</th>
              <th className="px-5 py-3">Propietario</th>
              <th className="px-5 py-3">Tipo</th>
              <th className="px-5 py-3">Estado</th>
              <th className="px-5 py-3">Licencias</th>
              <th className="px-5 py-3">Profesionales</th>
              <th className="px-5 py-3">Alta</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {rows.map((r) => (
              <tr key={r.salon_id} className={r.slug === highlightSlug ? "bg-lime-soft/60" : undefined}>
                <td className="px-5 py-3.5">
                  <p className="font-semibold">{r.name}</p>
                  <p className="text-xs text-muted-foreground">
                    {publicLabel(`/${r.slug}`)}
                    {r.city ? ` · ${r.city}` : ""}
                  </p>
                </td>
                <td className="px-5 py-3.5 text-muted-foreground">{r.owner_email ?? "—"}</td>
                <td className="px-5 py-3.5">{KIND[r.kind]}</td>
                <td className="px-5 py-3.5">
                  <SalonStatusBadge status={r.status} />
                </td>
                <td className="px-5 py-3.5">
                  <LicenseUsage used={r.licenses_in_use} total={r.license_quantity} />
                </td>
                <td className="px-5 py-3.5 tabular-nums">{r.professionals}</td>
                <td className="px-5 py-3.5 text-muted-foreground">{date.format(new Date(r.created_at))}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}
