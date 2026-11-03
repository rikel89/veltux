import type { AppointmentStatus } from "@/types/database.types";
import type { DayOccupancy } from "@/modules/scheduling/occupancy";

export type DashboardAppointment = {
  id: string;
  startsAt: string;
  endsAt: string;
  clientName: string;
  serviceName: string;
  priceCents: number;
  currency: string;
  status: AppointmentStatus;
};

export type ProfessionalDashboard = {
  /** "demo": datos ficticios sin backend. "live": datos reales protegidos por RLS. */
  mode: "demo" | "live";
  professional: {
    displayName: string;
    salonName: string;
    salonSlug: string;
    timeZone: string;
    hasActiveLicense: boolean;
  };
  now: string;
  todayKey: string;
  stats: {
    appointmentsToday: number;
    revenueTodayCents: number;
    occupancyWeekPct: number | null;
    newClientsMonth: number;
  };
  agenda: DashboardAppointment[];
  nextAppointment: DashboardAppointment | null;
  week: DayOccupancy[];
};

export type DashboardResult =
  | { kind: "ready"; data: ProfessionalDashboard }
  | { kind: "no-professional"; email: string | null };
