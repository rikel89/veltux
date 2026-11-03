import { z } from "zod";
import { emailSchema, passwordSchema } from "@/lib/validations/common";

export const signInSchema = z.object({
  email: emailSchema(),
  password: z.string().min(1, "Introduce tu contraseña").max(72),
  next: z.string().optional(),
});

export const passwordResetRequestSchema = z.object({
  email: emailSchema(),
});

export const newPasswordSchema = z
  .object({ password: passwordSchema, confirm: z.string() })
  .refine((v) => v.password === v.confirm, { path: ["confirm"], message: "Las contraseñas no coinciden" });

export type SignInInput = z.infer<typeof signInSchema>;

export type SignInState = {
  error?: string;
  fieldErrors?: Partial<Record<"email" | "password", string>>;
};

/** Tipos de enlace de email que /auth/confirm acepta. */
export const emailOtpTypeSchema = z.enum(["invite", "recovery", "signup", "email", "email_change", "magiclink"]);
