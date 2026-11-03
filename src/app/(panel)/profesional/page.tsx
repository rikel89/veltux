import type { Metadata } from "next";
import { Suspense } from "react";
import { Building2 } from "lucide-react";
import { DashboardSkeleton } from "@/components/dashboard/dashboard-skeleton";
import { ProfessionalDashboardView } from "@/components/dashboard/professional-dashboard-view";
import { getProfessionalDashboard } from "@/modules/dashboard/professional-dashboard";

export const metadata: Metadata = { title: "Dashboard" };

export default function ProfessionalDashboardPage() {
  return (
    <Suspense fallback={<DashboardSkeleton />}>
      <Dashboard />
    </Suspense>
  );
}

async function Dashboard() {
  const result = await getProfessionalDashboard();

  if (result.kind === "no-professional") {
    return (
      <div className="mx-auto mt-10 max-w-lg rounded-2xl border border-border bg-card p-8 text-center shadow-card">
        <span className="mx-auto grid size-12 place-items-center rounded-2xl bg-lime-soft text-lime-ink">
          <Building2 className="size-6" />
        </span>
        <h1 className="mt-4 text-xl font-extrabold">Tu cuenta aún no tiene agenda</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          {result.email ? <strong className="text-foreground">{result.email}</strong> : "Tu usuario"} no está vinculado a
          ningún establecimiento como profesional. Pide una invitación al propietario o registra tu peluquería (Sprint 1).
        </p>
      </div>
    );
  }

  return <ProfessionalDashboardView data={result.data} />;
}
