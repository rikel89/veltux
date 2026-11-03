import "server-only";

export type SmsResult = { ok: true } | { ok: false; error: string };

export interface SmsSender {
  readonly name: string;
  send(to: string, body: string): Promise<SmsResult>;
}

/**
 * Envío simulado para desarrollo: escribe el mensaje en la consola del
 * servidor. Nunca se usa en producción.
 */
const consoleSender: SmsSender = {
  name: "console",
  async send(to, body) {
    console.info(`[SMS simulado] → ${to}: ${body}`);
    return { ok: true };
  },
};

/**
 * Proveedor de SMS configurado, o null si no hay ninguno: sin proveedor la
 * reserva online se desactiva en lugar de fingir que se ha enviado un código.
 * El proveedor real (Twilio, Vonage…) se conecta aquí cuando se elija.
 */
export function getSmsSender(): SmsSender | null {
  const provider = process.env.SMS_PROVIDER?.trim();
  if (process.env.NODE_ENV === "production") return null;
  if (!provider || provider === "console") return consoleSender;
  return null;
}
