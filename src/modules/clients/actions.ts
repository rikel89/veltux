"use server";

import { refresh } from "next/cache";
import { redirect } from "next/navigation";
import { fieldErrors, type FormState } from "@/lib/validations/common";
import { requireMyProfessional } from "@/modules/professionals/context";
import { listClients, type ClientSummary } from "./queries";
import { clientIdSchema, clientSchema, quickClientSchema } from "./schemas";

const READ_ONLY: FormState = { error: "Tu ficha está desactivada: solo puedes consultar tus datos." };
const DUPLICATE_PHONE: FormState = { fieldErrors: { phone: "Ya tienes un cliente con este teléfono" } };

/** Alta completa desde «Mis clientes»: lleva a la ficha creada. */
export async function addClient(_prev: FormState, formData: FormData): Promise<FormState> {
  const { supabase, ctx } = await requireMyProfessional();
  if (!ctx) return { error: "No tienes ficha de profesional." };
  if (ctx.status !== "active") return READ_ONLY;

  const parsed = clientSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { fieldErrors: fieldErrors(parsed.error) };
  const v = parsed.data;

  const { data, error } = await supabase
    .from("clients")
    .insert({
      salon_id: ctx.salonId,
      professional_id: ctx.professionalId,
      full_name: v.fullName,
      phone: v.phone,
      email: v.email,
      notes: v.notes,
      marketing_consent: v.marketingConsent,
    })
    .select("id")
    .single();
  if (error?.code === "23505") return DUPLICATE_PHONE;
  if (error) return { error: "No se pudo crear el cliente." };

  redirect(`/profesional/clientes/${data.id}`);
}

export type QuickClientResult = { ok: true; client: { id: string; fullName: string; phone: string } } | FormState;

/** Alta rápida desde la agenda (nombre + teléfono); devuelve el cliente para seleccionarlo. */
export async function createQuickClient(input: { fullName: string; phone: string }): Promise<QuickClientResult> {
  const { supabase, ctx } = await requireMyProfessional();
  if (!ctx) return { error: "No tienes ficha de profesional." };
  if (ctx.status !== "active") return READ_ONLY;

  const parsed = quickClientSchema.safeParse(input);
  if (!parsed.success) return { fieldErrors: fieldErrors(parsed.error) };

  const { data, error } = await supabase
    .from("clients")
    .insert({
      salon_id: ctx.salonId,
      professional_id: ctx.professionalId,
      full_name: parsed.data.fullName,
      phone: parsed.data.phone,
    })
    .select("id, full_name, phone")
    .single();
  if (error?.code === "23505") return DUPLICATE_PHONE;
  if (error) return { error: "No se pudo crear el cliente." };

  return { ok: true, client: { id: data.id, fullName: data.full_name, phone: data.phone } };
}

export async function updateClient(_prev: FormState, formData: FormData): Promise<FormState> {
  const { supabase, ctx } = await requireMyProfessional();
  if (!ctx) return { error: "No tienes ficha de profesional." };
  if (ctx.status !== "active") return READ_ONLY;

  const id = clientIdSchema.safeParse(Object.fromEntries(formData));
  if (!id.success) return { error: "Cliente no válido." };
  const parsed = clientSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { fieldErrors: fieldErrors(parsed.error) };
  const v = parsed.data;

  const { data, error } = await supabase
    .from("clients")
    .update({ full_name: v.fullName, phone: v.phone, email: v.email, notes: v.notes, marketing_consent: v.marketingConsent })
    .eq("id", id.data.clientId)
    .eq("professional_id", ctx.professionalId)
    .select("id");
  if (error?.code === "23505") return DUPLICATE_PHONE;
  if (error) return { error: "No se pudieron guardar los cambios." };
  if (!data?.length) return { error: "No tienes permisos para modificar este cliente." };

  refresh();
  return { ok: true, message: "Ficha actualizada." };
}

/** Archivar (no se borra: sus citas siguen en el historial) o recuperar. */
export async function setClientArchived(_prev: FormState, formData: FormData): Promise<FormState> {
  const { supabase, ctx } = await requireMyProfessional();
  if (!ctx) return { error: "No tienes ficha de profesional." };
  if (ctx.status !== "active") return READ_ONLY;

  const id = clientIdSchema.safeParse(Object.fromEntries(formData));
  if (!id.success) return { error: "Cliente no válido." };
  const archive = formData.get("archive") === "true";

  const { data, error } = await supabase
    .from("clients")
    .update({ archived_at: archive ? new Date().toISOString() : null })
    .eq("id", id.data.clientId)
    .eq("professional_id", ctx.professionalId)
    .select("id");
  if (error?.code === "23505") return { error: "Ya tienes otro cliente activo con este teléfono." };
  if (error || !data?.length) return { error: "No se pudo actualizar el cliente." };

  refresh();
  return { ok: true, message: archive ? "Cliente archivado." : "Cliente recuperado." };
}

/** Buscador del selector de clientes de la agenda. */
export async function searchMyClients(query: string): Promise<ClientSummary[]> {
  const { supabase, ctx } = await requireMyProfessional();
  if (!ctx) return [];
  return listClients(supabase, ctx.professionalId, { query, limit: 8 });
}
