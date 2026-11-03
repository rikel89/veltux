import { FlaskConical } from "lucide-react";

export function DemoBanner() {
  return (
    <div role="status" className="flex items-center justify-center gap-2 bg-graphite px-4 py-2 text-center text-xs text-neutral-300">
      <FlaskConical className="size-3.5 shrink-0 text-lime" />
      <span>
        <strong className="font-semibold text-lime">Modo demostración.</strong> Supabase no está configurado: los datos
        marcados como <span className="font-semibold text-white">DEMO</span> son ficticios y no representan reservas reales.
      </span>
    </div>
  );
}
