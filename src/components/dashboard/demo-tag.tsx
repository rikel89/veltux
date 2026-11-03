import { cn } from "@/lib/utils";

/** Etiqueta obligatoria para cualquier dato ficticio mostrado en pantalla. */
export function DemoTag({ className }: { className?: string }) {
  return (
    <span
      title="Dato de demostración: no es una reserva real"
      className={cn(
        "inline-flex items-center rounded-md border border-dashed border-current px-1.5 py-px text-[10px] font-bold tracking-wider uppercase opacity-70",
        className,
      )}
    >
      Demo
    </span>
  );
}
