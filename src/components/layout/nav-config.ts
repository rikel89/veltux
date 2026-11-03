import {
  BarChart3,
  Bell,
  Building2,
  CalendarDays,
  CalendarRange,
  Clock,
  CreditCard,
  KeyRound,
  LayoutDashboard,
  type LucideIcon,
  Scissors,
  Settings,
  TriangleAlert,
  UserRound,
  Users,
} from "lucide-react";
import type { Area } from "@/modules/auth/access-rules";

/** Sprint en curso: las secciones de sprints posteriores muestran su etiqueta. */
export const CURRENT_SPRINT = 7;

export type NavItem = {
  label: string;
  href: string;
  icon: LucideIcon;
  /** Sprint en el que la pantalla pasa a ser funcional. */
  sprint: number;
  description: string;
};

export type AreaNav = {
  sectionLabel: string;
  items: NavItem[];
  /** Accesos de la barra inferior en móvil (el resto va en "Más"). */
  mobilePrimary: { href: string; label: string }[];
  /** Acción central destacada en móvil. */
  mobileAction?: { href: string; label: string };
};

export const NAVS: Record<Area, AreaNav> = {
  professional: {
    sectionLabel: "Mi espacio",
    items: [
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
        description: "Los SMS a tus clientes y su estado de entrega.",
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
        description: "Preferencias de cuenta y seguridad.",
      },
    ],
    mobilePrimary: [
      { href: "/profesional", label: "Inicio" },
      { href: "/profesional/agenda", label: "Agenda" },
      { href: "/profesional/clientes", label: "Clientes" },
    ],
    mobileAction: { href: "/profesional/agenda?nueva=1", label: "Nueva cita" },
  },
  owner: {
    sectionLabel: "Establecimiento",
    items: [
      { label: "Dashboard", href: "/propietario", icon: LayoutDashboard, sprint: 1, description: "Resumen del establecimiento" },
      {
        label: "Vista de agendas",
        href: "/propietario/agendas",
        icon: CalendarRange,
        sprint: 7,
        description: "Ocupación de todas las agendas, sin datos de clientes ni posibilidad de modificar citas.",
      },
      {
        label: "Profesionales",
        href: "/propietario/profesionales",
        icon: Users,
        sprint: 2,
        description: "Invita a los autónomos de tu establecimiento y gestiona su estado.",
      },
      {
        label: "Licencias",
        href: "/propietario/licencias",
        icon: KeyRound,
        sprint: 2,
        description: "Asigna y libera licencias, consulta el cupo contratado y el historial.",
      },
      {
        label: "Suscripción",
        href: "/propietario/suscripcion",
        icon: CreditCard,
        sprint: 9,
        description: "Plan, facturación y método de pago (Stripe Billing).",
      },
      {
        label: "Configuración",
        href: "/propietario/configuracion",
        icon: Settings,
        sprint: 1,
        description: "Datos del establecimiento.",
      },
    ],
    mobilePrimary: [
      { href: "/propietario", label: "Inicio" },
      { href: "/propietario/agendas", label: "Agendas" },
      { href: "/propietario/profesionales", label: "Equipo" },
    ],
  },
  admin: {
    sectionLabel: "Plataforma",
    items: [
      { label: "Dashboard", href: "/admin", icon: LayoutDashboard, sprint: 1, description: "Visión global de VELTUX" },
      {
        label: "Establecimientos",
        href: "/admin/establecimientos",
        icon: Building2,
        sprint: 1,
        description: "Alta y seguimiento de peluquerías.",
      },
      {
        label: "Profesionales y licencias",
        href: "/admin/licencias",
        icon: KeyRound,
        sprint: 2,
        description: "Licencias contratadas y en uso por establecimiento.",
      },
      {
        label: "Suscripciones",
        href: "/admin/suscripciones",
        icon: CreditCard,
        sprint: 9,
        description: "Estado de las suscripciones y facturación.",
      },
      {
        label: "Estadísticas",
        href: "/admin/estadisticas",
        icon: BarChart3,
        sprint: 8,
        description: "Uso de la plataforma, reservas y crecimiento.",
      },
      {
        label: "Configuración",
        href: "/admin/configuracion",
        icon: Settings,
        sprint: 8,
        description: "Parámetros globales de la plataforma.",
      },
    ],
    mobilePrimary: [
      { href: "/admin", label: "Inicio" },
      { href: "/admin/establecimientos", label: "Locales" },
    ],
  },
};

const AREA_ROOTS: Record<Area, string> = { professional: "/profesional", owner: "/propietario", admin: "/admin" };

export function isNavItemActive(pathname: string, href: string): boolean {
  if (Object.values(AREA_ROOTS).includes(href)) return pathname === href;
  return pathname === href || pathname.startsWith(`${href}/`);
}

export function findNavItem(href: string): NavItem | undefined {
  return Object.values(NAVS)
    .flatMap((nav) => nav.items)
    .find((item) => item.href === href);
}
