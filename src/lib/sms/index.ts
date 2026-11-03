import "server-only";

export type SmsResult = { ok: true; messageId?: string } | { ok: false; error: string };

export interface SmsSender {
  readonly name: string;
  send(to: string, body: string): Promise<SmsResult>;
}

/**
 * Salida de desarrollo para los códigos de reserva: escribe el mensaje en la
 * consola del servidor. No envía nada y nunca se usa en producción.
 */
const consoleSender: SmsSender = {
  name: "console",
  async send(to, body) {
    console.info(`[SMS simulado] → ${to}: ${body}`);
    return { ok: true };
  },
};

/**
 * Proveedor real configurado, o null. La cola de notificaciones solo usa este:
 * sin proveedor los mensajes siguen en estado pendiente y nada figura como enviado.
 * El proveedor (Twilio, Vonage…) se conecta aquí cuando se elija.
 */
export function getRealSmsSender(): SmsSender | null {
  return null;
}

/** Para el código de reserva: el proveedor real o, solo en desarrollo, la consola. */
export function getSmsSender(): SmsSender | null {
  const real = getRealSmsSender();
  if (real) return real;
  if (process.env.NODE_ENV === "production") return null;
  const provider = process.env.SMS_PROVIDER?.trim();
  return !provider || provider === "console" ? consoleSender : null;
}
