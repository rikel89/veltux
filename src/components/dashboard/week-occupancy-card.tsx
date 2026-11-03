import { cn } from "@/lib/utils";
import type { DayOccupancy } from "@/modules/scheduling/occupancy";
import { DemoTag } from "./demo-tag";

const WEEKDAY_LETTERS = ["L", "M", "X", "J", "V", "S", "D"];
const WEEKDAY_NAMES = ["lunes", "martes", "miércoles", "jueves", "viernes", "sábado", "domingo"];

type Props = { week: DayOccupancy[]; todayKey: string; average: number | null; isDemo: boolean };

export function WeekOccupancyCard({ week, todayKey, average, isDemo }: Props) {
  const hasSchedule = week.some((d) => d.availableMinutes > 0);

  return (
    <section aria-labelledby="ocupacion-semana" className="rounded-2xl border border-border bg-card p-5 shadow-card sm:p-6">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 id="ocupacion-semana" className="text-base font-bold">
            Ocupación semanal
          </h2>
          <p className="text-xs text-muted-foreground">Horas reservadas sobre tu horario</p>
        </div>
        {isDemo ? (
          <DemoTag className="text-muted-foreground" />
        ) : (
          average !== null && <span className="text-2xl font-extrabold tracking-tight">{average}%</span>
        )}
      </div>

      {hasSchedule ? (
        <ul className="mt-6 grid h-36 grid-cols-7 items-end gap-2" aria-label="Ocupación por día">
          {week.map((day, i) => {
            const isToday = day.dateKey === todayKey;
            const pct = day.percentage ?? 0;
            return (
              <li key={day.dateKey} className="flex h-full flex-col items-center justify-end gap-2">
                <span className="text-[10px] font-semibold text-muted-foreground tabular-nums">
                  {day.percentage === null ? "—" : `${pct}%`}
                </span>
                <div className="flex w-full max-w-9 flex-1 items-end overflow-hidden rounded-lg bg-muted">
                  <div
                    role="img"
                    aria-label={`${WEEKDAY_NAMES[i]}: ${day.percentage === null ? "no laborable" : `${pct}% ocupado`}`}
                    className={cn("w-full rounded-lg transition-all", isToday ? "bg-lime" : "bg-graphite")}
                    style={{ height: `${Math.max(pct, day.percentage === null ? 0 : 4)}%` }}
                  />
                </div>
                <span className={cn("text-xs font-bold", isToday ? "text-foreground" : "text-muted-foreground")}>
                  {WEEKDAY_LETTERS[i]}
                </span>
              </li>
            );
          })}
        </ul>
      ) : (
        <p className="mt-6 rounded-xl bg-muted px-4 py-6 text-center text-sm text-muted-foreground">
          Configura tu horario semanal para calcular la ocupación.
        </p>
      )}
    </section>
  );
}
