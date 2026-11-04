export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.18"
  }
  graphql_public: {
    Tables: {
      [_ in never]: never
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      graphql: {
        Args: {
          extensions?: Json
          operationName?: string
          query?: string
          variables?: Json
        }
        Returns: Json
      }
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
  public: {
    Tables: {
      appointment_change_requests: {
        Row: {
          appointment_id: string
          client_responded_at: string | null
          client_token_hash: string | null
          created_at: string
          expires_at: string
          id: string
          incident_id: string | null
          message: string | null
          proposed_ends_at: string
          proposed_price_cents: number | null
          proposed_service_id: string | null
          proposed_starts_at: string
          requested_by_professional_id: string
          salon_id: string
          status: Database["public"]["Enums"]["change_request_status"]
          target_professional_id: string | null
          target_responded_at: string | null
          type: Database["public"]["Enums"]["change_request_type"]
          updated_at: string
        }
        Insert: {
          appointment_id: string
          client_responded_at?: string | null
          client_token_hash?: string | null
          created_at?: string
          expires_at?: string
          id?: string
          incident_id?: string | null
          message?: string | null
          proposed_ends_at: string
          proposed_price_cents?: number | null
          proposed_service_id?: string | null
          proposed_starts_at: string
          requested_by_professional_id: string
          salon_id: string
          status: Database["public"]["Enums"]["change_request_status"]
          target_professional_id?: string | null
          target_responded_at?: string | null
          type: Database["public"]["Enums"]["change_request_type"]
          updated_at?: string
        }
        Update: {
          appointment_id?: string
          client_responded_at?: string | null
          client_token_hash?: string | null
          created_at?: string
          expires_at?: string
          id?: string
          incident_id?: string | null
          message?: string | null
          proposed_ends_at?: string
          proposed_price_cents?: number | null
          proposed_service_id?: string | null
          proposed_starts_at?: string
          requested_by_professional_id?: string
          salon_id?: string
          status?: Database["public"]["Enums"]["change_request_status"]
          target_professional_id?: string | null
          target_responded_at?: string | null
          type?: Database["public"]["Enums"]["change_request_type"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "appointment_change_requests_appointment_id_fkey"
            columns: ["appointment_id"]
            isOneToOne: false
            referencedRelation: "appointments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "appointment_change_requests_incident_id_fkey"
            columns: ["incident_id"]
            isOneToOne: false
            referencedRelation: "schedule_incidents"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "appointment_change_requests_proposed_service_id_fkey"
            columns: ["proposed_service_id"]
            isOneToOne: false
            referencedRelation: "services"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "appointment_change_requests_requested_by_professional_id_fkey"
            columns: ["requested_by_professional_id"]
            isOneToOne: false
            referencedRelation: "professionals"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "appointment_change_requests_salon_id_fkey"
            columns: ["salon_id"]
            isOneToOne: false
            referencedRelation: "salons"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "appointment_change_requests_target_professional_id_fkey"
            columns: ["target_professional_id"]
            isOneToOne: false
            referencedRelation: "professionals"
            referencedColumns: ["id"]
          },
        ]
      }
      appointment_events: {
        Row: {
          actor_kind: Database["public"]["Enums"]["actor_kind"]
          actor_user_id: string | null
          appointment_id: string
          created_at: string
          event_type: Database["public"]["Enums"]["appointment_event_type"]
          id: string
          payload: Json
          professional_id: string
          salon_id: string
        }
        Insert: {
          actor_kind?: Database["public"]["Enums"]["actor_kind"]
          actor_user_id?: string | null
          appointment_id: string
          created_at?: string
          event_type: Database["public"]["Enums"]["appointment_event_type"]
          id?: string
          payload?: Json
          professional_id: string
          salon_id: string
        }
        Update: {
          actor_kind?: Database["public"]["Enums"]["actor_kind"]
          actor_user_id?: string | null
          appointment_id?: string
          created_at?: string
          event_type?: Database["public"]["Enums"]["appointment_event_type"]
          id?: string
          payload?: Json
          professional_id?: string
          salon_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "appointment_events_actor_user_id_fkey"
            columns: ["actor_user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "appointment_events_appointment_id_fkey"
            columns: ["appointment_id"]
            isOneToOne: false
            referencedRelation: "appointments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "appointment_events_professional_id_fkey"
            columns: ["professional_id"]
            isOneToOne: false
            referencedRelation: "professionals"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "appointment_events_salon_id_fkey"
            columns: ["salon_id"]
            isOneToOne: false
            referencedRelation: "salons"
            referencedColumns: ["id"]
          },
        ]
      }
      appointments: {
        Row: {
          cancel_reason: string | null
          cancelled_at: string | null
          client_id: string
          created_at: string
          created_by: string | null
          currency: string
          ends_at: string
          id: string
          notes: string | null
          price_cents: number
          professional_id: string
          salon_id: string
          service_id: string
          service_name: string
          source: Database["public"]["Enums"]["appointment_source"]
          starts_at: string
          status: Database["public"]["Enums"]["appointment_status"]
          updated_at: string
        }
        Insert: {
          cancel_reason?: string | null
          cancelled_at?: string | null
          client_id: string
          created_at?: string
          created_by?: string | null
          currency?: string
          ends_at: string
          id?: string
          notes?: string | null
          price_cents?: number
          professional_id: string
          salon_id: string
          service_id: string
          service_name?: string
          source?: Database["public"]["Enums"]["appointment_source"]
          starts_at: string
          status?: Database["public"]["Enums"]["appointment_status"]
          updated_at?: string
        }
        Update: {
          cancel_reason?: string | null
          cancelled_at?: string | null
          client_id?: string
          created_at?: string
          created_by?: string | null
          currency?: string
          ends_at?: string
          id?: string
          notes?: string | null
          price_cents?: number
          professional_id?: string
          salon_id?: string
          service_id?: string
          service_name?: string
          source?: Database["public"]["Enums"]["appointment_source"]
          starts_at?: string
          status?: Database["public"]["Enums"]["appointment_status"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "appointments_client_id_professional_id_fkey"
            columns: ["client_id", "professional_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id", "professional_id"]
          },
          {
            foreignKeyName: "appointments_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "appointments_professional_id_salon_id_fkey"
            columns: ["professional_id", "salon_id"]
            isOneToOne: false
            referencedRelation: "professionals"
            referencedColumns: ["id", "salon_id"]
          },
          {
            foreignKeyName: "appointments_service_id_professional_id_fkey"
            columns: ["service_id", "professional_id"]
            isOneToOne: false
            referencedRelation: "services"
            referencedColumns: ["id", "professional_id"]
          },
        ]
      }
      audit_logs: {
        Row: {
          action: string
          actor_user_id: string | null
          created_at: string
          entity_id: string | null
          entity_type: string
          id: number
          metadata: Json
          salon_id: string | null
        }
        Insert: {
          action: string
          actor_user_id?: string | null
          created_at?: string
          entity_id?: string | null
          entity_type: string
          id?: never
          metadata?: Json
          salon_id?: string | null
        }
        Update: {
          action?: string
          actor_user_id?: string | null
          created_at?: string
          entity_id?: string | null
          entity_type?: string
          id?: never
          metadata?: Json
          salon_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "audit_logs_actor_user_id_fkey"
            columns: ["actor_user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "audit_logs_salon_id_fkey"
            columns: ["salon_id"]
            isOneToOne: false
            referencedRelation: "salons"
            referencedColumns: ["id"]
          },
        ]
      }
      booking_otps: {
        Row: {
          attempts: number
          code_hash: string
          consumed_at: string | null
          created_at: string
          expires_at: string
          id: string
          ip_hash: string | null
          phone: string
          professional_id: string
        }
        Insert: {
          attempts?: number
          code_hash: string
          consumed_at?: string | null
          created_at?: string
          expires_at?: string
          id?: string
          ip_hash?: string | null
          phone: string
          professional_id: string
        }
        Update: {
          attempts?: number
          code_hash?: string
          consumed_at?: string | null
          created_at?: string
          expires_at?: string
          id?: string
          ip_hash?: string | null
          phone?: string
          professional_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "booking_otps_professional_id_fkey"
            columns: ["professional_id"]
            isOneToOne: false
            referencedRelation: "professionals"
            referencedColumns: ["id"]
          },
        ]
      }
      clients: {
        Row: {
          archived_at: string | null
          created_at: string
          email: string | null
          full_name: string
          global_client_id: string | null
          id: string
          marketing_consent: boolean
          notes: string | null
          phone: string
          phone_verified_at: string | null
          professional_id: string
          salon_id: string
          updated_at: string
        }
        Insert: {
          archived_at?: string | null
          created_at?: string
          email?: string | null
          full_name: string
          global_client_id?: string | null
          id?: string
          marketing_consent?: boolean
          notes?: string | null
          phone: string
          phone_verified_at?: string | null
          professional_id: string
          salon_id: string
          updated_at?: string
        }
        Update: {
          archived_at?: string | null
          created_at?: string
          email?: string | null
          full_name?: string
          global_client_id?: string | null
          id?: string
          marketing_consent?: boolean
          notes?: string | null
          phone?: string
          phone_verified_at?: string | null
          professional_id?: string
          salon_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "clients_professional_id_salon_id_fkey"
            columns: ["professional_id", "salon_id"]
            isOneToOne: false
            referencedRelation: "professionals"
            referencedColumns: ["id", "salon_id"]
          },
        ]
      }
      license_assignments: {
        Row: {
          assigned_at: string
          assigned_by: string | null
          id: string
          professional_id: string
          revoke_reason: string | null
          revoked_at: string | null
          revoked_by: string | null
          salon_id: string
        }
        Insert: {
          assigned_at?: string
          assigned_by?: string | null
          id?: string
          professional_id: string
          revoke_reason?: string | null
          revoked_at?: string | null
          revoked_by?: string | null
          salon_id: string
        }
        Update: {
          assigned_at?: string
          assigned_by?: string | null
          id?: string
          professional_id?: string
          revoke_reason?: string | null
          revoked_at?: string | null
          revoked_by?: string | null
          salon_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "license_assignments_assigned_by_fkey"
            columns: ["assigned_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "license_assignments_professional_id_salon_id_fkey"
            columns: ["professional_id", "salon_id"]
            isOneToOne: false
            referencedRelation: "professionals"
            referencedColumns: ["id", "salon_id"]
          },
          {
            foreignKeyName: "license_assignments_revoked_by_fkey"
            columns: ["revoked_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      notifications: {
        Row: {
          appointment_id: string | null
          attempts: number
          channel: Database["public"]["Enums"]["notification_channel"]
          created_at: string
          delivered_at: string | null
          failed_at: string | null
          id: string
          idempotency_key: string
          last_error: string | null
          locked_at: string | null
          max_attempts: number
          next_attempt_at: string
          payload: Json
          professional_id: string | null
          provider: string | null
          provider_message_id: string | null
          recipient_phone: string | null
          recipient_user_id: string | null
          salon_id: string
          sent_at: string | null
          status: Database["public"]["Enums"]["notification_status"]
          template: string
          updated_at: string
        }
        Insert: {
          appointment_id?: string | null
          attempts?: number
          channel?: Database["public"]["Enums"]["notification_channel"]
          created_at?: string
          delivered_at?: string | null
          failed_at?: string | null
          id?: string
          idempotency_key: string
          last_error?: string | null
          locked_at?: string | null
          max_attempts?: number
          next_attempt_at?: string
          payload?: Json
          professional_id?: string | null
          provider?: string | null
          provider_message_id?: string | null
          recipient_phone?: string | null
          recipient_user_id?: string | null
          salon_id: string
          sent_at?: string | null
          status?: Database["public"]["Enums"]["notification_status"]
          template: string
          updated_at?: string
        }
        Update: {
          appointment_id?: string | null
          attempts?: number
          channel?: Database["public"]["Enums"]["notification_channel"]
          created_at?: string
          delivered_at?: string | null
          failed_at?: string | null
          id?: string
          idempotency_key?: string
          last_error?: string | null
          locked_at?: string | null
          max_attempts?: number
          next_attempt_at?: string
          payload?: Json
          professional_id?: string | null
          provider?: string | null
          provider_message_id?: string | null
          recipient_phone?: string | null
          recipient_user_id?: string | null
          salon_id?: string
          sent_at?: string | null
          status?: Database["public"]["Enums"]["notification_status"]
          template?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "notifications_appointment_id_fkey"
            columns: ["appointment_id"]
            isOneToOne: false
            referencedRelation: "appointments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "notifications_professional_id_fkey"
            columns: ["professional_id"]
            isOneToOne: false
            referencedRelation: "professionals"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "notifications_recipient_user_id_fkey"
            columns: ["recipient_user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "notifications_salon_id_fkey"
            columns: ["salon_id"]
            isOneToOne: false
            referencedRelation: "salons"
            referencedColumns: ["id"]
          },
        ]
      }
      professionals: {
        Row: {
          accepts_online_booking: boolean
          avatar_url: string | null
          bio: string | null
          booking_horizon_days: number
          color: string
          created_at: string
          display_name: string
          email: string | null
          id: string
          min_notice_minutes: number
          phone: string | null
          salon_id: string
          slug: string
          sort_order: number
          status: Database["public"]["Enums"]["professional_status"]
          updated_at: string
          user_id: string | null
        }
        Insert: {
          accepts_online_booking?: boolean
          avatar_url?: string | null
          bio?: string | null
          booking_horizon_days?: number
          color?: string
          created_at?: string
          display_name: string
          email?: string | null
          id?: string
          min_notice_minutes?: number
          phone?: string | null
          salon_id: string
          slug: string
          sort_order?: number
          status?: Database["public"]["Enums"]["professional_status"]
          updated_at?: string
          user_id?: string | null
        }
        Update: {
          accepts_online_booking?: boolean
          avatar_url?: string | null
          bio?: string | null
          booking_horizon_days?: number
          color?: string
          created_at?: string
          display_name?: string
          email?: string | null
          id?: string
          min_notice_minutes?: number
          phone?: string | null
          salon_id?: string
          slug?: string
          sort_order?: number
          status?: Database["public"]["Enums"]["professional_status"]
          updated_at?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "professionals_salon_id_fkey"
            columns: ["salon_id"]
            isOneToOne: false
            referencedRelation: "salons"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "professionals_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          avatar_url: string | null
          created_at: string
          full_name: string
          id: string
          phone: string | null
          platform_role: Database["public"]["Enums"]["platform_role"]
          updated_at: string
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string
          full_name?: string
          id: string
          phone?: string | null
          platform_role?: Database["public"]["Enums"]["platform_role"]
          updated_at?: string
        }
        Update: {
          avatar_url?: string | null
          created_at?: string
          full_name?: string
          id?: string
          phone?: string | null
          platform_role?: Database["public"]["Enums"]["platform_role"]
          updated_at?: string
        }
        Relationships: []
      }
      salon_memberships: {
        Row: {
          created_at: string
          id: string
          role: Database["public"]["Enums"]["membership_role"]
          salon_id: string
          status: Database["public"]["Enums"]["membership_status"]
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          role: Database["public"]["Enums"]["membership_role"]
          salon_id: string
          status?: Database["public"]["Enums"]["membership_status"]
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          role?: Database["public"]["Enums"]["membership_role"]
          salon_id?: string
          status?: Database["public"]["Enums"]["membership_status"]
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "salon_memberships_salon_id_fkey"
            columns: ["salon_id"]
            isOneToOne: false
            referencedRelation: "salons"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "salon_memberships_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      salons: {
        Row: {
          address_line: string | null
          city: string | null
          country: string
          created_at: string
          created_by: string | null
          email: string | null
          id: string
          kind: Database["public"]["Enums"]["salon_kind"]
          name: string
          phone: string | null
          postal_code: string | null
          slug: string
          status: Database["public"]["Enums"]["salon_status"]
          timezone: string
          updated_at: string
        }
        Insert: {
          address_line?: string | null
          city?: string | null
          country?: string
          created_at?: string
          created_by?: string | null
          email?: string | null
          id?: string
          kind?: Database["public"]["Enums"]["salon_kind"]
          name: string
          phone?: string | null
          postal_code?: string | null
          slug: string
          status?: Database["public"]["Enums"]["salon_status"]
          timezone?: string
          updated_at?: string
        }
        Update: {
          address_line?: string | null
          city?: string | null
          country?: string
          created_at?: string
          created_by?: string | null
          email?: string | null
          id?: string
          kind?: Database["public"]["Enums"]["salon_kind"]
          name?: string
          phone?: string | null
          postal_code?: string | null
          slug?: string
          status?: Database["public"]["Enums"]["salon_status"]
          timezone?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "salons_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      schedule_exceptions: {
        Row: {
          created_at: string
          created_by: string | null
          ends_at: string
          id: string
          incident_id: string | null
          professional_id: string
          reason: string | null
          salon_id: string
          starts_at: string
          type: Database["public"]["Enums"]["schedule_exception_type"]
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          ends_at: string
          id?: string
          incident_id?: string | null
          professional_id: string
          reason?: string | null
          salon_id: string
          starts_at: string
          type: Database["public"]["Enums"]["schedule_exception_type"]
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          ends_at?: string
          id?: string
          incident_id?: string | null
          professional_id?: string
          reason?: string | null
          salon_id?: string
          starts_at?: string
          type?: Database["public"]["Enums"]["schedule_exception_type"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "schedule_exceptions_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "schedule_exceptions_incident_id_fkey"
            columns: ["incident_id"]
            isOneToOne: false
            referencedRelation: "schedule_incidents"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "schedule_exceptions_professional_id_salon_id_fkey"
            columns: ["professional_id", "salon_id"]
            isOneToOne: false
            referencedRelation: "professionals"
            referencedColumns: ["id", "salon_id"]
          },
        ]
      }
      schedule_incidents: {
        Row: {
          created_at: string
          created_by: string | null
          ends_at: string
          id: string
          incident_date: string
          professional_id: string
          reason: string | null
          resolved_at: string | null
          salon_id: string
          starts_at: string
          status: Database["public"]["Enums"]["incident_status"]
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          ends_at: string
          id?: string
          incident_date: string
          professional_id: string
          reason?: string | null
          resolved_at?: string | null
          salon_id: string
          starts_at: string
          status?: Database["public"]["Enums"]["incident_status"]
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          ends_at?: string
          id?: string
          incident_date?: string
          professional_id?: string
          reason?: string | null
          resolved_at?: string | null
          salon_id?: string
          starts_at?: string
          status?: Database["public"]["Enums"]["incident_status"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "schedule_incidents_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "schedule_incidents_professional_id_salon_id_fkey"
            columns: ["professional_id", "salon_id"]
            isOneToOne: false
            referencedRelation: "professionals"
            referencedColumns: ["id", "salon_id"]
          },
        ]
      }
      services: {
        Row: {
          buffer_after_minutes: number
          created_at: string
          currency: string
          description: string | null
          duration_minutes: number
          id: string
          is_active: boolean
          is_public: boolean
          name: string
          price_cents: number
          professional_id: string
          salon_id: string
          sort_order: number
          updated_at: string
        }
        Insert: {
          buffer_after_minutes?: number
          created_at?: string
          currency?: string
          description?: string | null
          duration_minutes: number
          id?: string
          is_active?: boolean
          is_public?: boolean
          name: string
          price_cents: number
          professional_id: string
          salon_id: string
          sort_order?: number
          updated_at?: string
        }
        Update: {
          buffer_after_minutes?: number
          created_at?: string
          currency?: string
          description?: string | null
          duration_minutes?: number
          id?: string
          is_active?: boolean
          is_public?: boolean
          name?: string
          price_cents?: number
          professional_id?: string
          salon_id?: string
          sort_order?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "services_professional_id_salon_id_fkey"
            columns: ["professional_id", "salon_id"]
            isOneToOne: false
            referencedRelation: "professionals"
            referencedColumns: ["id", "salon_id"]
          },
        ]
      }
      subscriptions: {
        Row: {
          created_at: string
          current_period_end: string | null
          current_period_start: string | null
          id: string
          license_quantity: number
          plan: string
          salon_id: string
          status: Database["public"]["Enums"]["subscription_status"]
          stripe_customer_id: string | null
          stripe_subscription_id: string | null
          trial_ends_at: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          current_period_end?: string | null
          current_period_start?: string | null
          id?: string
          license_quantity?: number
          plan?: string
          salon_id: string
          status?: Database["public"]["Enums"]["subscription_status"]
          stripe_customer_id?: string | null
          stripe_subscription_id?: string | null
          trial_ends_at?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          current_period_end?: string | null
          current_period_start?: string | null
          id?: string
          license_quantity?: number
          plan?: string
          salon_id?: string
          status?: Database["public"]["Enums"]["subscription_status"]
          stripe_customer_id?: string | null
          stripe_subscription_id?: string | null
          trial_ends_at?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "subscriptions_salon_id_fkey"
            columns: ["salon_id"]
            isOneToOne: true
            referencedRelation: "salons"
            referencedColumns: ["id"]
          },
        ]
      }
      work_schedules: {
        Row: {
          created_at: string
          end_time: string
          id: string
          professional_id: string
          salon_id: string
          start_time: string
          updated_at: string
          valid_from: string
          valid_until: string | null
          weekday: number
        }
        Insert: {
          created_at?: string
          end_time: string
          id?: string
          professional_id: string
          salon_id: string
          start_time: string
          updated_at?: string
          valid_from?: string
          valid_until?: string | null
          weekday: number
        }
        Update: {
          created_at?: string
          end_time?: string
          id?: string
          professional_id?: string
          salon_id?: string
          start_time?: string
          updated_at?: string
          valid_from?: string
          valid_until?: string | null
          weekday?: number
        }
        Relationships: [
          {
            foreignKeyName: "work_schedules_professional_id_salon_id_fkey"
            columns: ["professional_id", "salon_id"]
            isOneToOne: false
            referencedRelation: "professionals"
            referencedColumns: ["id", "salon_id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      accept_my_invitations: { Args: never; Returns: number }
      admin_platform_stats: { Args: { p_days?: number }; Returns: Json }
      admin_salon_overview: {
        Args: never
        Returns: {
          city: string
          created_at: string
          kind: Database["public"]["Enums"]["salon_kind"]
          license_quantity: number
          licenses_in_use: number
          name: string
          owner_email: string
          professionals: number
          salon_id: string
          slug: string
          status: Database["public"]["Enums"]["salon_status"]
          subscription_status: Database["public"]["Enums"]["subscription_status"]
        }[]
      }
      admin_set_license_quantity: {
        Args: { p_quantity: number; p_salon_id: string }
        Returns: undefined
      }
      block_my_day: {
        Args: { p_date: string; p_professional_id: string; p_reason?: string }
        Returns: string
      }
      cancel_appointment_as_client: {
        Args: { p_appointment_id: string }
        Returns: boolean
      }
      cancel_my_change_request: {
        Args: { p_request_id: string }
        Returns: undefined
      }
      cancel_my_day_appointments: {
        Args: {
          p_date: string
          p_ids?: string[]
          p_professional_id: string
          p_reason?: string
        }
        Returns: number
      }
      claim_pending_notifications: {
        Args: { p_batch_size?: number }
        Returns: {
          appointment_id: string | null
          attempts: number
          channel: Database["public"]["Enums"]["notification_channel"]
          created_at: string
          delivered_at: string | null
          failed_at: string | null
          id: string
          idempotency_key: string
          last_error: string | null
          locked_at: string | null
          max_attempts: number
          next_attempt_at: string
          payload: Json
          professional_id: string | null
          provider: string | null
          provider_message_id: string | null
          recipient_phone: string | null
          recipient_user_id: string | null
          salon_id: string
          sent_at: string | null
          status: Database["public"]["Enums"]["notification_status"]
          template: string
          updated_at: string
        }[]
        SetofOptions: {
          from: "*"
          to: "notifications"
          isOneToOne: false
          isSetofReturn: true
        }
      }
      create_my_appointment: {
        Args: {
          p_client_id: string
          p_force?: boolean
          p_notes?: string
          p_service_id: string
          p_starts_at: string
        }
        Returns: string
      }
      create_public_booking: {
        Args: {
          p_code: string
          p_email?: string
          p_full_name: string
          p_notes?: string
          p_otp_id: string
          p_service_id: string
          p_starts_at: string
        }
        Returns: string
      }
      create_salon_with_owner: {
        Args: {
          p_license_quantity?: number
          p_owner_email: string
          p_owner_full_name: string
          p_owner_works?: boolean
          p_professional_slug?: string
          p_salon_city?: string
          p_salon_kind?: Database["public"]["Enums"]["salon_kind"]
          p_salon_name: string
          p_salon_phone?: string
          p_salon_slug: string
          p_trial_days?: number
        }
        Returns: string
      }
      get_appointment_for_client: {
        Args: { p_appointment_id: string }
        Returns: Json
      }
      get_available_slots: {
        Args: {
          p_from: string
          p_service_id: string
          p_step_minutes?: number
          p_to: string
        }
        Returns: {
          ends_at: string
          starts_at: string
        }[]
      }
      get_my_access: { Args: never; Returns: Json }
      get_public_salon: { Args: { p_slug: string }; Returns: Json }
      get_salon_agenda_overview: {
        Args: { p_from: string; p_salon_id: string; p_to: string }
        Returns: {
          ends_at: string
          kind: string
          professional_id: string
          starts_at: string
        }[]
      }
      get_salon_occupancy: {
        Args: { p_from: string; p_salon_id: string; p_to: string }
        Returns: {
          ends_at: string
          professional_id: string
          starts_at: string
        }[]
      }
      invite_professional: {
        Args: {
          p_assign_license?: boolean
          p_display_name: string
          p_email: string
          p_salon_id: string
          p_slug: string
        }
        Returns: string
      }
      my_incoming_reassignments: {
        Args: never
        Returns: {
          currency: string
          ends_at: string
          expires_at: string
          message: string
          price_cents: number
          request_id: string
          requester_name: string
          service_name: string
          starts_at: string
        }[]
      }
      propose_reschedule: {
        Args: {
          p_appointment_id: string
          p_message?: string
          p_starts_at: string
        }
        Returns: string
      }
      record_notification_delivered: {
        Args: { p_message_id: string; p_provider: string }
        Returns: boolean
      }
      record_notification_result: {
        Args: {
          p_error?: string
          p_id: string
          p_message_id?: string
          p_ok: boolean
          p_provider: string
        }
        Returns: Database["public"]["Enums"]["notification_status"]
      }
      replace_my_weekly_schedule: {
        Args: { p_professional_id: string; p_slots: Json }
        Returns: number
      }
      request_booking_otp: {
        Args: { p_ip_hash?: string; p_phone: string; p_professional_id: string }
        Returns: {
          code: string
          expires_at: string
          otp_id: string
        }[]
      }
      request_reassignment: {
        Args: {
          p_appointment_id: string
          p_message?: string
          p_target_professional_id: string
        }
        Returns: string
      }
      reschedule_my_appointment: {
        Args: {
          p_appointment_id: string
          p_force?: boolean
          p_starts_at: string
        }
        Returns: undefined
      }
      respond_change_request_as_client: {
        Args: { p_accept: boolean; p_appointment_id: string }
        Returns: string
      }
      respond_my_reassignment: {
        Args: { p_accept: boolean; p_request_id: string; p_service_id?: string }
        Returns: undefined
      }
      set_my_appointment_status: {
        Args: {
          p_appointment_id: string
          p_reason?: string
          p_status: Database["public"]["Enums"]["appointment_status"]
        }
        Returns: undefined
      }
      set_professional_active: {
        Args: {
          p_active: boolean
          p_professional_id: string
          p_reason?: string
        }
        Returns: undefined
      }
    }
    Enums: {
      actor_kind: "professional" | "owner" | "client" | "system"
      appointment_event_type:
        | "created"
        | "updated"
        | "confirmed"
        | "rescheduled"
        | "cancelled"
        | "reassigned"
        | "completed"
        | "no_show"
      appointment_source: "professional" | "public_portal" | "reassignment"
      appointment_status:
        | "pending"
        | "confirmed"
        | "cancelled"
        | "completed"
        | "no_show"
      change_request_status:
        | "pending_target"
        | "pending_client"
        | "accepted"
        | "rejected"
        | "expired"
        | "cancelled"
        | "applied"
      change_request_type: "reschedule" | "reassignment"
      incident_status: "open" | "resolved" | "cancelled"
      membership_role: "owner" | "professional"
      membership_status: "invited" | "active" | "disabled"
      notification_channel: "sms" | "email" | "in_app"
      notification_status:
        | "pending"
        | "processing"
        | "sent"
        | "delivered"
        | "failed"
      platform_role: "user" | "admin"
      professional_status: "invited" | "active" | "inactive"
      salon_kind: "barberia" | "peluqueria" | "unisex"
      salon_status: "trial" | "active" | "suspended" | "cancelled"
      schedule_exception_type:
        | "block"
        | "break"
        | "day_off"
        | "extra_availability"
      subscription_status:
        | "trialing"
        | "active"
        | "past_due"
        | "paused"
        | "cancelled"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never) = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never) = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  graphql_public: {
    Enums: {},
  },
  public: {
    Enums: {
      actor_kind: ["professional", "owner", "client", "system"],
      appointment_event_type: [
        "created",
        "updated",
        "confirmed",
        "rescheduled",
        "cancelled",
        "reassigned",
        "completed",
        "no_show",
      ],
      appointment_source: ["professional", "public_portal", "reassignment"],
      appointment_status: [
        "pending",
        "confirmed",
        "cancelled",
        "completed",
        "no_show",
      ],
      change_request_status: [
        "pending_target",
        "pending_client",
        "accepted",
        "rejected",
        "expired",
        "cancelled",
        "applied",
      ],
      change_request_type: ["reschedule", "reassignment"],
      incident_status: ["open", "resolved", "cancelled"],
      membership_role: ["owner", "professional"],
      membership_status: ["invited", "active", "disabled"],
      notification_channel: ["sms", "email", "in_app"],
      notification_status: [
        "pending",
        "processing",
        "sent",
        "delivered",
        "failed",
      ],
      platform_role: ["user", "admin"],
      professional_status: ["invited", "active", "inactive"],
      salon_kind: ["barberia", "peluqueria", "unisex"],
      salon_status: ["trial", "active", "suspended", "cancelled"],
      schedule_exception_type: [
        "block",
        "break",
        "day_off",
        "extra_availability",
      ],
      subscription_status: [
        "trialing",
        "active",
        "past_due",
        "paused",
        "cancelled",
      ],
    },
  },
} as const
