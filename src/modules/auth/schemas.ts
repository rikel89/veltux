import { z } from "zod";

export const signInSchema = z.object({
  email: z.email("Introduce un email válido").trim().toLowerCase(),
  password: z.string().min(8, "La contraseña debe tener al menos 8 caracteres").max(72),
  next: z.string().optional(),
});

export type SignInInput = z.infer<typeof signInSchema>;

export type SignInState = {
  error?: string;
  fieldErrors?: Partial<Record<"email" | "password", string>>;
};
