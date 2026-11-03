/**
 * PROVISIONAL · escrito a mano a partir de la migración inicial.
 *
 * Se sustituirá por el archivo generado con `npm run db:types`
 * (supabase gen types) en cuanto el Supabase local esté levantado.
 * No añadir lógica en este archivo.
 */

export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

type Timestamp = string;
type Uuid = string;

type Table<Row extends Record<string, unknown>, Required extends keyof Row> = {
  Row: Row;
  Insert: Pick<Row, Required> & Partial<Row>;
  Update: Partial<Row>;
  Relationships: [];
};

type Timestamps = { created_at: Timestamp; updated_at: Timestamp };

export type PlatformRole = "user" | "admin";
export type SalonKind = "barberia" | "peluqueria" | "unisex";
export type SalonStatus = "trial" | "active" | "suspended" | "cancelled";
export type MembershipRole = "owner" | "professional";
export type MembershipStatus = "invited" | "active" | "disabled";
export type ProfessionalStatus = "invited" | "active" | "inactive";
export type ScheduleExceptionType = "block" | "break" | "day_off" | "extra_availability";
export type AppointmentStatus = "pending" | "confirmed" | "cancelled" | "completed" | "no_show";
export type AppointmentSource = "professional" | "public_portal" | "reassignment";
export type AppointmentEventType =
  | "created"
  | "updated"
  | "confirmed"
  | "rescheduled"
  | "cancelled"
  | "reassigned"
  | "completed"
  | "no_show";
export type ActorKind = "professional" | "owner" | "client" | "system";
export type IncidentStatus = "open" | "resolved" | "cancelled";
export type ChangeRequestType = "reschedule" | "reassignment";
export type ChangeRequestStatus =
  | "pending_target"
  | "pending_client"
  | "accepted"
  | "rejected"
  | "expired"
  | "cancelled"
  | "applied";
export type NotificationChannel = "sms" | "email" | "in_app";
export type NotificationStatus = "pending" | "processing" | "sent" | "delivered" | "failed";
export type SubscriptionStatus = "trialing" | "active" | "past_due" | "paused" | "cancelled";

type ProfileRow = Timestamps & {
  id: Uuid;
  full_name: string;
  phone: string | null;
  avatar_url: string | null;
  platform_role: PlatformRole;
};

type SalonRow = Timestamps & {
  id: Uuid;
  slug: string;
  name: string;
  kind: SalonKind;
  status: SalonStatus;
  timezone: string;
  phone: string | null;
  email: string | null;
  address_line: string | null;
  city: string | null;
  postal_code: string | null;
  country: string;
  created_by: Uuid | null;
};

type SalonMembershipRow = Timestamps & {
  id: Uuid;
  salon_id: Uuid;
  user_id: Uuid;
  role: MembershipRole;
  status: MembershipStatus;
};

type ProfessionalRow = Timestamps & {
  id: Uuid;
  salon_id: Uuid;
  user_id: Uuid | null;
  display_name: string;
  slug: string;
  bio: string | null;
  avatar_url: string | null;
  phone: string | null;
  email: string | null;
  color: string;
  status: ProfessionalStatus;
  accepts_online_booking: boolean;
  sort_order: number;
};

type SubscriptionRow = Timestamps & {
  id: Uuid;
  salon_id: Uuid;
  plan: string;
  status: SubscriptionStatus;
  license_quantity: number;
  trial_ends_at: Timestamp | null;
  current_period_start: Timestamp | null;
  current_period_end: Timestamp | null;
  stripe_customer_id: string | null;
  stripe_subscription_id: string | null;
};

type LicenseAssignmentRow = {
  id: Uuid;
  salon_id: Uuid;
  professional_id: Uuid;
  assigned_by: Uuid | null;
  assigned_at: Timestamp;
  revoked_at: Timestamp | null;
  revoked_by: Uuid | null;
  revoke_reason: string | null;
};

type ServiceRow = Timestamps & {
  id: Uuid;
  salon_id: Uuid;
  professional_id: Uuid;
  name: string;
  description: string | null;
  duration_minutes: number;
  buffer_after_minutes: number;
  price_cents: number;
  currency: string;
  is_active: boolean;
  is_public: boolean;
  sort_order: number;
};

type WorkScheduleRow = Timestamps & {
  id: Uuid;
  salon_id: Uuid;
  professional_id: Uuid;
  weekday: number;
  start_time: string;
  end_time: string;
  valid_from: string;
  valid_until: string | null;
};

type ScheduleIncidentRow = Timestamps & {
  id: Uuid;
  salon_id: Uuid;
  professional_id: Uuid;
  incident_date: string;
  starts_at: Timestamp;
  ends_at: Timestamp;
  reason: string | null;
  status: IncidentStatus;
  created_by: Uuid | null;
  resolved_at: Timestamp | null;
};

type ScheduleExceptionRow = Timestamps & {
  id: Uuid;
  salon_id: Uuid;
  professional_id: Uuid;
  type: ScheduleExceptionType;
  starts_at: Timestamp;
  ends_at: Timestamp;
  reason: string | null;
  incident_id: Uuid | null;
  created_by: Uuid | null;
};

type ClientRow = Timestamps & {
  id: Uuid;
  salon_id: Uuid;
  professional_id: Uuid;
  full_name: string;
  phone: string;
  phone_verified_at: Timestamp | null;
  email: string | null;
  notes: string | null;
  marketing_consent: boolean;
  global_client_id: Uuid | null;
  archived_at: Timestamp | null;
};

type AppointmentRow = Timestamps & {
  id: Uuid;
  salon_id: Uuid;
  professional_id: Uuid;
  client_id: Uuid;
  service_id: Uuid;
  starts_at: Timestamp;
  ends_at: Timestamp;
  status: AppointmentStatus;
  source: AppointmentSource;
  service_name: string;
  price_cents: number;
  currency: string;
  notes: string | null;
  cancelled_at: Timestamp | null;
  cancel_reason: string | null;
  created_by: Uuid | null;
};

type AppointmentEventRow = {
  id: Uuid;
  appointment_id: Uuid;
  salon_id: Uuid;
  professional_id: Uuid;
  event_type: AppointmentEventType;
  actor_user_id: Uuid | null;
  actor_kind: ActorKind;
  payload: Json;
  created_at: Timestamp;
};

type AppointmentChangeRequestRow = Timestamps & {
  id: Uuid;
  salon_id: Uuid;
  appointment_id: Uuid;
  incident_id: Uuid | null;
  type: ChangeRequestType;
  status: ChangeRequestStatus;
  requested_by_professional_id: Uuid;
  target_professional_id: Uuid | null;
  proposed_starts_at: Timestamp;
  proposed_ends_at: Timestamp;
  proposed_service_id: Uuid | null;
  proposed_price_cents: number | null;
  message: string | null;
  target_responded_at: Timestamp | null;
  client_responded_at: Timestamp | null;
  client_token_hash: string | null;
  expires_at: Timestamp;
};

type NotificationRow = Timestamps & {
  id: Uuid;
  salon_id: Uuid;
  professional_id: Uuid | null;
  appointment_id: Uuid | null;
  channel: NotificationChannel;
  status: NotificationStatus;
  template: string;
  recipient_phone: string | null;
  recipient_user_id: Uuid | null;
  payload: Json;
  idempotency_key: string;
  attempts: number;
  max_attempts: number;
  next_attempt_at: Timestamp;
  locked_at: Timestamp | null;
  provider: string | null;
  provider_message_id: string | null;
  last_error: string | null;
  sent_at: Timestamp | null;
  delivered_at: Timestamp | null;
  failed_at: Timestamp | null;
};

type AuditLogRow = {
  id: number;
  salon_id: Uuid | null;
  actor_user_id: Uuid | null;
  action: string;
  entity_type: string;
  entity_id: Uuid | null;
  metadata: Json;
  created_at: Timestamp;
};

export type Database = {
  public: {
    Tables: {
      profiles: Table<ProfileRow, "id">;
      salons: Table<SalonRow, "slug" | "name">;
      salon_memberships: Table<SalonMembershipRow, "salon_id" | "user_id" | "role">;
      professionals: Table<ProfessionalRow, "salon_id" | "display_name" | "slug">;
      subscriptions: Table<SubscriptionRow, "salon_id">;
      license_assignments: Table<LicenseAssignmentRow, "salon_id" | "professional_id">;
      services: Table<
        ServiceRow,
        "salon_id" | "professional_id" | "name" | "duration_minutes" | "price_cents"
      >;
      work_schedules: Table<
        WorkScheduleRow,
        "salon_id" | "professional_id" | "weekday" | "start_time" | "end_time"
      >;
      schedule_incidents: Table<
        ScheduleIncidentRow,
        "salon_id" | "professional_id" | "incident_date" | "starts_at" | "ends_at"
      >;
      schedule_exceptions: Table<
        ScheduleExceptionRow,
        "salon_id" | "professional_id" | "type" | "starts_at" | "ends_at"
      >;
      clients: Table<ClientRow, "salon_id" | "professional_id" | "full_name" | "phone">;
      appointments: Table<
        AppointmentRow,
        "salon_id" | "professional_id" | "client_id" | "service_id" | "starts_at" | "ends_at"
      >;
      appointment_events: Table<
        AppointmentEventRow,
        "appointment_id" | "salon_id" | "professional_id" | "event_type"
      >;
      appointment_change_requests: Table<
        AppointmentChangeRequestRow,
        | "salon_id"
        | "appointment_id"
        | "type"
        | "status"
        | "requested_by_professional_id"
        | "proposed_starts_at"
        | "proposed_ends_at"
      >;
      notifications: Table<NotificationRow, "salon_id" | "template" | "idempotency_key">;
      audit_logs: Table<AuditLogRow, "action" | "entity_type">;
    };
    Views: Record<string, never>;
    Functions: {
      get_public_salon: { Args: { p_slug: string }; Returns: Json };
      get_salon_occupancy: {
        Args: { p_salon_id: Uuid; p_from: Timestamp; p_to: Timestamp };
        Returns: { professional_id: Uuid; starts_at: Timestamp; ends_at: Timestamp }[];
      };
      claim_pending_notifications: { Args: { p_batch_size?: number }; Returns: NotificationRow[] };
    };
    Enums: {
      platform_role: PlatformRole;
      salon_kind: SalonKind;
      salon_status: SalonStatus;
      membership_role: MembershipRole;
      membership_status: MembershipStatus;
      professional_status: ProfessionalStatus;
      schedule_exception_type: ScheduleExceptionType;
      appointment_status: AppointmentStatus;
      appointment_source: AppointmentSource;
      appointment_event_type: AppointmentEventType;
      actor_kind: ActorKind;
      incident_status: IncidentStatus;
      change_request_type: ChangeRequestType;
      change_request_status: ChangeRequestStatus;
      notification_channel: NotificationChannel;
      notification_status: NotificationStatus;
      subscription_status: SubscriptionStatus;
    };
    CompositeTypes: Record<string, never>;
  };
};

export type Tables<T extends keyof Database["public"]["Tables"]> = Database["public"]["Tables"][T]["Row"];
