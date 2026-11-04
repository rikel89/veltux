export type ReadinessStatus = "ok" | "pending" | "manual";

export type ReadinessItem = { id: string; title: string; status: ReadinessStatus; detail: string };

export type ReadinessFacts = {
  hasSecretKey: boolean;
  siteUrl: string | undefined;
  hasSmsProvider: boolean;
  hasCronSecret: boolean;
};

/**
 * Lista de comprobación del piloto. Se calcula con hechos del servidor y nunca
 * expone valores: «manual» es lo que la aplicación no puede comprobar sola.
 */
export function buildReadiness(f: ReadinessFacts): ReadinessItem[] {
  const publicSite = Boolean(f.siteUrl) && !/localhost|127\.0\.0\.1/.test(f.siteUrl ?? "");
  return [
    {
      id: "secret",
      title: "Clave secreta de Supabase",
      status: f.hasSecretKey ? "ok" : "pending",
      detail: f.hasSecretKey ? "Configurada en el servidor." : "Sin ella no funcionan las invitaciones ni la página del cliente.",
    },
    {
      id: "site",
      title: "Dirección pública",
      status: publicSite ? "ok" : "pending",
      detail: publicSite ? `Los enlaces usan ${f.siteUrl}.` : "Define NEXT_PUBLIC_SITE_URL con la dirección definitiva.",
    },
    {
      id: "sms",
      title: "Proveedor de SMS",
      status: f.hasSmsProvider ? "ok" : "pending",
      detail: f.hasSmsProvider
        ? "Conectado."
        : "Sin proveedor la reserva online está desactivada y los avisos a clientes quedan pendientes.",
    },
    {
      id: "cron",
      title: "Tarea programada de notificaciones",
      status: f.hasCronSecret ? "manual" : "pending",
      detail: f.hasCronSecret
        ? "CRON_SECRET configurado. Comprueba que algo llama cada pocos minutos a /api/internal/notifications/process."
        : "Define CRON_SECRET y programa la llamada a /api/internal/notifications/process cada pocos minutos.",
    },
    {
      id: "auth",
      title: "URL de autenticación en Supabase",
      status: "manual",
      detail: "En Authentication → URL Configuration, Site URL y Redirect URLs deben usar la dirección pública.",
    },
    {
      id: "smtp",
      title: "Correo propio (SMTP)",
      status: "manual",
      detail: "El correo de Supabase tiene un límite bajo de envíos: configura un SMTP propio antes de invitar a varios profesionales.",
    },
    {
      id: "signup",
      title: "Registro público desactivado",
      status: "manual",
      detail: "En Authentication → Sign In / Providers, desactiva el alta libre: el acceso al piloto es por invitación.",
    },
    {
      id: "legal",
      title: "Textos legales",
      status: "manual",
      detail: "Las reservas recogen nombre y teléfono: revisa con tu asesor la política de privacidad y quién es responsable de los datos.",
    },
    {
      id: "e2e",
      title: "Ensayo completo con datos reales",
      status: "manual",
      detail: "Invitación, primera entrada, cita, reserva online, imprevisto y reasignación con cuentas de prueba.",
    },
  ];
}
