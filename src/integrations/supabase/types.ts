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
    PostgrestVersion: "14.5"
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
      audio_rooms: {
        Row: {
          created_at: string
          host_id: string
          id: string
          is_live: boolean
          room_url: string
          title: string
        }
        Insert: {
          created_at?: string
          host_id: string
          id?: string
          is_live?: boolean
          room_url: string
          title: string
        }
        Update: {
          created_at?: string
          host_id?: string
          id?: string
          is_live?: boolean
          room_url?: string
          title?: string
        }
        Relationships: []
      }
      bookings: {
        Row: {
          booked_at: string
          created_at: string
          duration_minutes: number
          id: string
          no_show_detected_at: string | null
          notes: string | null
          patient_id: string
          price: number | null
          psychologist_id: string
          session_type: string
          status: string
          updated_at: string
          video_room_url: string | null
        }
        Insert: {
          booked_at: string
          created_at?: string
          duration_minutes?: number
          id?: string
          no_show_detected_at?: string | null
          notes?: string | null
          patient_id: string
          price?: number | null
          psychologist_id: string
          session_type?: string
          status?: string
          updated_at?: string
          video_room_url?: string | null
        }
        Update: {
          booked_at?: string
          created_at?: string
          duration_minutes?: number
          id?: string
          no_show_detected_at?: string | null
          notes?: string | null
          patient_id?: string
          price?: number | null
          psychologist_id?: string
          session_type?: string
          status?: string
          updated_at?: string
          video_room_url?: string | null
        }
        Relationships: []
      }
      clinical_notes: {
        Row: {
          created_at: string
          id: string
          notes: string
          patient_id: string
          psychologist_id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          notes?: string
          patient_id: string
          psychologist_id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          notes?: string
          patient_id?: string
          psychologist_id?: string
          updated_at?: string
        }
        Relationships: []
      }
      forum_replies: {
        Row: {
          author_id: string
          content: string
          created_at: string
          id: string
          thread_id: string
        }
        Insert: {
          author_id: string
          content: string
          created_at?: string
          id?: string
          thread_id: string
        }
        Update: {
          author_id?: string
          content?: string
          created_at?: string
          id?: string
          thread_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "forum_replies_thread_id_fkey"
            columns: ["thread_id"]
            isOneToOne: false
            referencedRelation: "forum_threads"
            referencedColumns: ["id"]
          },
        ]
      }
      forum_threads: {
        Row: {
          author_id: string
          category: string
          content: string
          created_at: string
          id: string
          title: string
        }
        Insert: {
          author_id: string
          category: string
          content: string
          created_at?: string
          id?: string
          title: string
        }
        Update: {
          author_id?: string
          category?: string
          content?: string
          created_at?: string
          id?: string
          title?: string
        }
        Relationships: []
      }
      goals: {
        Row: {
          completed: boolean
          created_at: string
          id: string
          text: string
          user_id: string
        }
        Insert: {
          completed?: boolean
          created_at?: string
          id?: string
          text: string
          user_id: string
        }
        Update: {
          completed?: boolean
          created_at?: string
          id?: string
          text?: string
          user_id?: string
        }
        Relationships: []
      }
      gratitudes: {
        Row: {
          author_id: string | null
          color: string
          content: string
          created_at: string
          id: string
          rotation: number
        }
        Insert: {
          author_id?: string | null
          color: string
          content: string
          created_at?: string
          id?: string
          rotation: number
        }
        Update: {
          author_id?: string | null
          color?: string
          content?: string
          created_at?: string
          id?: string
          rotation?: number
        }
        Relationships: []
      }
      immediate_session_requests: {
        Row: {
          created_at: string
          expires_at: string
          id: string
          patient_id: string
          psychologist_id: string
          responded_at: string | null
          room_url: string | null
          status: string
        }
        Insert: {
          created_at?: string
          expires_at?: string
          id?: string
          patient_id: string
          psychologist_id: string
          responded_at?: string | null
          room_url?: string | null
          status?: string
        }
        Update: {
          created_at?: string
          expires_at?: string
          id?: string
          patient_id?: string
          psychologist_id?: string
          responded_at?: string | null
          room_url?: string | null
          status?: string
        }
        Relationships: []
      }
      journal_entries: {
        Row: {
          created_at: string
          id: string
          mood: string
          text: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          mood: string
          text: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          mood?: string
          text?: string
          user_id?: string
        }
        Relationships: []
      }
      messages: {
        Row: {
          content: string | null
          created_at: string
          file_name: string | null
          file_type: string | null
          file_url: string | null
          id: string
          receiver_id: string
          sender_id: string
        }
        Insert: {
          content?: string | null
          created_at?: string
          file_name?: string | null
          file_type?: string | null
          file_url?: string | null
          id?: string
          receiver_id: string
          sender_id: string
        }
        Update: {
          content?: string | null
          created_at?: string
          file_name?: string | null
          file_type?: string | null
          file_url?: string | null
          id?: string
          receiver_id?: string
          sender_id?: string
        }
        Relationships: []
      }
      notifications: {
        Row: {
          content: string
          created_at: string
          id: string
          is_read: boolean
          link: string | null
          push_sent: boolean | null
          title: string
          type: string
          user_id: string
        }
        Insert: {
          content: string
          created_at?: string
          id?: string
          is_read?: boolean
          link?: string | null
          push_sent?: boolean | null
          title: string
          type: string
          user_id: string
        }
        Update: {
          content?: string
          created_at?: string
          id?: string
          is_read?: boolean
          link?: string | null
          push_sent?: boolean | null
          title?: string
          type?: string
          user_id?: string
        }
        Relationships: []
      }
      payments: {
        Row: {
          booked_at: string
          created_at: string
          duration_minutes: number
          id: string
          patient_id: string
          price: number
          psychologist_id: string
          session_type: string
          sofizpay_transaction_id: string | null
          status: string
          updated_at: string
        }
        Insert: {
          booked_at: string
          created_at?: string
          duration_minutes?: number
          id?: string
          patient_id: string
          price: number
          psychologist_id: string
          session_type?: string
          sofizpay_transaction_id?: string | null
          status?: string
          updated_at?: string
        }
        Update: {
          booked_at?: string
          created_at?: string
          duration_minutes?: number
          id?: string
          patient_id?: string
          price?: number
          psychologist_id?: string
          session_type?: string
          sofizpay_transaction_id?: string | null
          status?: string
          updated_at?: string
        }
        Relationships: []
      }
      phone_verifications: {
        Row: {
          code: string
          created_at: string
          expires_at: string
          id: string
          phone: string
          verified: boolean
        }
        Insert: {
          code: string
          created_at?: string
          expires_at: string
          id?: string
          phone: string
          verified?: boolean
        }
        Update: {
          code?: string
          created_at?: string
          expires_at?: string
          id?: string
          phone?: string
          verified?: boolean
        }
        Relationships: []
      }
      profiles: {
        Row: {
          approach: string | null
          approval_status: string
          avatar_url: string | null
          bio: string | null
          city: string | null
          clinic_settings: Json | null
          created_at: string
          formations: string | null
          full_name: string | null
          id: string
          is_admin: boolean
          is_available_now: boolean
          language: string | null
          notification_preferences: Json | null
          order_number: string | null
          phone: string | null
          phone_verified: boolean
          prep_notes: string | null
          price_adolescents: number | null
          price_couples: number | null
          price_individual: number | null
          price_per_session: number | null
          push_notifications_enabled: boolean | null
          specialty: string | null
          updated_at: string
          user_id: string
          user_type: string
          video_url: string | null
          years_experience: number | null
        }
        Insert: {
          approach?: string | null
          approval_status?: string
          avatar_url?: string | null
          bio?: string | null
          city?: string | null
          clinic_settings?: Json | null
          created_at?: string
          formations?: string | null
          full_name?: string | null
          id?: string
          is_admin?: boolean
          is_available_now?: boolean
          language?: string | null
          notification_preferences?: Json | null
          order_number?: string | null
          phone?: string | null
          phone_verified?: boolean
          prep_notes?: string | null
          price_adolescents?: number | null
          price_couples?: number | null
          price_individual?: number | null
          price_per_session?: number | null
          push_notifications_enabled?: boolean | null
          specialty?: string | null
          updated_at?: string
          user_id: string
          user_type?: string
          video_url?: string | null
          years_experience?: number | null
        }
        Update: {
          approach?: string | null
          approval_status?: string
          avatar_url?: string | null
          bio?: string | null
          city?: string | null
          clinic_settings?: Json | null
          created_at?: string
          formations?: string | null
          full_name?: string | null
          id?: string
          is_admin?: boolean
          is_available_now?: boolean
          language?: string | null
          notification_preferences?: Json | null
          order_number?: string | null
          phone?: string | null
          phone_verified?: boolean
          prep_notes?: string | null
          price_adolescents?: number | null
          price_couples?: number | null
          price_individual?: number | null
          price_per_session?: number | null
          push_notifications_enabled?: boolean | null
          specialty?: string | null
          updated_at?: string
          user_id?: string
          user_type?: string
          video_url?: string | null
          years_experience?: number | null
        }
        Relationships: []
      }
      psy_specializations: {
        Row: {
          category_id: string
          created_at: string
          id: string
          psychologist_id: string
          subcategory_id: string
        }
        Insert: {
          category_id: string
          created_at?: string
          id?: string
          psychologist_id: string
          subcategory_id: string
        }
        Update: {
          category_id?: string
          created_at?: string
          id?: string
          psychologist_id?: string
          subcategory_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "psy_specializations_psychologist_id_fkey"
            columns: ["psychologist_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "psy_specializations_psychologist_id_fkey"
            columns: ["psychologist_id"]
            isOneToOne: false
            referencedRelation: "psychologist_directory"
            referencedColumns: ["user_id"]
          },
        ]
      }
      push_subscriptions: {
        Row: {
          auth: string
          created_at: string
          endpoint: string
          fcm_token: string | null
          id: string
          p256dh: string
          updated_at: string
          user_id: string
        }
        Insert: {
          auth: string
          created_at?: string
          endpoint: string
          fcm_token?: string | null
          id?: string
          p256dh: string
          updated_at?: string
          user_id: string
        }
        Update: {
          auth?: string
          created_at?: string
          endpoint?: string
          fcm_token?: string | null
          id?: string
          p256dh?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      reviews: {
        Row: {
          booking_id: string | null
          comment: string | null
          created_at: string
          id: string
          patient_id: string
          psychologist_id: string
          rating: number
        }
        Insert: {
          booking_id?: string | null
          comment?: string | null
          created_at?: string
          id?: string
          patient_id: string
          psychologist_id: string
          rating: number
        }
        Update: {
          booking_id?: string | null
          comment?: string | null
          created_at?: string
          id?: string
          patient_id?: string
          psychologist_id?: string
          rating?: number
        }
        Relationships: [
          {
            foreignKeyName: "reviews_booking_id_fkey"
            columns: ["booking_id"]
            isOneToOne: false
            referencedRelation: "bookings"
            referencedColumns: ["id"]
          },
        ]
      }
      stories: {
        Row: {
          author_id: string
          bg_gradient: string
          content: string
          created_at: string
          id: string
        }
        Insert: {
          author_id: string
          bg_gradient: string
          content: string
          created_at?: string
          id?: string
        }
        Update: {
          author_id?: string
          bg_gradient?: string
          content?: string
          created_at?: string
          id?: string
        }
        Relationships: []
      }
    }
    Views: {
      psychologist_availability: {
        Row: {
          booked_at: string | null
          duration_minutes: number | null
          psychologist_id: string | null
          status: string | null
        }
        Insert: {
          booked_at?: string | null
          duration_minutes?: number | null
          psychologist_id?: string | null
          status?: string | null
        }
        Update: {
          booked_at?: string | null
          duration_minutes?: number | null
          psychologist_id?: string | null
          status?: string | null
        }
        Relationships: []
      }
      psychologist_directory: {
        Row: {
          approach: string | null
          approval_status: string | null
          avatar_url: string | null
          bio: string | null
          city: string | null
          clinic_settings: Json | null
          created_at: string | null
          formations: string | null
          full_name: string | null
          is_available_now: boolean | null
          language: string | null
          price_adolescents: number | null
          price_couples: number | null
          price_individual: number | null
          price_per_session: number | null
          specialty: string | null
          user_id: string | null
          video_url: string | null
          years_experience: number | null
        }
        Insert: {
          approach?: string | null
          approval_status?: string | null
          avatar_url?: string | null
          bio?: string | null
          city?: string | null
          clinic_settings?: Json | null
          created_at?: string | null
          formations?: string | null
          full_name?: string | null
          is_available_now?: boolean | null
          language?: string | null
          price_adolescents?: number | null
          price_couples?: number | null
          price_individual?: number | null
          price_per_session?: number | null
          specialty?: string | null
          user_id?: string | null
          video_url?: string | null
          years_experience?: number | null
        }
        Update: {
          approach?: string | null
          approval_status?: string | null
          avatar_url?: string | null
          bio?: string | null
          city?: string | null
          clinic_settings?: Json | null
          created_at?: string | null
          formations?: string | null
          full_name?: string | null
          is_available_now?: boolean | null
          language?: string | null
          price_adolescents?: number | null
          price_couples?: number | null
          price_individual?: number | null
          price_per_session?: number | null
          specialty?: string | null
          user_id?: string | null
          video_url?: string | null
          years_experience?: number | null
        }
        Relationships: []
      }
      psychologist_ratings: {
        Row: {
          avg_rating: number | null
          psychologist_id: string | null
          review_count: number | null
        }
        Relationships: []
      }
    }
    Functions: {
      expire_immediate_requests: { Args: never; Returns: undefined }
      is_admin: { Args: never; Returns: boolean }
      is_admin_user: { Args: never; Returns: boolean }
    }
    Enums: {
      [_ in never]: never
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
    Enums: {},
  },
} as const
