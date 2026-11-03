/**
 * Alias legibles sobre los tipos generados (src/types/database.types.ts).
 * Este archivo no se sobrescribe con `npm run db:types`.
 */
import type { Enums } from "./database.types";

export type AppointmentStatus = Enums<"appointment_status">;
export type SalonStatus = Enums<"salon_status">;
export type SalonKind = Enums<"salon_kind">;
export type ProfessionalStatus = Enums<"professional_status">;
export type SubscriptionStatus = Enums<"subscription_status">;
export type NotificationStatus = Enums<"notification_status">;
