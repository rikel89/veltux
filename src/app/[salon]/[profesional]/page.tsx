import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { connection } from "next/server";
import { Suspense } from "react";
import { ArrowLeft } from "lucide-react";
import { BookingFlow } from "@/components/booking/booking-flow";
import { Skeleton } from "@/components/ui/skeleton";
import { toLocalDateKey } from "@/lib/datetime";
import { getSmsSender } from "@/lib/sms";
import { getPublicSalon } from "@/modules/booking/server";

export const metadata: Metadata = { title: "Reservar cita" };

export default function ProfessionalBookingPage({ params }: PageProps<"/[salon]/[profesional]">) {
  return (
    <Suspense fallback={<Skeleton className="h-96 rounded-2xl" />}>
      <BookingContent params={params} />
    </Suspense>
  );
}

async function BookingContent({ params }: { params: PageProps<"/[salon]/[profesional]">["params"] }) {
  await connection(); // los huecos dependen de la hora actual
  const { salon: salonSlug, profesional } = await params;
  const salon = await getPublicSalon(salonSlug);
  const professional = salon?.professionals.find((p) => p.slug === profesional.toLowerCase());
  if (!salon || !professional) notFound();

  return (
    <>
      {salon.professionals.length > 1 && (
        <Link href={`/${salon.slug}`} className="mb-5 inline-flex items-center gap-1 text-sm font-medium text-muted-foreground hover:text-foreground">
          <ArrowLeft className="size-4" /> Otros profesionales
        </Link>
      )}
      <BookingFlow
        salon={salon}
        professional={professional}
        todayKey={toLocalDateKey(new Date(), salon.timezone)}
        bookingEnabled={getSmsSender() !== null && Boolean(process.env.SUPABASE_SECRET_KEY)}
      />
    </>
  );
}
