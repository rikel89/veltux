import { createAdminClient } from "@/lib/supabase/admin";
import { isSupabaseConfigured } from "@/lib/supabase/env";
import { getSmsSender } from "@/lib/sms";
import { fieldErrors } from "@/lib/validations/common";
import { otpRequestSchema, publicErrorCode } from "@/modules/booking/schemas";
import { errorResponse, ipHash, isSameOrigin, readJson } from "@/modules/booking/server";

/**
 * Pide un código de verificación para reservar. PostgreSQL limita los
 * códigos por teléfono e IP y guarda solo su hash; aquí se envía el SMS.
 */
export async function POST(request: Request) {
  if (!isSameOrigin(request)) return errorResponse("FORBIDDEN_ORIGIN");
  const sms = getSmsSender();
  if (!isSupabaseConfigured() || !sms || !process.env.SUPABASE_SECRET_KEY) return errorResponse("SMS_UNAVAILABLE");

  const parsed = otpRequestSchema.safeParse(await readJson(request));
  if (!parsed.success) return errorResponse("INVALID_INPUT", fieldErrors(parsed.error));

  const admin = createAdminClient();
  const { data, error } = await admin.rpc("request_booking_otp", {
    p_professional_id: parsed.data.professionalId,
    p_phone: parsed.data.phone,
    p_ip_hash: ipHash(request) ?? undefined,
  });
  if (error || !data?.[0]) return errorResponse(publicErrorCode(error?.message));

  const { otp_id, code, expires_at } = data[0];
  const sent = await sms.send(parsed.data.phone, `VELTUX: tu código para confirmar la reserva es ${code}. Caduca en 10 minutos.`);
  if (!sent.ok) return errorResponse("SMS_FAILED");

  return Response.json({ otpId: otp_id, expiresAt: expires_at, phone: parsed.data.phone }, { status: 201 });
}
