import { isSupabaseConfigured } from "@/lib/supabase/env";
import { createPublicClient } from "@/lib/supabase/public";
import { fieldErrors } from "@/lib/validations/common";
import { slotsQuerySchema, publicErrorCode } from "@/modules/booking/schemas";
import { errorResponse } from "@/modules/booking/server";

/** Huecos libres de un servicio público (get_available_slots como anónimo). */
export async function GET(request: Request) {
  if (!isSupabaseConfigured()) return errorResponse("NOT_BOOKABLE");

  const params = Object.fromEntries(new URL(request.url).searchParams);
  const parsed = slotsQuerySchema.safeParse(params);
  if (!parsed.success) return errorResponse("INVALID_INPUT", fieldErrors(parsed.error));

  const { data, error } = await createPublicClient().rpc("get_available_slots", {
    p_service_id: parsed.data.serviceId,
    p_from: parsed.data.from,
    p_to: parsed.data.to,
  });
  if (error) return errorResponse(publicErrorCode(error.message));

  return Response.json(
    { slots: data.map((s) => ({ startsAt: s.starts_at, endsAt: s.ends_at })) },
    { headers: { "Cache-Control": "no-store" } },
  );
}
