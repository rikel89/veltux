"use client";

import type { ReactNode } from "react";
import { useFormStatus } from "react-dom";
import { CircleCheck, LoaderCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { FormState } from "@/lib/validations/common";

export function SubmitButton({ children, className }: { children: ReactNode; className?: string }) {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" size="lg" disabled={pending} className={cn("h-12 shadow-lime", className)}>
      {pending && <LoaderCircle className="animate-spin" />}
      {children}
    </Button>
  );
}

/** Mensaje global de éxito o error de una Server Action. */
export function FormMessage({ state }: { state: FormState }) {
  if (state.error) {
    return (
      <p role="alert" className="rounded-xl bg-red-50 px-4 py-3 text-sm text-red-700">
        {state.error}
      </p>
    );
  }
  if (state.ok && state.message) {
    return (
      <p role="status" className="flex items-center gap-2 rounded-xl bg-lime-soft px-4 py-3 text-sm font-medium text-lime-ink">
        <CircleCheck className="size-4 shrink-0" /> {state.message}
      </p>
    );
  }
  return null;
}
