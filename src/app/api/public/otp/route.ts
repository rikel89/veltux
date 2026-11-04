import { getEmailSender } from "@/lib/email";
import { createAdminClient } from "@/lib/supabase/admin";
import { isSupabaseConfigured } from "@/lib/supabase/env";
import { fieldErrors } from "@/lib/validations/common";
import { otpRequestSchema, publicErrorCode } from "@/modules/booking/schemas";
import { errorResponse, ipHash, isSameOrigin, readJson } from "@/modules/booking/server";

/**
 * Pide un código de verificación para reservar. PostgreSQL limita los
 * códigos por email e IP y guarda solo su hash; aquí se envía el correo.
 */
export async function POST(request: Request) {
  if (!isSameOrigin(request)) return errorResponse("FORBIDDEN_ORIGIN");
  const sender = getEmailSender();
  if (!isSupabaseConfigured() || !sender || !process.env.SUPABASE_SECRET_KEY) return errorResponse("BOOKING_UNAVAILABLE");

  const parsed = otpRequestSchema.safeParse(await readJson(request));
  if (!parsed.success) return errorResponse("INVALID_INPUT", fieldErrors(parsed.error));

  const admin = createAdminClient();
  const { data, error } = await admin.rpc("request_booking_otp", {
    p_professional_id: parsed.data.professionalId,
    p_email: parsed.data.email,
    p_ip_hash: ipHash(request) ?? undefined,
  });
  if (error || !data?.[0]) return errorResponse(publicErrorCode(error?.message));

  const { otp_id, code, expires_at } = data[0];
  const sent = await sender.send({
    to: parsed.data.email,
    subject: `${code} es tu código de reserva`,
    text: `Tu código para confirmar la reserva es ${code}.\n\nCaduca en 10 minutos. Si no has pedido una cita, ignora este correo.`,
  });
  if (!sent.ok) {
    console.error(`[Código de reserva] ${sent.error}`);
    return errorResponse("EMAIL_FAILED");
  }

  return Response.json({ otpId: otp_id, expiresAt: expires_at, email: parsed.data.email }, { status: 201 });
}
