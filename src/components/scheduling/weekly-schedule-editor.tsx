"use client";

import { useActionState, useMemo, useState } from "react";
import { Copy, Plus, X } from "lucide-react";
import { FormMessage, SubmitButton } from "@/components/forms/form-status";
import { Button } from "@/components/ui/button";
import { formatDuration } from "@/lib/format";
import { cn } from "@/lib/utils";
import type { FormState } from "@/lib/validations/common";
import { saveWeeklySchedule } from "@/modules/scheduling/actions";
import type { WeeklyScheduleSlot } from "@/modules/scheduling/occupancy";
import {
  groupByWeekday,
  MAX_WEEKLY_SLOTS,
  toMinutes,
  WEEKDAYS,
  weeklyMinutes,
  weeklyScheduleSchema,
} from "@/modules/scheduling/schemas";

type Row = { key: number; startTime: string; endTime: string };
type Days = Record<number, Row[]>;

let nextKey = 1;
const withKeys = (slots: { startTime: string; endTime: string }[]): Row[] => slots.map((s) => ({ key: nextKey++, ...s }));

const fromMinutes = (m: number) => `${String(Math.floor(m / 60)).padStart(2, "0")}:${String(m % 60).padStart(2, "0")}`;

/** Siguiente franja razonable: una hora después de la última, de 4 h como máximo. */
function nextSlot(rows: Row[]): { startTime: string; endTime: string } {
  if (rows.length === 0) return { startTime: "09:00", endTime: "14:00" };
  const lastEnd = Math.max(...rows.map((r) => toMinutes(r.endTime)));
  const start = Math.min(lastEnd + 60, 22 * 60);
  return { startTime: fromMinutes(start), endTime: fromMinutes(Math.min(start + 240, 23 * 60 + 55)) };
}

function flatten(days: Days): (WeeklyScheduleSlot & { key: number })[] {
  return WEEKDAYS.flatMap((d) => days[d.value].map((r) => ({ weekday: d.value, ...r })));
}

const timeInputClass =
  "h-11 w-full min-w-0 rounded-xl border border-input bg-white px-3 text-base tabular-nums outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 aria-invalid:border-destructive md:text-sm";

export function WeeklyScheduleEditor({
  initial,
  readOnly = false,
  demo = false,
}: {
  initial: WeeklyScheduleSlot[];
  readOnly?: boolean;
  /** Editable pero sin guardar. */
  demo?: boolean;
}) {
  const [days, setDays] = useState<Days>(() => {
    const grouped = groupByWeekday(initial);
    return Object.fromEntries(WEEKDAYS.map((d) => [d.value, withKeys(grouped[d.value])])) as Days;
  });
  const [state, action] = useActionState<FormState, FormData>(saveWeeklySchedule, {});

  const flat = useMemo(() => flatten(days), [days]);
  const errors = useMemo(() => {
    const parsed = weeklyScheduleSchema.safeParse(flat.map(({ weekday, startTime, endTime }) => ({ weekday, startTime, endTime })));
    const out = new Map<number, string>();
    if (!parsed.success) {
      for (const issue of parsed.error.issues) {
        const index = issue.path[0];
        const row = typeof index === "number" ? flat[index] : undefined;
        if (row && !out.has(row.key)) out.set(row.key, issue.message);
      }
    }
    return { byKey: out, global: parsed.success ? null : (parsed.error.issues.find((i) => i.path.length === 0)?.message ?? null) };
  }, [flat]);

  const update = (weekday: number, fn: (rows: Row[]) => Row[]) => setDays((prev) => ({ ...prev, [weekday]: fn(prev[weekday]) }));
  const total = weeklyMinutes(flat);
  const invalid = errors.byKey.size > 0 || errors.global !== null;

  const copyMondayToWeekdays = () =>
    setDays((prev) => {
      const next = { ...prev };
      for (const day of [2, 3, 4, 5]) next[day] = withKeys(prev[1]);
      return next;
    });

  return (
    <form action={action} className="space-y-4">
      <input
        type="hidden"
        name="slots"
        value={JSON.stringify(flat.map(({ weekday, startTime, endTime }) => ({ weekday, startTime, endTime })))}
      />

      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm text-muted-foreground">
          <span className="font-semibold text-foreground tabular-nums">{total === 0 ? "0 h" : formatDuration(total)}</span> semanales
        </p>
        {!readOnly && days[1].length > 0 && (
          <Button type="button" variant="outline" size="sm" className="bg-white" onClick={copyMondayToWeekdays}>
            <Copy /> Copiar el lunes a martes–viernes
          </Button>
        )}
      </div>

      <ul className="divide-y divide-border rounded-2xl border border-border bg-card shadow-card">
        {WEEKDAYS.map((day) => {
          const rows = days[day.value];
          const open = rows.length > 0;
          return (
            <li key={day.value} className="flex flex-col gap-3 p-4 sm:flex-row sm:items-start sm:gap-6 sm:px-5">
              <label className="flex w-full shrink-0 items-center justify-between gap-3 sm:w-40 sm:pt-2.5">
                <span className={cn("font-semibold", !open && "text-muted-foreground")}>{day.label}</span>
                <input
                  type="checkbox"
                  role="switch"
                  aria-label={`${day.label}: ${open ? "trabajas" : "libre"}`}
                  checked={open}
                  disabled={readOnly}
                  onChange={(e) => update(day.value, () => (e.target.checked ? withKeys([nextSlot([])]) : []))}
                  className="peer sr-only"
                />
                <span
                  aria-hidden
                  className={cn(
                    "relative h-6 w-11 shrink-0 rounded-full transition-colors peer-focus-visible:ring-3 peer-focus-visible:ring-ring/50",
                    open ? "bg-graphite" : "bg-border",
                    "after:absolute after:top-0.5 after:left-0.5 after:size-5 after:rounded-full after:bg-white after:shadow after:transition-transform",
                    open && "after:translate-x-5 after:bg-lime",
                  )}
                />
              </label>

              <div className="min-w-0 flex-1 space-y-2">
                {!open && <p className="text-sm text-muted-foreground sm:pt-2.5">Libre</p>}
                {rows.map((row, i) => {
                  const error = errors.byKey.get(row.key);
                  return (
                    <div key={row.key}>
                      <div className="flex items-center gap-2">
                        <input
                          type="time"
                          step={300}
                          aria-label={`${day.label}, franja ${i + 1}: inicio`}
                          value={row.startTime}
                          disabled={readOnly}
                          aria-invalid={Boolean(error)}
                          onChange={(e) =>
                            update(day.value, (r) => r.map((x) => (x.key === row.key ? { ...x, startTime: e.target.value } : x)))
                          }
                          className={timeInputClass}
                        />
                        <span className="text-muted-foreground">–</span>
                        <input
                          type="time"
                          step={300}
                          aria-label={`${day.label}, franja ${i + 1}: fin`}
                          value={row.endTime}
                          disabled={readOnly}
                          aria-invalid={Boolean(error)}
                          onChange={(e) =>
                            update(day.value, (r) => r.map((x) => (x.key === row.key ? { ...x, endTime: e.target.value } : x)))
                          }
                          className={timeInputClass}
                        />
                        {!readOnly && (
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            className="size-11 shrink-0 text-muted-foreground"
                            aria-label={`Quitar franja ${i + 1} del ${day.label.toLowerCase()}`}
                            onClick={() => update(day.value, (r) => r.filter((x) => x.key !== row.key))}
                          >
                            <X />
                          </Button>
                        )}
                      </div>
                      {error && <p className="mt-1 text-xs font-medium text-destructive">{error}</p>}
                    </div>
                  );
                })}
                {open && !readOnly && rows.length < 4 && flat.length < MAX_WEEKLY_SLOTS && (
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="text-muted-foreground"
                    onClick={() => update(day.value, (r) => [...r, ...withKeys([nextSlot(r)])])}
                  >
                    <Plus /> {rows.length === 1 ? "Jornada partida" : "Añadir franja"}
                  </Button>
                )}
              </div>
            </li>
          );
        })}
      </ul>

      {errors.global && <p className="text-xs font-medium text-destructive">{errors.global}</p>}
      <FormMessage state={state} />
      {!readOnly && !demo && (
        <div className="flex flex-col items-stretch gap-2 sm:flex-row sm:items-center sm:justify-end">
          <p className="text-xs text-muted-foreground sm:mr-auto">
            Los cambios se aplican desde hoy. Las citas ya reservadas no se modifican.
          </p>
          <SubmitButton className={cn("w-full sm:w-auto", invalid && "pointer-events-none opacity-50")}>Guardar horario</SubmitButton>
        </div>
      )}
    </form>
  );
}
