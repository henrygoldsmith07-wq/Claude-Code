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
  public: {
    Tables: {
      anchor_documents: {
        Row: {
          created_at: string
          id: string
          source_text: string
          title: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          source_text: string
          title: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          source_text?: string
          title?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "anchor_documents_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      audio_script_content: {
        Row: {
          created_at: string
          script: Json
          subject_id: string
          topic_id: string
        }
        Insert: {
          created_at?: string
          script: Json
          subject_id: string
          topic_id: string
        }
        Update: {
          created_at?: string
          script?: Json
          subject_id?: string
          topic_id?: string
        }
        Relationships: []
      }
      calendar_blocks: {
        Row: {
          created_at: string
          day: string
          duration_hours: number
          id: string
          start_hour: number
          subject_id: string | null
          title: string
          topic_id: string | null
          user_id: string
        }
        Insert: {
          created_at?: string
          day: string
          duration_hours?: number
          id?: string
          start_hour: number
          subject_id?: string | null
          title: string
          topic_id?: string | null
          user_id: string
        }
        Update: {
          created_at?: string
          day?: string
          duration_hours?: number
          id?: string
          start_hour?: number
          subject_id?: string | null
          title?: string
          topic_id?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "calendar_blocks_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      chain_flashcard_content: {
        Row: {
          created_at: string
          id: string
          steps: Json
          subject_id: string
          title: string
          topic_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          steps: Json
          subject_id: string
          title: string
          topic_id: string
        }
        Update: {
          created_at?: string
          id?: string
          steps?: Json
          subject_id?: string
          title?: string
          topic_id?: string
        }
        Relationships: []
      }
      chain_flashcard_progress: {
        Row: {
          chain_id: string
          last_completed_at: string | null
          times_completed: number
          user_id: string
        }
        Insert: {
          chain_id: string
          last_completed_at?: string | null
          times_completed?: number
          user_id: string
        }
        Update: {
          chain_id?: string
          last_completed_at?: string | null
          times_completed?: number
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "chain_flashcard_progress_chain_id_fkey"
            columns: ["chain_id"]
            isOneToOne: false
            referencedRelation: "chain_flashcard_content"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "chain_flashcard_progress_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      exam_dates: {
        Row: {
          exam_date: string
          subject_id: string
          user_id: string
        }
        Insert: {
          exam_date: string
          subject_id: string
          user_id: string
        }
        Update: {
          exam_date?: string
          subject_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "exam_dates_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      flashcard_content: {
        Row: {
          back: string
          created_at: string
          front: string
          id: string
          subject_id: string
          topic_id: string
        }
        Insert: {
          back: string
          created_at?: string
          front: string
          id?: string
          subject_id: string
          topic_id: string
        }
        Update: {
          back?: string
          created_at?: string
          front?: string
          id?: string
          subject_id?: string
          topic_id?: string
        }
        Relationships: []
      }
      flashcard_progress: {
        Row: {
          difficulty: number
          due_date: string
          flashcard_content_id: string
          id: string
          lapses: number
          last_reviewed_at: string | null
          reps: number
          stability: number
          state: number
          user_id: string
        }
        Insert: {
          difficulty?: number
          due_date: string
          flashcard_content_id: string
          id?: string
          lapses?: number
          last_reviewed_at?: string | null
          reps?: number
          stability?: number
          state?: number
          user_id: string
        }
        Update: {
          difficulty?: number
          due_date?: string
          flashcard_content_id?: string
          id?: string
          lapses?: number
          last_reviewed_at?: string | null
          reps?: number
          stability?: number
          state?: number
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "flashcard_progress_flashcard_content_id_fkey"
            columns: ["flashcard_content_id"]
            isOneToOne: false
            referencedRelation: "flashcard_content"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "flashcard_progress_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      lesson_completions: {
        Row: {
          completed_at: string
          topic_id: string
          user_id: string
        }
        Insert: {
          completed_at?: string
          topic_id: string
          user_id: string
        }
        Update: {
          completed_at?: string
          topic_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "lesson_completions_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      lesson_content: {
        Row: {
          created_at: string
          sections: Json
          subject_id: string
          topic_id: string
        }
        Insert: {
          created_at?: string
          sections: Json
          subject_id: string
          topic_id: string
        }
        Update: {
          created_at?: string
          sections?: Json
          subject_id?: string
          topic_id?: string
        }
        Relationships: []
      }
      motivational_prompts_content: {
        Row: {
          created_at: string
          id: string
          message: string
          subject_id: string
          tone: string
        }
        Insert: {
          created_at?: string
          id?: string
          message: string
          subject_id: string
          tone: string
        }
        Update: {
          created_at?: string
          id?: string
          message?: string
          subject_id?: string
          tone?: string
        }
        Relationships: []
      }
      notebook_links: {
        Row: {
          topic_id: string
          url: string
          user_id: string
        }
        Insert: {
          topic_id: string
          url: string
          user_id: string
        }
        Update: {
          topic_id?: string
          url?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "notebook_links_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      notes: {
        Row: {
          audio_data_url: string | null
          body: string
          created_at: string
          id: string
          sketch_data_url: string | null
          subject_id: string | null
          tags: string[]
          title: string
          topic_id: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          audio_data_url?: string | null
          body?: string
          created_at?: string
          id?: string
          sketch_data_url?: string | null
          subject_id?: string | null
          tags?: string[]
          title: string
          topic_id?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          audio_data_url?: string | null
          body?: string
          created_at?: string
          id?: string
          sketch_data_url?: string | null
          subject_id?: string | null
          tags?: string[]
          title?: string
          topic_id?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "notes_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      practice_test_content: {
        Row: {
          created_at: string
          items: Json
          subject_id: string
          topic_id: string
        }
        Insert: {
          created_at?: string
          items: Json
          subject_id: string
          topic_id: string
        }
        Update: {
          created_at?: string
          items?: Json
          subject_id?: string
          topic_id?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          accent_theme: string
          coins: number
          created_at: string
          current_streak: number
          display_name: string | null
          id: string
          last_study_date: string | null
          longest_streak: number
          study_plan_mode: string
          total_reviews: number
          unlocked_themes: string[]
          updated_at: string
          xp: number
        }
        Insert: {
          accent_theme?: string
          coins?: number
          created_at?: string
          current_streak?: number
          display_name?: string | null
          id: string
          last_study_date?: string | null
          longest_streak?: number
          study_plan_mode?: string
          total_reviews?: number
          unlocked_themes?: string[]
          updated_at?: string
          xp?: number
        }
        Update: {
          accent_theme?: string
          coins?: number
          created_at?: string
          current_streak?: number
          display_name?: string | null
          id?: string
          last_study_date?: string | null
          longest_streak?: number
          study_plan_mode?: string
          total_reviews?: number
          unlocked_themes?: string[]
          updated_at?: string
          xp?: number
        }
        Relationships: []
      }
      qa_messages: {
        Row: {
          content: string
          created_at: string
          id: string
          role: string
          user_id: string
        }
        Insert: {
          content: string
          created_at?: string
          id?: string
          role: string
          user_id: string
        }
        Update: {
          content?: string
          created_at?: string
          id?: string
          role?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "qa_messages_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      quiz_attempts: {
        Row: {
          completed_at: string
          id: string
          score: number
          subject_id: string
          topic_id: string
          total: number
          user_id: string
        }
        Insert: {
          completed_at?: string
          id?: string
          score: number
          subject_id: string
          topic_id: string
          total: number
          user_id: string
        }
        Update: {
          completed_at?: string
          id?: string
          score?: number
          subject_id?: string
          topic_id?: string
          total?: number
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "quiz_attempts_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      quiz_content: {
        Row: {
          correct_index: number
          created_at: string
          explanation: string
          id: string
          options: Json
          question: string
          subject_id: string
          topic_id: string
        }
        Insert: {
          correct_index: number
          created_at?: string
          explanation: string
          id?: string
          options: Json
          question: string
          subject_id: string
          topic_id: string
        }
        Update: {
          correct_index?: number
          created_at?: string
          explanation?: string
          id?: string
          options?: Json
          question?: string
          subject_id?: string
          topic_id?: string
        }
        Relationships: []
      }
      study_days: {
        Row: {
          day: string
          user_id: string
        }
        Insert: {
          day: string
          user_id: string
        }
        Update: {
          day?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "study_days_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      study_rooms: {
        Row: {
          created_at: string
          created_by: string
          id: string
          name: string
          timer_ends_at: string | null
          timer_running: boolean
        }
        Insert: {
          created_at?: string
          created_by: string
          id?: string
          name: string
          timer_ends_at?: string | null
          timer_running?: boolean
        }
        Update: {
          created_at?: string
          created_by?: string
          id?: string
          name?: string
          timer_ends_at?: string | null
          timer_running?: boolean
        }
        Relationships: [
          {
            foreignKeyName: "study_rooms_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      subtasks: {
        Row: {
          done: boolean
          id: string
          task_id: string
          title: string
        }
        Insert: {
          done?: boolean
          id?: string
          task_id: string
          title: string
        }
        Update: {
          done?: boolean
          id?: string
          task_id?: string
          title?: string
        }
        Relationships: [
          {
            foreignKeyName: "subtasks_task_id_fkey"
            columns: ["task_id"]
            isOneToOne: false
            referencedRelation: "tasks"
            referencedColumns: ["id"]
          },
        ]
      }
      tasks: {
        Row: {
          created_at: string
          id: string
          links: string[]
          status: string
          title: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          links?: string[]
          status?: string
          title: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          links?: string[]
          status?: string
          title?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "tasks_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      time_sessions: {
        Row: {
          duration_ms: number
          id: string
          kind: string
          started_at: string
          subject_id: string | null
          user_id: string
        }
        Insert: {
          duration_ms: number
          id?: string
          kind: string
          started_at: string
          subject_id?: string | null
          user_id: string
        }
        Update: {
          duration_ms?: number
          id?: string
          kind?: string
          started_at?: string
          subject_id?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "time_sessions_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      user_audio_overviews: {
        Row: {
          audio_data_url: string | null
          created_at: string
          topic_id: string
          user_id: string
        }
        Insert: {
          audio_data_url?: string | null
          created_at?: string
          topic_id: string
          user_id: string
        }
        Update: {
          audio_data_url?: string | null
          created_at?: string
          topic_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_audio_overviews_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      user_badges: {
        Row: {
          badge_id: string
          earned_at: string
          user_id: string
        }
        Insert: {
          badge_id: string
          earned_at?: string
          user_id: string
        }
        Update: {
          badge_id?: string
          earned_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_badges_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      get_leaderboard: {
        Args: Record<PropertyKey, never>
        Returns: {
          display_name: string
          xp: number
          current_streak: number
        }[]
      }
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
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
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
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
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
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
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
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
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
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
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
