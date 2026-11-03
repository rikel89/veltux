import { Lock } from "lucide-react";

/** Aviso para profesionales desactivados: conservan la consulta, no la edición. */
export function ReadOnlyNotice() {
  return (
    <p role="status" className="flex items-start gap-3 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
      <Lock className="mt-0.5 size-4 shrink-0" />
      Tu ficha está desactivada en el establecimiento: puedes consultar tus datos, pero no modificarlos.
    </p>
  );
}
