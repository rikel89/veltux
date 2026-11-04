import "server-only";

export type EmailMessage = { to: string; subject: string; text: string; actionUrl?: string | null; actionLabel?: string };
export type SendResult = { ok: true; messageId?: string } | { ok: false; error: string };

export interface EmailSender {
  readonly name: string;
  send(message: EmailMessage): Promise<SendResult>;
}

const escapeHtml = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

/** Versión HTML sencilla: legible en cualquier gestor de correo. */
export function renderEmailHtml(message: EmailMessage): string {
  const paragraphs = message.text
    .split("\n\n")
    .map((p) => `<p style="margin:0 0 16px;line-height:1.5">${escapeHtml(p)}</p>`)
    .join("");
  const action = message.actionUrl
    ? `<p style="margin:24px 0"><a href="${escapeHtml(message.actionUrl)}" style="background:#121212;color:#B8FF65;padding:12px 20px;border-radius:10px;text-decoration:none;font-weight:700">${escapeHtml(message.actionLabel ?? "Abrir")}</a></p>`
    : "";
  return `<div style="font-family:Arial,sans-serif;color:#0F172A;max-width:520px;margin:0 auto;padding:24px">${paragraphs}${action}<p style="margin:24px 0 0;color:#64748B;font-size:12px">Enviado con VELTUX</p></div>`;
}

/** Texto plano con el enlace a la vista, para quien no lee HTML. */
export function renderEmailText(message: EmailMessage): string {
  return message.actionUrl ? `${message.text}\n\n${message.actionLabel ?? "Abrir"}: ${message.actionUrl}` : message.text;
}

function brevoSender(apiKey: string, fromEmail: string, fromName: string): EmailSender {
  return {
    name: "brevo",
    async send(message) {
      try {
        const res = await fetch("https://api.brevo.com/v3/smtp/email", {
          method: "POST",
          headers: { "api-key": apiKey, "content-type": "application/json", accept: "application/json" },
          body: JSON.stringify({
            sender: { email: fromEmail, name: fromName },
            to: [{ email: message.to }],
            subject: message.subject,
            textContent: renderEmailText(message),
            htmlContent: renderEmailHtml(message),
          }),
        });
        if (!res.ok) return { ok: false, error: `Brevo respondió ${res.status}` };
        const json = (await res.json().catch(() => ({}))) as { messageId?: string };
        return { ok: true, messageId: json.messageId };
      } catch {
        return { ok: false, error: "No se pudo contactar con Brevo" };
      }
    },
  };
}

/**
 * Salida de desarrollo para los códigos de reserva: escribe el mensaje en la
 * consola del servidor. No envía nada y nunca se usa en producción.
 */
const consoleSender: EmailSender = {
  name: "console",
  async send(message) {
    console.info(`[Email simulado] → ${message.to}: ${message.subject}\n${renderEmailText(message)}`);
    return { ok: true };
  },
};

/**
 * Proveedor real, o null. La cola de notificaciones solo usa este: sin
 * proveedor los mensajes siguen en estado pendiente y nada figura como enviado.
 */
export function getRealEmailSender(): EmailSender | null {
  const apiKey = process.env.BREVO_API_KEY?.trim();
  const from = process.env.EMAIL_FROM_ADDRESS?.trim();
  if (!apiKey || !from) return null;
  return brevoSender(apiKey, from, process.env.EMAIL_FROM_NAME?.trim() || "VELTUX");
}

/** Para el código de reserva: el proveedor real o, solo en desarrollo, la consola. */
export function getEmailSender(): EmailSender | null {
  const real = getRealEmailSender();
  if (real) return real;
  return process.env.NODE_ENV === "production" ? null : consoleSender;
}
