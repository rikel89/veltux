import { createAdminClient } from "@/lib/supabase/admin";
import { isSupabaseConfigured } from "@/lib/supabase/env";
import { fieldErrors } from "@/lib/validations/common";
import { bookingRequestSchema, publicErrorCode } from "@/modules/booking/schemas";
import { errorResponse, isSameOrigin, readJson } from "@/modules/booking/server";
import { flushNotificationsLater } from "@/modules/notifications/queue";

/** Verifica el código y crea la reserva en una sola transacción (create_public_booking). */
export async function POST(request: Request) {
  if (!isSameOrigin(request)) return errorResponse("FORBIDDEN_ORIGIN");
  if (!isSupabaseConfigured() || !process.env.SUPABASE_SECRET_KEY) return errorResponse("BOOKING_UNAVAILABLE");

  const parsed = bookingRequestSchema.safeParse(await readJson(request));
  if (!parsed.success) return errorResponse("INVALID_INPUT", fieldErrors(parsed.error));
  const v = parsed.data;

  const { data, error } = await createAdminClient().rpc("create_public_booking", {
    p_otp_id: v.otpId,
    p_code: v.code,
    p_service_id: v.serviceId,
    p_starts_at: v.startsAt,
    p_full_name: v.fullName,
    p_phone: v.phone,
    p_notes: v.notes ?? undefined,
  });
  if (error) return errorResponse(publicErrorCode(error.message));
  // La función devuelve null cuando el código no es correcto (el intento queda contado).
  if (!data) return errorResponse("OTP_INVALID", { code: "El código no es correcto" });

  flushNotificationsLater();
  return Response.json({ appointmentId: data }, { status: 201 });
}
