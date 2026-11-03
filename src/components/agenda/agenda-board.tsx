"use client";

import Link from "next/link";
import { useState } from "react";
import { CalendarPlus, ChevronLeft, ChevronRight, CircleCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { cn } from "@/lib/utils";
import { type AgendaAppointment, type AgendaDay, visibleHourRange } from "@/modules/appointments/agenda";
import type { AgendaView } from "@/modules/appointments/schemas";
import { AppointmentDetail } from "./appointment-detail";
import { NewAppointmentForm, type ServiceOption } from "./new-appointment-form";
import { TimeGrid } from "./time-grid";

type Props = {
  view: AgendaView;
  title: string;
  dateKey: string;
  todayKey: string;
  prevKey: string;
  nextKey: string;
  days: AgendaDay[];
  dayLabels: { dateKey: string; short: string; day: string }[];
  services: ServiceOption[];
  timeZone: string;
  nowIso: string;
  nowMin: number;
  readOnly?: boolean;
  demo?: boolean;
  openNew?: boolean;
};

type Draft = { key: number; date: string; time: string | null };

export function AgendaBoard(props: Props) {
  const { view, title, dateKey, todayKey, prevKey, nextKey, days, dayLabels, services, timeZone, nowIso, nowMin } = props;
  const locked = Boolean(props.readOnly || props.demo);
  const [draft, setDraft] = useState<Draft | null>(props.openNew && !locked ? { key: 0, date: dateKey, time: null } : null);
  const [selected, setSelected] = useState<AgendaAppointment | null>(null);
  const [flash, setFlash] = useState<string | null>(null);
  const { startHour, endHour } = visibleHourRange(days);
  const href = (key: string, v: AgendaView = view) => `/profesional/agenda?fecha=${key}&vista=${v}`;
  const count = days.reduce((n, d) => n + d.appointments.length, 0);

  const openNew = (date: string, time: string | null) => {
    setFlash(null);
    setDraft({ key: Date.now(), date: date < todayKey ? todayKey : date, time });
  };
  const done = (message: string) => {
    setDraft(null);
    setSelected(null);
    setFlash(message);
  };

  return (
    <div className="mx-auto flex max-w-[1400px] flex-col gap-4">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <h1 className="text-2xl font-extrabold tracking-tight sm:text-3xl">Mi agenda</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {title} · {count === 0 ? "sin citas" : `${count} ${count === 1 ? "cita" : "citas"}`}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex items-center rounded-xl border border-border bg-card p-1 shadow-card">
            <Button asChild variant="ghost" size="icon" className="size-9">
              <Link href={href(prevKey)} aria-label={view === "dia" ? "Día anterior" : "Semana anterior"}>
                <ChevronLeft />
              </Link>
            </Button>
            <Button asChild variant="ghost" size="sm" className="h-9 px-3">
              <Link href={href(todayKey)}>Hoy</Link>
            </Button>
            <Button asChild variant="ghost" size="icon" className="size-9">
              <Link href={href(nextKey)} aria-label={view === "dia" ? "Día siguiente" : "Semana siguiente"}>
                <ChevronRight />
              </Link>
            </Button>
          </div>
          <nav aria-label="Vista" className="flex rounded-xl border border-border bg-card p-1 shadow-card">
            {(["dia", "semana"] as const).map((v) => (
              <Link
                key={v}
                href={href(dateKey, v)}
                aria-current={view === v ? "page" : undefined}
                className={cn(
                  "rounded-lg px-3 py-1.5 text-sm font-semibold",
                  view === v ? "bg-graphite text-white" : "text-muted-foreground hover:text-foreground",
                )}
              >
                {v === "dia" ? "Día" : "Semana"}
              </Link>
            ))}
          </nav>
          {!locked && (
            <Button size="lg" className="h-11 shadow-lime" onClick={() => openNew(dateKey, null)}>
              <CalendarPlus /> Nueva cita
            </Button>
          )}
        </div>
      </div>

      {props.demo && (
        <p className="rounded-xl border border-dashed border-border bg-card px-4 py-3 text-sm text-muted-foreground">
          Modo demostración: las citas son de ejemplo (marcadas DEMO) y no se pueden crear ni modificar.
        </p>
      )}
      {flash && (
        <p role="status" className="flex items-center gap-2 rounded-xl bg-lime-soft px-4 py-3 text-sm font-medium text-lime-ink">
          <CircleCheck className="size-4 shrink-0" /> {flash}
        </p>
      )}

      <section className="overflow-hidden rounded-2xl border border-border bg-card shadow-card" aria-label="Agenda">
        <div className={cn(view === "semana" && "overflow-x-auto")}>
          <div className={cn(view === "semana" && "min-w-[760px]")}>
            {view === "semana" && (
              <div className="sticky top-0 z-20 flex border-b border-border bg-card">
                <div className="w-12 shrink-0" />
                {dayLabels.map((d) => (
                  <Link
                    key={d.dateKey}
                    href={href(d.dateKey, "dia")}
                    className={cn(
                      "flex flex-1 flex-col items-center border-l border-border py-2 text-xs hover:bg-surface",
                      d.dateKey === todayKey && "text-lime-ink",
                    )}
                  >
                    <span className="font-medium text-muted-foreground uppercase">{d.short}</span>
                    <span
                      className={cn(
                        "mt-0.5 grid size-7 place-items-center rounded-full text-sm font-bold",
                        d.dateKey === todayKey && "bg-graphite text-lime",
                      )}
                    >
                      {d.day}
                    </span>
                  </Link>
                ))}
              </div>
            )}
            <div className="py-3 pr-2 sm:pr-3">
              <TimeGrid
                days={days}
                startHour={startHour}
                endHour={endHour}
                hourPx={view === "dia" ? 72 : 52}
                todayKey={todayKey}
                nowMin={nowMin}
                demo={props.demo}
                onPickTime={locked ? undefined : (d, t) => openNew(d, t)}
                onOpenAppointment={(a) => {
                  setFlash(null);
                  setSelected(a);
                }}
              />
            </div>
          </div>
        </div>
      </section>
      {!locked && <p className="text-xs text-muted-foreground">Toca un hueco libre de la agenda para crear una cita a esa hora.</p>}

      <Sheet open={draft !== null} onOpenChange={(open) => !open && setDraft(null)}>
        <SheetContent className="overflow-y-auto data-[side=right]:w-full data-[side=right]:sm:max-w-md">
          <SheetHeader className="px-5 pt-5">
            <SheetTitle className="text-lg font-bold">Nueva cita</SheetTitle>
            <SheetDescription>Elige cliente, servicio y un hueco libre.</SheetDescription>
          </SheetHeader>
          <div className="px-5 pb-8">
            {draft && (
              <NewAppointmentForm
                key={draft.key}
                services={services}
                todayKey={todayKey}
                initialDate={draft.date}
                initialTime={draft.time}
                onDone={done}
              />
            )}
          </div>
        </SheetContent>
      </Sheet>

      <Sheet open={selected !== null} onOpenChange={(open) => !open && setSelected(null)}>
        <SheetContent className="overflow-y-auto data-[side=right]:w-full data-[side=right]:sm:max-w-md">
          <SheetHeader className="px-5 pt-5">
            <SheetTitle className="text-lg font-bold">{selected?.clientName ?? "Cita"}</SheetTitle>
            <SheetDescription>Detalle de la cita</SheetDescription>
          </SheetHeader>
          <div className="px-5 pb-8">
            {selected && (
              <AppointmentDetail
                key={selected.id}
                appointment={selected}
                timeZone={timeZone}
                nowIso={nowIso}
                readOnly={Boolean(props.readOnly)}
                demo={Boolean(props.demo)}
                onDone={done}
              />
            )}
          </div>
        </SheetContent>
      </Sheet>
    </div>
  );
}
