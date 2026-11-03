import { cn } from "@/lib/utils";

type MarkProps = { className?: string; title?: string };

/** Isotipo "V": brazo izquierdo blanco y faceta lima desplazada a la derecha. */
export function VeltuxMark({ className, title = "VELTUX" }: MarkProps) {
  return (
    <svg viewBox="0 0 100 80" role="img" aria-label={title} className={cn("h-8 w-auto", className)}>
      <polygon points="64,0 100,0 86,26 50,26" className="fill-lime" />
      <polygon points="0,0 26,0 50,54 60,32 76,32 54,80 46,80" className="fill-current" />
    </svg>
  );
}

type LogoProps = {
  className?: string;
  /** "light" sobre fondos oscuros (sidebar), "dark" sobre fondos claros. */
  tone?: "light" | "dark";
  showMark?: boolean;
};

/** Logotipo completo: isotipo + "VELTU" + "X" en lima. */
export function VeltuxLogo({ className, tone = "light", showMark = true }: LogoProps) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-2.5 select-none",
        tone === "light" ? "text-white" : "text-graphite",
        className,
      )}
    >
      {showMark && <VeltuxMark className="h-7" />}
      <span className="-skew-x-6 text-[1.35rem] leading-none font-extrabold tracking-[0.02em]" aria-hidden>
        VELTU<span className={tone === "light" ? "text-lime" : "text-lime-ink"}>X</span>
      </span>
      <span className="sr-only">VELTUX</span>
    </span>
  );
}
