import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { DemoTag } from "./demo-tag";

type Props = {
  label: string;
  value: string;
  hint?: string;
  icon: LucideIcon;
  variant?: "default" | "highlight";
  isDemo?: boolean;
};

export function StatCard({ label, value, hint, icon: Icon, variant = "default", isDemo }: Props) {
  const highlight = variant === "highlight";
  return (
    <div
      className={cn(
        "relative flex min-w-[168px] snap-start flex-col justify-between gap-4 overflow-hidden rounded-2xl p-5",
        highlight ? "bg-graphite text-white" : "border border-border bg-card shadow-card",
      )}
    >
      {highlight && (
        <div aria-hidden className="pointer-events-none absolute -top-12 -right-12 size-36 rounded-full bg-lime/20 blur-2xl" />
      )}
      <div className="flex items-start justify-between gap-3">
        <span
          className={cn(
            "grid size-10 place-items-center rounded-xl",
            highlight ? "bg-lime text-graphite" : "bg-lime-soft text-lime-ink",
          )}
        >
          <Icon className="size-5" />
        </span>
        {isDemo && <DemoTag className={highlight ? "text-lime" : "text-muted-foreground"} />}
      </div>
      <div>
        <p className={cn("text-[13px] font-medium", highlight ? "text-neutral-400" : "text-muted-foreground")}>{label}</p>
        <p className={cn("mt-1 text-3xl font-extrabold tracking-tight", highlight && "text-lime")}>{value}</p>
        {hint && <p className={cn("mt-1 text-xs", highlight ? "text-neutral-500" : "text-muted-foreground")}>{hint}</p>}
      </div>
    </div>
  );
}
