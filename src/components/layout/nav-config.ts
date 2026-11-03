import {
  Bell,
  CalendarDays,
  Clock,
  LayoutDashboard,
  type LucideIcon,
  Scissors,
  Settings,
  TriangleAlert,
  UserRound,
  Users,
} from "lucide-react";

export type NavItem = {
  label: string;
  href: string;
  icon: LucideIcon;
  /** Sprint en el que la pantalla pasa a ser funcional. */
  sprint: number;
  description: string;
};

export const PROFESSIONAL_NAV: NavItem[] = [
  { label: "Dashboard", href: "/profesional", icon: LayoutDashboard, sprint: 0, description: "Resumen de tu jornada" },
  {
    label: "Mi agenda",
    href: "/profesional/agenda",
    icon: CalendarDays,
    sprint: 4,
    description: "Vista diaria y semanal, creación rápida de citas, bloqueos y descansos.",
  },
  {
    label: "Mis clientes",
    href: "/profesional/clientes",
    icon: Users,
    sprint: 4,
    description: "Tu cartera privada de clientes. Nadie más del establecimiento puede consultarla.",
  },
  {
    label: "Mis servicios",
    href: "/profesional/servicios",
    icon: Scissors,
    sprint: 3,
    description: "Servicios, duraciones y precios individuales que verán tus clientes al reservar.",
  },
  {
    label: "Mis horarios",
    href: "/profesional/horarios",
    icon: Clock,
    sprint: 3,
    description: "Horario semanal, jornada partida, días libres y excepciones.",
  },
  {
    label: "Imprevistos",
    href: "/profesional/imprevistos",
    icon: TriangleAlert,
    sprint: 6,
    description: "Gestiona un imprevisto: cancela, reprograma o solicita reasignar las citas afectadas.",
  },
  {
    label: "Notificaciones",
    href: "/profesional/notificaciones",
    icon: Bell,
    sprint: 6,
    description: "Historial de SMS enviados a tus clientes y su estado de entrega.",
  },
  {
    label: "Mi perfil",
    href: "/profesional/perfil",
    icon: UserRound,
    sprint: 1,
    description: "Tus datos profesionales y tu página pública de reservas.",
  },
  {
    label: "Configuración",
    href: "/profesional/configuracion",
    icon: Settings,
    sprint: 1,
    description: "Preferencias de cuenta, seguridad y notificaciones.",
  },
];

/** Accesos principales de la barra inferior en móvil (el resto va en "Más"). */
export const PROFESSIONAL_MOBILE_PRIMARY = ["/profesional", "/profesional/agenda", "/profesional/clientes"] as const;

export function isNavItemActive(pathname: string, href: string): boolean {
  if (href === "/profesional") return pathname === href;
  return pathname === href || pathname.startsWith(`${href}/`);
}

export function findNavItem(href: string): NavItem | undefined {
  return PROFESSIONAL_NAV.find((item) => item.href === href);
}
