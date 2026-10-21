// Tipos de la base de datos. Escritos a mano a partir de la migración core hasta que exista
// el proyecto; después se regeneran con `supabase gen types` (o el MCP de Supabase).

export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

export type Database = {
  __InternalSupabase: {
    PostgrestVersion: '13';
  };
  public: {
    Tables: {
      teachers: {
        Row: { created_at: string; display_name: string; id: string };
        Insert: { created_at?: string; display_name: string; id: string };
        Update: { created_at?: string; display_name?: string; id?: string };
        Relationships: [];
      };
      classes: {
        Row: {
          ai_budget: number;
          ai_calls_used: number;
          chapter_1: string[];
          chapter_2: string[];
          chapter_unlocked: number;
          code: string;
          created_at: string;
          expires_at: string;
          id: string;
          label: string;
          teacher_id: string;
        };
        Insert: {
          ai_budget?: number;
          ai_calls_used?: number;
          chapter_1: string[];
          chapter_2?: string[];
          chapter_unlocked?: number;
          code: string;
          created_at?: string;
          expires_at: string;
          id?: string;
          label: string;
          teacher_id: string;
        };
        Update: {
          ai_budget?: number;
          ai_calls_used?: number;
          chapter_1?: string[];
          chapter_2?: string[];
          chapter_unlocked?: number;
          code?: string;
          created_at?: string;
          expires_at?: string;
          id?: string;
          label?: string;
          teacher_id?: string;
        };
        Relationships: [];
      };
      players: {
        Row: {
          alias: string;
          auth_uid: string | null;
          class_id: string;
          created_at: string;
          id: string;
          last_seen_at: string | null;
          status: string;
        };
        Insert: {
          alias: string;
          auth_uid?: string | null;
          class_id: string;
          created_at?: string;
          id?: string;
          last_seen_at?: string | null;
          status?: string;
        };
        Update: {
          alias?: string;
          auth_uid?: string | null;
          class_id?: string;
          created_at?: string;
          id?: string;
          last_seen_at?: string | null;
          status?: string;
        };
        Relationships: [];
      };
      runs: {
        Row: {
          branches: string[];
          confianza: number;
          current_dilemma: string | null;
          desnivel: number | null;
          ending: string | null;
          equidad: number;
          final_reflection: string | null;
          finished_at: string | null;
          phase: string;
          player_id: string;
          poder: number;
          responsabilidad: number;
          updated_at: string;
          verify_code: string | null;
        };
        Insert: {
          branches?: string[];
          confianza?: number;
          current_dilemma?: string | null;
          ending?: string | null;
          equidad?: number;
          final_reflection?: string | null;
          finished_at?: string | null;
          phase?: string;
          player_id: string;
          poder?: number;
          responsabilidad?: number;
          updated_at?: string;
          verify_code?: string | null;
        };
        Update: {
          branches?: string[];
          confianza?: number;
          current_dilemma?: string | null;
          ending?: string | null;
          equidad?: number;
          final_reflection?: string | null;
          finished_at?: string | null;
          phase?: string;
          player_id?: string;
          poder?: number;
          responsabilidad?: number;
          updated_at?: string;
          verify_code?: string | null;
        };
        Relationships: [];
      };
      answers: {
        Row: {
          ai_calls: number;
          ai_source: string | null;
          choice: string;
          chosen_at: string;
          closed_at: string | null;
          closing: string | null;
          concepts: string[];
          dilemma_id: string;
          id: string;
          justification: string | null;
          justified_at: string | null;
          objection: string | null;
          objector: string | null;
          player_id: string;
          quality: string | null;
          replied_at: string | null;
          reply: string | null;
        };
        Insert: {
          ai_calls?: number;
          ai_source?: string | null;
          choice: string;
          chosen_at?: string;
          closed_at?: string | null;
          closing?: string | null;
          concepts?: string[];
          dilemma_id: string;
          id?: string;
          justification?: string | null;
          justified_at?: string | null;
          objection?: string | null;
          objector?: string | null;
          player_id: string;
          quality?: string | null;
          replied_at?: string | null;
          reply?: string | null;
        };
        Update: {
          ai_calls?: number;
          ai_source?: string | null;
          choice?: string;
          chosen_at?: string;
          closed_at?: string | null;
          closing?: string | null;
          concepts?: string[];
          dilemma_id?: string;
          id?: string;
          justification?: string | null;
          justified_at?: string | null;
          objection?: string | null;
          objector?: string | null;
          player_id?: string;
          quality?: string | null;
          replied_at?: string | null;
          reply?: string | null;
        };
        Relationships: [];
      };
      alerts: {
        Row: {
          answer_id: string;
          class_id: string;
          created_at: string;
          id: string;
          seen_at: string | null;
        };
        Insert: { answer_id: string; class_id: string };
        Update: { seen_at?: string | null };
        Relationships: [];
      };
      recovery_requests: {
        Row: {
          created_at: string;
          id: string;
          new_auth_uid: string;
          player_id: string;
          resolved_at: string | null;
          status: string;
        };
        Insert: { new_auth_uid: string; player_id: string };
        Update: { status?: string };
        Relationships: [];
      };
    };
    Views: { [_ in never]: never };
    Functions: {
      class_roster: {
        Args: { p_class_id: string };
        Returns: {
          alias: string;
          current_dilemma: string;
          finished: boolean;
          last_seen_at: string;
          phase: string;
          player_id: string;
          status: string;
        }[];
      };
      create_class: {
        Args: {
          p_chapter_1: string[];
          p_chapter_2: string[];
          p_label: string;
          p_retention_days?: number;
        };
        Returns: Json;
      };
      my_state: { Args: never; Returns: Json };
      ping: { Args: never; Returns: string };
      svc_join: { Args: { p_alias: string; p_auth_uid: string; p_code: string }; Returns: Json };
    };
    Enums: { [_ in never]: never };
    CompositeTypes: { [_ in never]: never };
  };
};
