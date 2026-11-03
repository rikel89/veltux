import type { ComponentProps, ReactNode } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";

type FieldProps = {
  name: string;
  label: string;
  error?: string;
  hint?: ReactNode;
  className?: string;
  children?: ReactNode;
} & Omit<ComponentProps<"input">, "name">;

const inputClass = "h-12 rounded-xl bg-white px-4 text-base md:text-sm";

/** Campo de formulario accesible: etiqueta, ayuda y error enlazados. */
export function FormField({ name, label, error, hint, className, children, ...inputProps }: FieldProps) {
  const id = inputProps.id ?? name;
  const describedBy = [error && `${id}-error`, hint && `${id}-hint`].filter(Boolean).join(" ") || undefined;

  return (
    <div className={cn("space-y-2", className)}>
      <Label htmlFor={id}>{label}</Label>
      {children ?? (
        <Input
          id={id}
          name={name}
          aria-invalid={Boolean(error)}
          aria-describedby={describedBy}
          className={inputClass}
          {...inputProps}
        />
      )}
      {hint && !error && (
        <p id={`${id}-hint`} className="text-xs text-muted-foreground">
          {hint}
        </p>
      )}
      {error && (
        <p id={`${id}-error`} className="text-xs font-medium text-destructive">
          {error}
        </p>
      )}
    </div>
  );
}

type SelectProps = {
  name: string;
  label: string;
  options: ReadonlyArray<{ value: string; label: string }>;
  error?: string;
  className?: string;
} & Omit<ComponentProps<"select">, "name">;

export function FormSelect({ name, label, options, error, className, ...props }: SelectProps) {
  const id = props.id ?? name;
  return (
    <div className={cn("space-y-2", className)}>
      <Label htmlFor={id}>{label}</Label>
      <select
        id={id}
        name={name}
        aria-invalid={Boolean(error)}
        className="h-12 w-full rounded-xl border border-input bg-white px-4 text-base outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 md:text-sm"
        {...props}
      >
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
      {error && <p className="text-xs font-medium text-destructive">{error}</p>}
    </div>
  );
}

type TextareaProps = { name: string; label: string; error?: string; className?: string } & Omit<
  ComponentProps<"textarea">,
  "name"
>;

export function FormTextarea({ name, label, error, className, ...props }: TextareaProps) {
  const id = props.id ?? name;
  return (
    <div className={cn("space-y-2", className)}>
      <Label htmlFor={id}>{label}</Label>
      <textarea
        id={id}
        name={name}
        aria-invalid={Boolean(error)}
        className="min-h-24 w-full rounded-xl border border-input bg-white px-4 py-3 text-base outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 md:text-sm"
        {...props}
      />
      {error && <p className="text-xs font-medium text-destructive">{error}</p>}
    </div>
  );
}
