// Generado con `npm run db:types` desde el proyecto de Supabase. NO EDITAR A MANO.
// Las columnas de funciones RETURNS TABLE se validan con zod en el cliente: aquí salen como no nulas.
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
  public: {
    Tables: {
      alerts: {
        Row: {
          answer_id: string | null
          class_id: string
          created_at: string
          id: string
          player_id: string
          seen_at: string | null
          text: string | null
        }
        Insert: {
          answer_id?: string | null
          class_id: string
          created_at?: string
          id?: string
          player_id: string
          seen_at?: string | null
          text?: string | null
        }
        Update: {
          answer_id?: string | null
          class_id?: string
          created_at?: string
          id?: string
          player_id?: string
          seen_at?: string | null
          text?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "alerts_answer_id_fkey"
            columns: ["answer_id"]
            isOneToOne: false
            referencedRelation: "answers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "alerts_class_id_fkey"
            columns: ["class_id"]
            isOneToOne: false
            referencedRelation: "classes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "alerts_player_id_fkey"
            columns: ["player_id"]
            isOneToOne: false
            referencedRelation: "players"
            referencedColumns: ["id"]
          },
        ]
      }
      answers: {
        Row: {
          ai_calls: number
          ai_source: string | null
          changed: boolean | null
          choice: string
          chosen_at: string
          closed_at: string | null
          closing: string | null
          concepts: string[]
          dilemma_id: string
          first_choice: string | null
          id: string
          justification: string | null
          justified_at: string | null
          moves: string[]
          objection: string | null
          objector: string | null
          player_id: string
          quality: string | null
          replied_at: string | null
          reply: string | null
          reply_stance: string | null
        }
        Insert: {
          ai_calls?: number
          ai_source?: string | null
          changed?: boolean | null
          choice: string
          chosen_at?: string
          closed_at?: string | null
          closing?: string | null
          concepts?: string[]
          dilemma_id: string
          first_choice?: string | null
          id?: string
          justification?: string | null
          justified_at?: string | null
          moves?: string[]
          objection?: string | null
          objector?: string | null
          player_id: string
          quality?: string | null
          replied_at?: string | null
          reply?: string | null
          reply_stance?: string | null
        }
        Update: {
          ai_calls?: number
          ai_source?: string | null
          changed?: boolean | null
          choice?: string
          chosen_at?: string
          closed_at?: string | null
          closing?: string | null
          concepts?: string[]
          dilemma_id?: string
          first_choice?: string | null
          id?: string
          justification?: string | null
          justified_at?: string | null
          moves?: string[]
          objection?: string | null
          objector?: string | null
          player_id?: string
          quality?: string | null
          replied_at?: string | null
          reply?: string | null
          reply_stance?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "answers_player_id_fkey"
            columns: ["player_id"]
            isOneToOne: false
            referencedRelation: "runs"
            referencedColumns: ["player_id"]
          },
        ]
      }
      class_snapshots: {
        Row: {
          class_id: string
          results: Json
          results_answers: number
          updated_at: string
        }
        Insert: {
          class_id: string
          results?: Json
          results_answers?: number
          updated_at?: string
        }
        Update: {
          class_id?: string
          results?: Json
          results_answers?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "class_snapshots_class_id_fkey"
            columns: ["class_id"]
            isOneToOne: true
            referencedRelation: "classes"
            referencedColumns: ["id"]
          },
        ]
      }
      classes: {
        Row: {
          ai_budget: number
          ai_calls_used: number
          chapter_1: string[]
          chapter_2: string[]
          chapter_unlocked: number
          code: string
          created_at: string
          expires_at: string
          id: string
          label: string
          teacher_id: string
        }
        Insert: {
          ai_budget?: number
          ai_calls_used?: number
          chapter_1: string[]
          chapter_2?: string[]
          chapter_unlocked?: number
          code: string
          created_at?: string
          expires_at: string
          id?: string
          label: string
          teacher_id: string
        }
        Update: {
          ai_budget?: number
          ai_calls_used?: number
          chapter_1?: string[]
          chapter_2?: string[]
          chapter_unlocked?: number
          code?: string
          created_at?: string
          expires_at?: string
          id?: string
          label?: string
          teacher_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "classes_teacher_id_fkey"
            columns: ["teacher_id"]
            isOneToOne: false
            referencedRelation: "teachers"
            referencedColumns: ["id"]
          },
        ]
      }
      players: {
        Row: {
          alias: string
          auth_uid: string | null
          class_id: string
          created_at: string
          id: string
          last_seen_at: string | null
          rescue_key: string
          status: string
        }
        Insert: {
          alias: string
          auth_uid?: string | null
          class_id: string
          created_at?: string
          id?: string
          last_seen_at?: string | null
          rescue_key?: string
          status?: string
        }
        Update: {
          alias?: string
          auth_uid?: string | null
          class_id?: string
          created_at?: string
          id?: string
          last_seen_at?: string | null
          rescue_key?: string
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "players_class_id_fkey"
            columns: ["class_id"]
            isOneToOne: false
            referencedRelation: "classes"
            referencedColumns: ["id"]
          },
        ]
      }
      recovery_requests: {
        Row: {
          created_at: string
          id: string
          new_auth_uid: string
          player_id: string
          resolved_at: string | null
          status: string
        }
        Insert: {
          created_at?: string
          id?: string
          new_auth_uid: string
          player_id: string
          resolved_at?: string | null
          status?: string
        }
        Update: {
          created_at?: string
          id?: string
          new_auth_uid?: string
          player_id?: string
          resolved_at?: string | null
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "recovery_requests_player_id_fkey"
            columns: ["player_id"]
            isOneToOne: false
            referencedRelation: "players"
            referencedColumns: ["id"]
          },
        ]
      }
      runs: {
        Row: {
          branches: string[]
          confianza: number
          current_dilemma: string | null
          desnivel: number | null
          emblem: string | null
          ending: string | null
          equidad: number
          final_reflection: string | null
          finished_at: string | null
          labs: string[]
          pending_choice: string | null
          phase: string
          player_id: string
          poder: number
          responsabilidad: number
          updated_at: string
          verify_code: string | null
        }
        Insert: {
          branches?: string[]
          confianza?: number
          current_dilemma?: string | null
          desnivel?: number | null
          emblem?: string | null
          ending?: string | null
          equidad?: number
          final_reflection?: string | null
          finished_at?: string | null
          labs?: string[]
          pending_choice?: string | null
          phase?: string
          player_id: string
          poder?: number
          responsabilidad?: number
          updated_at?: string
          verify_code?: string | null
        }
        Update: {
          branches?: string[]
          confianza?: number
          current_dilemma?: string | null
          desnivel?: number | null
          emblem?: string | null
          ending?: string | null
          equidad?: number
          final_reflection?: string | null
          finished_at?: string | null
          labs?: string[]
          pending_choice?: string | null
          phase?: string
          player_id?: string
          poder?: number
          responsabilidad?: number
          updated_at?: string
          verify_code?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "runs_player_id_fkey"
            columns: ["player_id"]
            isOneToOne: true
            referencedRelation: "players"
            referencedColumns: ["id"]
          },
        ]
      }
      teachers: {
        Row: {
          created_at: string
          display_name: string
          id: string
        }
        Insert: {
          created_at?: string
          display_name: string
          id: string
        }
        Update: {
          created_at?: string
          display_name?: string
          id?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      class_console: { Args: { p_class_id: string }; Returns: Json }
      class_roster: {
        Args: { p_class_id: string }
        Returns: {
          alias: string
          current_dilemma: string
          finished: boolean
          last_seen_at: string
          phase: string
          player_id: string
          status: string
        }[]
      }
      class_snapshot: {
        Args: { p_class_id: string; p_force?: boolean }
        Returns: Json
      }
      create_class: {
        Args: {
          p_chapter_1: string[]
          p_chapter_2: string[]
          p_label: string
          p_retention_days?: number
        }
        Returns: Json
      }
      delete_class: { Args: { p_class_id: string }; Returns: undefined }
      my_dossier: { Args: never; Returns: Json }
      my_recovery: { Args: never; Returns: Json }
      my_state: { Args: never; Returns: Json }
      ping: { Args: never; Returns: string }
      resolve_recovery: {
        Args: { p_approve: boolean; p_request_id: string }
        Returns: Json
      }
      svc_advance: {
        Args: {
          p_ending?: string
          p_from_dilemma: string
          p_from_phase: string
          p_player_id: string
          p_to_dilemma: string
          p_to_phase: string
        }
        Returns: Json
      }
      svc_ai_take: {
        Args: { p_dilemma: string; p_max_calls: number; p_player_id: string }
        Returns: number
      }
      svc_alert: {
        Args: { p_dilemma: string; p_player_id: string; p_text: string }
        Returns: undefined
      }
      svc_confirm: {
        Args: {
          p_branch: string
          p_choice: string
          p_confianza: number
          p_dilemma: string
          p_equidad: number
          p_first_choice: string
          p_player_id: string
          p_poder: number
          p_responsabilidad: number
        }
        Returns: Json
      }
      svc_emblem: {
        Args: { p_emblem: string; p_player_id: string }
        Returns: Json
      }
      svc_join: {
        Args: { p_alias: string; p_auth_uid: string; p_code: string }
        Returns: Json
      }
      svc_justify: {
        Args: {
          p_ai_source: string
          p_alert: boolean
          p_concepts: string[]
          p_dilemma: string
          p_moves: string[]
          p_objection: string
          p_objector: string
          p_player_id: string
          p_quality: string
          p_text: string
        }
        Returns: Json
      }
      svc_load: { Args: { p_auth_uid: string }; Returns: Json }
      svc_pick: {
        Args: { p_choice: string; p_dilemma: string; p_player_id: string }
        Returns: Json
      }
      svc_recover: {
        Args: {
          p_alias: string
          p_auth_uid: string
          p_code: string
          p_key: string
        }
        Returns: Json
      }
      svc_reflect: {
        Args: {
          p_alert: boolean
          p_ending: string
          p_player_id: string
          p_text: string
        }
        Returns: Json
      }
      svc_reply: {
        Args: {
          p_alert: boolean
          p_closing: string
          p_concepts: string[]
          p_dilemma: string
          p_moves: string[]
          p_player_id: string
          p_stance: string
          p_text: string
        }
        Returns: Json
      }
      unlock_chapter: {
        Args: { p_chapter: number; p_class_id: string }
        Returns: undefined
      }
      verify_run: { Args: { p_code: string }; Returns: Json }
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
  public: {
    Enums: {},
  },
} as const
