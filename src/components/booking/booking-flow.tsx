"use client";

import { useEffect, useRef, useState } from "react";
import { ArrowLeft, CalendarCheck, Check, Clock, LoaderCircle, MapPin, MessageSquareText } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { formatLongDate, formatTime, toLocalDateKey } from "@/lib/datetime";
import { formatDuration, formatMoney, initials } from "@/lib/format";
import { cn } from "@/lib/utils";
import { bookableDays, describeNotice, groupSlots } from "@/modules/booking/flow";
import type { PublicProfessional, PublicSalon, PublicService } from "@/modules/booking/schemas";

type Step = "service" | "time" | "details" | "code" | "done";
type Slot = { startsAt: string; endsAt: string };
type ApiError = { error: string; message: string; fieldErrors?: Record<string, string> };

async function postJson<T>(url: string, body: unknown): Promise<{ ok: true; data: T } | { ok: false; error: ApiError }> {
  try {
    const res = await fetch(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
    const json = await res.json();
    return res.ok ? { ok: true, data: json as T } : { ok: false, error: json as ApiError };
  } catch {
    return { ok: false, error: { error: "NETWORK", message: "Sin conexión. Inténtalo de nuevo." } };
  }
}

export function BookingFlow({
  salon,
  professional: pro,
  todayKey,
  bookingEnabled,
}: {
  salon: Pick<PublicSalon, "name" | "slug" | "city" | "address_line" | "timezone">;
  professional: PublicProfessional;
  todayKey: string;
  bookingEnabled: boolean;
}) {
  const tz = salon.timezone;
  const [step, setStep] = useState<Step>("service");
  const [service, setService] = useState<PublicService | null>(null);
  const [dateKey, setDateKey] = useState(todayKey);
  const [slots, setSlots] = useState<{ key: string; list: Slot[] | null; error?: string } | null>(null);
  const [slot, setSlot] = useState<Slot | null>(null);
  const [details, setDetails] = useState({ fullName: "", phone: "", email: "", notes: "" });
  const [otp, setOtp] = useState<{ otpId: string; phone: string } | null>(null);
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<ApiError | null>(null);
  const days = bookableDays(todayKey, pro.booking_horizon_days);
  const top = useRef<HTMLDivElement>(null);

  const go = (next: Step) => {
    setError(null);
    setStep(next);
    top.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  const slotKey = service ? `${service.id}|${dateKey}` : "";
  useEffect(() => {
    if (step !== "time" || !service) return;
    let alive = true;
    const key = `${service.id}|${dateKey}`;
    fetch(`/api/public/slots?serviceId=${service.id}&from=${dateKey}&to=${dateKey}`, { cache: "no-store" })
      .then(async (res) => {
        const json = await res.json();
        if (!alive) return;
        setSlots(res.ok ? { key, list: json.slots } : { key, list: null, error: json.message });
      })
      .catch(() => alive && setSlots({ key, list: null, error: "Sin conexión. Inténtalo de nuevo." }));
    return () => {
      alive = false;
    };
  }, [step, service, dateKey]);
  const current = slots?.key === slotKey ? slots : null;

  const requestCode = async () => {
    setBusy(true);
    setError(null);
    const res = await postJson<{ otpId: string; phone: string }>("/api/public/otp", { professionalId: pro.id, phone: details.phone });
    setBusy(false);
    if (!res.ok) return setError(res.error);
    setOtp(res.data);
    setCode("");
    go("code");
  };

  const confirm = async () => {
    if (!otp || !service || !slot) return;
    setBusy(true);
    setError(null);
    const res = await postJson<{ appointmentId: string }>("/api/public/bookings", {
      otpId: otp.otpId,
      code,
      serviceId: service.id,
      startsAt: slot.startsAt,
      fullName: details.fullName,
      email: details.email,
      notes: details.notes,
    });
    setBusy(false);
    if (res.ok) return go("done");
    setError(res.error);
    if (res.error.error === "SLOT_UNAVAILABLE") {
      setSlot(null);
      setSlots(null);
      setStep("time");
    }
  };

  const errorFor = (field: string) => error?.fieldErrors?.[field];

  return (
    <div ref={top} className="scroll-mt-4">
      <header className="flex items-start gap-4">
        <span
          className="grid size-16 shrink-0 place-items-center rounded-2xl text-xl font-extrabold text-graphite"
          style={{ backgroundColor: pro.color }}
          aria-hidden
        >
          {initials(pro.display_name)}
        </span>
        <div className="min-w-0">
          <p className="text-sm font-medium text-muted-foreground">{salon.name}</p>
          <h1 className="text-2xl font-extrabold tracking-tight">{pro.display_name}</h1>
          {(salon.address_line || salon.city) && (
            <p className="mt-1 flex items-center gap-1 text-xs text-muted-foreground">
              <MapPin className="size-3.5" /> {[salon.address_line, salon.city].filter(Boolean).join(", ")}
            </p>
          )}
        </div>
      </header>
      {pro.bio && step === "service" && <p className="mt-4 text-sm text-muted-foreground">{pro.bio}</p>}

      {!bookingEnabled && (
        <p role="status" className="mt-5 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
          La confirmación por SMS aún no está activa: puedes consultar servicios y horas libres, pero no reservar online. Llama al establecimiento para pedir cita.
        </p>
      )}

      {step !== "service" && step !== "done" && (
        <Summary service={service} slot={slot} tz={tz} onBack={() => go(step === "time" ? "service" : step === "details" ? "time" : "details")} />
      )}

      {error && (
        <p role="alert" className="mt-5 rounded-xl bg-red-50 px-4 py-3 text-sm text-red-700">
          {error.message}
        </p>
      )}

      {step === "service" && (
        <section className="mt-6" aria-labelledby="step-service">
          <h2 id="step-service" className="text-base font-bold">
            Elige un servicio
          </h2>
          {pro.services.length === 0 ? (
            <p className="mt-3 text-sm text-muted-foreground">Este profesional aún no ha publicado servicios.</p>
          ) : (
            <ul className="mt-3 space-y-2">
              {pro.services.map((s) => (
                <li key={s.id}>
                  <button
                    type="button"
                    onClick={() => {
                      setService(s);
                      setSlot(null);
                      go("time");
                    }}
                    className="flex w-full items-center gap-4 rounded-2xl border border-border bg-card p-4 text-left shadow-card transition hover:border-graphite focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none"
                  >
                    <div className="min-w-0 flex-1">
                      <p className="font-semibold">{s.name}</p>
                      <p className="mt-0.5 flex items-center gap-1 text-xs text-muted-foreground">
                        <Clock className="size-3.5" /> {formatDuration(s.duration_minutes)}
                      </p>
                      {s.description && <p className="mt-1 line-clamp-2 text-xs text-muted-foreground">{s.description}</p>}
                    </div>
                    <span className="text-lg font-extrabold tabular-nums">{formatMoney(s.price_cents, s.currency)}</span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </section>
      )}

      {step === "time" && service && (
        <section className="mt-6" aria-labelledby="step-time">
          <h2 id="step-time" className="text-base font-bold">
            Elige día y hora
          </h2>
          {pro.min_notice_minutes > 0 && (
            <p className="mt-1 text-xs text-muted-foreground">Reserva con al menos {describeNotice(pro.min_notice_minutes)} de antelación.</p>
          )}
          <div className="-mx-4 mt-3 flex gap-2 overflow-x-auto px-4 pb-2 scrollbar-none" role="group" aria-label="Días">
            {days.map((d) => (
              <button
                key={d.dateKey}
                type="button"
                aria-pressed={d.dateKey === dateKey}
                onClick={() => {
                  setDateKey(d.dateKey);
                  setSlot(null);
                }}
                className={cn(
                  "flex w-14 shrink-0 flex-col items-center rounded-xl border py-2 text-xs transition-colors",
                  d.dateKey === dateKey ? "border-graphite bg-graphite text-white" : "border-border bg-card hover:bg-surface",
                )}
              >
                <span className="capitalize opacity-70">{d.weekday}</span>
                <span className="text-lg font-bold">{d.day}</span>
                <span className="capitalize opacity-70">{d.month}</span>
              </button>
            ))}
          </div>

          <div className="mt-4 min-h-32" aria-live="polite">
            {!current && (
              <p className="flex items-center gap-2 text-sm text-muted-foreground">
                <LoaderCircle className="size-4 animate-spin" /> Buscando horas libres…
              </p>
            )}
            {current?.error && <p className="text-sm text-muted-foreground">{current.error}</p>}
            {current?.list && current.list.length === 0 && (
              <p className="rounded-xl border border-dashed border-border bg-card px-4 py-6 text-center text-sm text-muted-foreground">
                No quedan horas libres este día. Prueba con otro.
              </p>
            )}
            {current?.list &&
              groupSlots(current.list, tz).map((group) => (
                <div key={group.label} className="mb-4">
                  <p className="mb-2 text-xs font-semibold tracking-wide text-muted-foreground uppercase">{group.label}</p>
                  <div className="grid grid-cols-4 gap-2 sm:grid-cols-6">
                    {group.slots.map((s) => {
                      const full = current.list!.find((x) => x.startsAt === s.startsAt)!;
                      const selected = slot?.startsAt === s.startsAt;
                      return (
                        <button
                          key={s.startsAt}
                          type="button"
                          aria-pressed={selected}
                          onClick={() => setSlot(full)}
                          className={cn(
                            "rounded-lg border py-2.5 text-sm font-semibold tabular-nums transition-colors",
                            selected ? "border-graphite bg-graphite text-lime" : "border-border bg-card hover:bg-surface",
                          )}
                        >
                          {s.time}
                        </button>
                      );
                    })}
                  </div>
                </div>
              ))}
          </div>

          <StickyAction disabled={!slot} onClick={() => go("details")}>
            Continuar
          </StickyAction>
        </section>
      )}

      {step === "details" && (
        <form
          className="mt-6 space-y-4"
          aria-labelledby="step-details"
          onSubmit={(e) => {
            e.preventDefault();
            void requestCode();
          }}
        >
          <h2 id="step-details" className="text-base font-bold">
            Tus datos
          </h2>
          <Field label="Nombre y apellidos" id="b-name" error={errorFor("fullName")}>
            <Input
              id="b-name"
              autoComplete="name"
              required
              value={details.fullName}
              onChange={(e) => setDetails({ ...details, fullName: e.target.value })}
              className="h-12 rounded-xl bg-white text-base"
            />
          </Field>
          <Field label="Teléfono móvil" id="b-phone" hint="Te enviaremos un código por SMS para confirmar la reserva." error={errorFor("phone")}>
            <Input
              id="b-phone"
              type="tel"
              inputMode="tel"
              autoComplete="tel"
              placeholder="600 000 000"
              required
              value={details.phone}
              onChange={(e) => setDetails({ ...details, phone: e.target.value })}
              className="h-12 rounded-xl bg-white text-base"
            />
          </Field>
          <Field label="Email (opcional)" id="b-email" error={errorFor("email")}>
            <Input
              id="b-email"
              type="email"
              inputMode="email"
              autoComplete="email"
              value={details.email}
              onChange={(e) => setDetails({ ...details, email: e.target.value })}
              className="h-12 rounded-xl bg-white text-base"
            />
          </Field>
          <Field label="Comentario para el profesional (opcional)" id="b-notes" error={errorFor("notes")}>
            <textarea
              id="b-notes"
              maxLength={500}
              value={details.notes}
              onChange={(e) => setDetails({ ...details, notes: e.target.value })}
              className="min-h-20 w-full rounded-xl border border-input bg-white px-4 py-3 text-base outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
            />
          </Field>
          <p className="text-xs text-muted-foreground">
            Tus datos solo los ve {pro.display_name}, para gestionar tu cita y avisarte de cambios.
          </p>
          <StickyAction type="submit" disabled={!bookingEnabled || busy || details.fullName.trim().length < 2 || details.phone.trim().length < 9} busy={busy}>
            <MessageSquareText /> Enviar código por SMS
          </StickyAction>
        </form>
      )}

      {step === "code" && otp && (
        <form
          className="mt-6 space-y-4"
          aria-labelledby="step-code"
          onSubmit={(e) => {
            e.preventDefault();
            void confirm();
          }}
        >
          <h2 id="step-code" className="text-base font-bold">
            Escribe el código
          </h2>
          <p className="text-sm text-muted-foreground">
            Te lo hemos enviado por SMS al <span className="font-semibold text-foreground tabular-nums">{otp.phone}</span>. Caduca en 10 minutos.
          </p>
          <Field label="Código de 6 cifras" id="b-code" error={errorFor("code")}>
            <Input
              id="b-code"
              inputMode="numeric"
              autoComplete="one-time-code"
              pattern="\d{6}"
              maxLength={6}
              value={code}
              onChange={(e) => setCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
              className="h-14 rounded-xl bg-white text-center text-2xl font-bold tracking-[0.5em] tabular-nums"
              autoFocus
            />
          </Field>
          <button type="button" className="text-sm font-semibold text-lime-ink underline-offset-4 hover:underline" onClick={() => go("details")}>
            Cambiar el teléfono o pedir otro código
          </button>
          <StickyAction type="submit" disabled={busy || code.length !== 6} busy={busy}>
            <CalendarCheck /> Confirmar reserva
          </StickyAction>
        </form>
      )}

      {step === "done" && service && slot && (
        <section className="mt-6 rounded-2xl bg-graphite p-6 text-white" aria-labelledby="step-done">
          <span className="grid size-12 place-items-center rounded-2xl bg-lime text-graphite">
            <Check className="size-6" strokeWidth={3} />
          </span>
          <h2 id="step-done" className="mt-4 text-xl font-extrabold">
            Reserva confirmada
          </h2>
          <p className="mt-1 text-sm text-neutral-300">
            {pro.display_name} ya tiene tu cita en su agenda.
          </p>
          <dl className="mt-5 space-y-2 text-sm">
            <div className="flex justify-between gap-4">
              <dt className="text-neutral-400">Servicio</dt>
              <dd className="text-right font-semibold">{service.name}</dd>
            </div>
            <div className="flex justify-between gap-4">
              <dt className="text-neutral-400">Cuándo</dt>
              <dd className="text-right font-semibold">
                {formatLongDate(toLocalDateKey(new Date(slot.startsAt), tz))} · {formatTime(slot.startsAt, tz)}
              </dd>
            </div>
            <div className="flex justify-between gap-4">
              <dt className="text-neutral-400">Precio</dt>
              <dd className="text-right font-semibold">{formatMoney(service.price_cents, service.currency)}</dd>
            </div>
            <div className="flex justify-between gap-4">
              <dt className="text-neutral-400">Dónde</dt>
              <dd className="text-right font-semibold">{[salon.name, salon.address_line, salon.city].filter(Boolean).join(", ")}</dd>
            </div>
          </dl>
          <p className="mt-5 text-xs text-neutral-400">Si no puedes venir, avisa al establecimiento para liberar la hora.</p>
        </section>
      )}
    </div>
  );
}

function Summary({ service, slot, tz, onBack }: { service: PublicService | null; slot: Slot | null; tz: string; onBack: () => void }) {
  if (!service) return null;
  return (
    <div className="mt-5 flex items-center gap-3 rounded-2xl border border-border bg-card p-3 shadow-card">
      <Button type="button" variant="ghost" size="icon" className="size-10 shrink-0" onClick={onBack} aria-label="Volver al paso anterior">
        <ArrowLeft />
      </Button>
      <div className="min-w-0 flex-1 text-sm">
        <p className="truncate font-semibold">{service.name}</p>
        <p className="truncate text-xs text-muted-foreground">
          {formatDuration(service.duration_minutes)} · {formatMoney(service.price_cents, service.currency)}
          {slot && ` · ${formatLongDate(toLocalDateKey(new Date(slot.startsAt), tz))}, ${formatTime(slot.startsAt, tz)}`}
        </p>
      </div>
    </div>
  );
}

function Field({ label, id, hint, error, children }: { label: string; id: string; hint?: string; error?: string; children: React.ReactNode }) {
  return (
    <div className="space-y-2">
      <Label htmlFor={id}>{label}</Label>
      {children}
      {hint && !error && <p className="text-xs text-muted-foreground">{hint}</p>}
      {error && <p className="text-xs font-medium text-destructive">{error}</p>}
    </div>
  );
}

function StickyAction({
  children,
  disabled,
  busy,
  onClick,
  type = "button",
}: {
  children: React.ReactNode;
  disabled?: boolean;
  busy?: boolean;
  onClick?: () => void;
  type?: "button" | "submit";
}) {
  return (
    <div className="sticky bottom-0 -mx-4 mt-6 border-t border-border bg-surface/95 px-4 py-3 backdrop-blur sm:static sm:mx-0 sm:border-0 sm:bg-transparent sm:p-0">
      <Button type={type} size="lg" disabled={disabled} onClick={onClick} className="h-12 w-full shadow-lime">
        {busy && <LoaderCircle className="animate-spin" />}
        {children}
      </Button>
    </div>
  );
}
