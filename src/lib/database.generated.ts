// Generated from the migrated PostgreSQL catalog by scripts/generate-types.ts. Do not edit.
export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];
export type Database = {
  public: {
    Tables: {
      audit_logs: {
        Row: {
          id: string;
          organization_id: string;
          actor_id: string | null;
          action: string;
          entity_type: string;
          entity_id: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          organization_id: string;
          actor_id?: string | null;
          action: string;
          entity_type: string;
          entity_id: string;
          created_at?: string;
        };
        Update: {
          id?: string;
          organization_id?: string;
          actor_id?: string | null;
          action?: string;
          entity_type?: string;
          entity_id?: string;
          created_at?: string;
        };
        Relationships: [];
      };
      case_assignments: {
        Row: {
          organization_id: string;
          case_id: string;
          user_id: string;
          created_at: string;
        };
        Insert: {
          organization_id: string;
          case_id: string;
          user_id: string;
          created_at?: string;
        };
        Update: {
          organization_id?: string;
          case_id?: string;
          user_id?: string;
          created_at?: string;
        };
        Relationships: [];
      };
      case_documents: {
        Row: {
          id: string;
          organization_id: string;
          case_id: string;
          name: string;
          storage_path: string;
          mime_type: string;
          size_bytes: number;
          uploaded_by: string;
          archived_at: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          organization_id: string;
          case_id: string;
          name: string;
          storage_path: string;
          mime_type: string;
          size_bytes: number;
          uploaded_by?: string;
          archived_at?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          organization_id?: string;
          case_id?: string;
          name?: string;
          storage_path?: string;
          mime_type?: string;
          size_bytes?: number;
          uploaded_by?: string;
          archived_at?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      case_events: {
        Row: {
          id: string;
          organization_id: string;
          case_id: string;
          actor_id: string | null;
          action: string;
          closure_date: string | null;
          outcome: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          organization_id: string;
          case_id: string;
          actor_id?: string | null;
          action: string;
          closure_date?: string | null;
          outcome?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          organization_id?: string;
          case_id?: string;
          actor_id?: string | null;
          action?: string;
          closure_date?: string | null;
          outcome?: string | null;
          created_at?: string;
        };
        Relationships: [];
      };
      case_notes: {
        Row: {
          id: string;
          organization_id: string;
          case_id: string;
          body: string;
          author_id: string;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          organization_id: string;
          case_id: string;
          body: string;
          author_id?: string;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          organization_id?: string;
          case_id?: string;
          body?: string;
          author_id?: string;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      case_parties: {
        Row: {
          id: string;
          organization_id: string;
          case_id: string;
          party_type: string;
          full_name: string;
          phone: string;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          organization_id: string;
          case_id: string;
          party_type: string;
          full_name: string;
          phone?: string;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          organization_id?: string;
          case_id?: string;
          party_type?: string;
          full_name?: string;
          phone?: string;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      cases: {
        Row: {
          id: string;
          organization_id: string;
          serial_number: number;
          court_case_number: string;
          case_year: number;
          title: string;
          case_type: string;
          court_name: string;
          court_location: string;
          received_date: string;
          status: string;
          closed_date: string | null;
          closure_result: string;
          client_id: string;
          plaintiff: string;
          defendant: string;
          contact_phone: string;
          next_hearing_date: string | null;
          notes: string;
          archived_at: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          organization_id: string;
          serial_number?: number;
          court_case_number: string;
          case_year: number;
          title: string;
          case_type: string;
          court_name: string;
          court_location?: string;
          received_date: string;
          status?: string;
          closed_date?: string | null;
          closure_result?: string;
          client_id: string;
          plaintiff?: string;
          defendant?: string;
          contact_phone?: string;
          next_hearing_date?: string | null;
          notes?: string;
          archived_at?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          organization_id?: string;
          serial_number?: number;
          court_case_number?: string;
          case_year?: number;
          title?: string;
          case_type?: string;
          court_name?: string;
          court_location?: string;
          received_date?: string;
          status?: string;
          closed_date?: string | null;
          closure_result?: string;
          client_id?: string;
          plaintiff?: string;
          defendant?: string;
          contact_phone?: string;
          next_hearing_date?: string | null;
          notes?: string;
          archived_at?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      clients: {
        Row: {
          id: string;
          organization_id: string;
          full_name: string;
          phone: string;
          alternative_phone: string;
          address: string;
          notes: string;
          archived_at: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          organization_id: string;
          full_name: string;
          phone: string;
          alternative_phone?: string;
          address?: string;
          notes?: string;
          archived_at?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          organization_id?: string;
          full_name?: string;
          phone?: string;
          alternative_phone?: string;
          address?: string;
          notes?: string;
          archived_at?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      hearings: {
        Row: {
          id: string;
          organization_id: string;
          case_id: string;
          hearing_date: string;
          hearing_time: string | null;
          court_name: string;
          purpose: string;
          outcome: string;
          notes: string;
          reminder_days: number;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          organization_id: string;
          case_id: string;
          hearing_date: string;
          hearing_time?: string | null;
          court_name: string;
          purpose: string;
          outcome?: string;
          notes?: string;
          reminder_days?: number;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          organization_id?: string;
          case_id?: string;
          hearing_date?: string;
          hearing_time?: string | null;
          court_name?: string;
          purpose?: string;
          outcome?: string;
          notes?: string;
          reminder_days?: number;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      invitations: {
        Row: {
          id: string;
          organization_id: string;
          email: string;
          role: string;
          token: string;
          invited_by: string;
          expires_at: string;
          accepted_at: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          organization_id: string;
          email: string;
          role: string;
          token?: string;
          invited_by: string;
          expires_at?: string;
          accepted_at?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          organization_id?: string;
          email?: string;
          role?: string;
          token?: string;
          invited_by?: string;
          expires_at?: string;
          accepted_at?: string | null;
          created_at?: string;
        };
        Relationships: [];
      };
      notifications: {
        Row: {
          id: string;
          organization_id: string;
          user_id: string;
          title: string;
          case_id: string | null;
          read_at: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          organization_id: string;
          user_id: string;
          title: string;
          case_id?: string | null;
          read_at?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          organization_id?: string;
          user_id?: string;
          title?: string;
          case_id?: string | null;
          read_at?: string | null;
          created_at?: string;
        };
        Relationships: [];
      };
      organization_members: {
        Row: {
          organization_id: string;
          user_id: string;
          role: string;
          display_name: string;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          organization_id: string;
          user_id: string;
          role: string;
          display_name?: string;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          organization_id?: string;
          user_id?: string;
          role?: string;
          display_name?: string;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      organization_serial_counters: {
        Row: { organization_id: string; last_serial: number };
        Insert: { organization_id: string; last_serial?: number };
        Update: { organization_id?: string; last_serial?: number };
        Relationships: [];
      };
      organizations: {
        Row: {
          id: string;
          name: string;
          address: string;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          name: string;
          address?: string;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          name?: string;
          address?: string;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      profiles: {
        Row: {
          id: string;
          full_name: string;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id: string;
          full_name?: string;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          full_name?: string;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
    };
    Views: Record<string, never>;
    Enums: Record<string, never>;
    CompositeTypes: Record<string, never>;
    Functions: {
      sync_firebase_profile: { Args: Record<string, never>; Returns: string };
      create_chamber: {
        Args: { chamber_name: string; member_name: string };
        Returns: string;
      };
      invite_member: {
        Args: { org: string; recipient_email: string; member_role: string };
        Returns: string;
      };
      accept_invitation: {
        Args: { invite_token: string; member_name: string };
        Returns: string;
      };
      set_member_role: {
        Args: { org: string; member: string; new_role: string };
        Returns: undefined;
      };
      get_case: {
        Args: { org: string; case_id: string };
        Returns: Database["public"]["Tables"]["cases"]["Row"][];
      };
      search_cases: {
        Args: {
          org: string;
          query?: string;
          type_filter?: string;
          status_filter?: string;
          court_filter?: string;
          lawyer_filter?: string;
          date_from?: string;
          date_to?: string;
          hearing_from?: string;
          hearing_to?: string;
          page_number?: number;
          sort_order?: string;
        };
        Returns: Database["public"]["Tables"]["cases"]["Row"][];
      };
      chamber_report: {
        Args: { org: string; date_from?: string; date_to?: string };
        Returns: Json;
      };
    };
  };
};
