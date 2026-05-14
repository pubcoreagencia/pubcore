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
      activity_log: {
        Row: {
          action: string
          company: string | null
          created_at: string
          entity_id: string | null
          entity_type: string
          id: string
          owner_email: string
          payload: Json
          title: string | null
          user_id: string
          user_name: string | null
          workspace_id: string
        }
        Insert: {
          action: string
          company?: string | null
          created_at?: string
          entity_id?: string | null
          entity_type: string
          id?: string
          owner_email: string
          payload?: Json
          title?: string | null
          user_id: string
          user_name?: string | null
          workspace_id: string
        }
        Update: {
          action?: string
          company?: string | null
          created_at?: string
          entity_id?: string | null
          entity_type?: string
          id?: string
          owner_email?: string
          payload?: Json
          title?: string | null
          user_id?: string
          user_name?: string | null
          workspace_id?: string
        }
        Relationships: []
      }
      calendar_events: {
        Row: {
          company: string | null
          created_at: string
          event_date: string
          event_time: string | null
          id: string
          notes: string | null
          title: string
          type: string
          updated_at: string
          user_id: string
          workspace_id: string
        }
        Insert: {
          company?: string | null
          created_at?: string
          event_date: string
          event_time?: string | null
          id?: string
          notes?: string | null
          title: string
          type?: string
          updated_at?: string
          user_id: string
          workspace_id: string
        }
        Update: {
          company?: string | null
          created_at?: string
          event_date?: string
          event_time?: string | null
          id?: string
          notes?: string | null
          title?: string
          type?: string
          updated_at?: string
          user_id?: string
          workspace_id?: string
        }
        Relationships: []
      }
      checklist_tasks: {
        Row: {
          assignee: string | null
          company: string
          created_at: string
          done_at: string | null
          id: string
          notes: string | null
          owner_email: string
          position: number
          priority: string
          status: string
          title: string
          updated_at: string
          user_id: string | null
          workspace_id: string
        }
        Insert: {
          assignee?: string | null
          company: string
          created_at?: string
          done_at?: string | null
          id?: string
          notes?: string | null
          owner_email: string
          position?: number
          priority?: string
          status?: string
          title: string
          updated_at?: string
          user_id?: string | null
          workspace_id: string
        }
        Update: {
          assignee?: string | null
          company?: string
          created_at?: string
          done_at?: string | null
          id?: string
          notes?: string | null
          owner_email?: string
          position?: number
          priority?: string
          status?: string
          title?: string
          updated_at?: string
          user_id?: string | null
          workspace_id?: string
        }
        Relationships: []
      }
      crm_leads: {
        Row: {
          company: string | null
          created_at: string
          email: string | null
          id: string
          name: string
          notes: string | null
          owner: string | null
          stage: string
          updated_at: string
          user_id: string
          value: number
          workspace_id: string
        }
        Insert: {
          company?: string | null
          created_at?: string
          email?: string | null
          id?: string
          name: string
          notes?: string | null
          owner?: string | null
          stage?: string
          updated_at?: string
          user_id: string
          value?: number
          workspace_id: string
        }
        Update: {
          company?: string | null
          created_at?: string
          email?: string | null
          id?: string
          name?: string
          notes?: string | null
          owner?: string | null
          stage?: string
          updated_at?: string
          user_id?: string
          value?: number
          workspace_id?: string
        }
        Relationships: []
      }
      finance_categories: {
        Row: {
          color: string
          created_at: string
          icon: string
          id: string
          kind: string
          name: string
          position: number
          updated_at: string
          user_id: string
          workspace_id: string
        }
        Insert: {
          color?: string
          created_at?: string
          icon?: string
          id?: string
          kind: string
          name: string
          position?: number
          updated_at?: string
          user_id: string
          workspace_id: string
        }
        Update: {
          color?: string
          created_at?: string
          icon?: string
          id?: string
          kind?: string
          name?: string
          position?: number
          updated_at?: string
          user_id?: string
          workspace_id?: string
        }
        Relationships: []
      }
      finance_costs: {
        Row: {
          active: boolean
          amount_monthly: number
          category: string | null
          company: string | null
          created_at: string
          id: string
          kind: string
          name: string
          notes: string | null
          updated_at: string
          user_id: string
          workspace_id: string
        }
        Insert: {
          active?: boolean
          amount_monthly?: number
          category?: string | null
          company?: string | null
          created_at?: string
          id?: string
          kind: string
          name: string
          notes?: string | null
          updated_at?: string
          user_id: string
          workspace_id: string
        }
        Update: {
          active?: boolean
          amount_monthly?: number
          category?: string | null
          company?: string | null
          created_at?: string
          id?: string
          kind?: string
          name?: string
          notes?: string | null
          updated_at?: string
          user_id?: string
          workspace_id?: string
        }
        Relationships: []
      }
      finance_products: {
        Row: {
          avg_demand_monthly: number
          category: string | null
          company: string
          cost: number
          created_at: string
          id: string
          name: string
          notes: string | null
          price: number
          stock: number
          updated_at: string
          user_id: string
          workspace_id: string
        }
        Insert: {
          avg_demand_monthly?: number
          category?: string | null
          company?: string
          cost?: number
          created_at?: string
          id?: string
          name: string
          notes?: string | null
          price?: number
          stock?: number
          updated_at?: string
          user_id: string
          workspace_id: string
        }
        Update: {
          avg_demand_monthly?: number
          category?: string | null
          company?: string
          cost?: number
          created_at?: string
          id?: string
          name?: string
          notes?: string | null
          price?: number
          stock?: number
          updated_at?: string
          user_id?: string
          workspace_id?: string
        }
        Relationships: []
      }
      finance_transactions: {
        Row: {
          amount: number
          category_id: string | null
          category_name: string | null
          company: string | null
          created_at: string
          description: string
          id: string
          kind: string
          notes: string | null
          occurred_on: string
          recurrence: string
          responsible: string | null
          updated_at: string
          user_id: string
          workspace_id: string
        }
        Insert: {
          amount?: number
          category_id?: string | null
          category_name?: string | null
          company?: string | null
          created_at?: string
          description?: string
          id?: string
          kind: string
          notes?: string | null
          occurred_on?: string
          recurrence?: string
          responsible?: string | null
          updated_at?: string
          user_id: string
          workspace_id: string
        }
        Update: {
          amount?: number
          category_id?: string | null
          category_name?: string | null
          company?: string | null
          created_at?: string
          description?: string
          id?: string
          kind?: string
          notes?: string | null
          occurred_on?: string
          recurrence?: string
          responsible?: string | null
          updated_at?: string
          user_id?: string
          workspace_id?: string
        }
        Relationships: []
      }
      kanban_cards: {
        Row: {
          assignee: string | null
          checklist: Json
          column_id: string | null
          column_name: string | null
          company: string
          created_at: string
          description: string | null
          due_date: string | null
          id: string
          notes: string | null
          position: number
          priority: string
          status: string
          title: string
          updated_at: string
          user_id: string
          workspace_id: string
        }
        Insert: {
          assignee?: string | null
          checklist?: Json
          column_id?: string | null
          column_name?: string | null
          company: string
          created_at?: string
          description?: string | null
          due_date?: string | null
          id?: string
          notes?: string | null
          position?: number
          priority?: string
          status?: string
          title: string
          updated_at?: string
          user_id: string
          workspace_id: string
        }
        Update: {
          assignee?: string | null
          checklist?: Json
          column_id?: string | null
          column_name?: string | null
          company?: string
          created_at?: string
          description?: string | null
          due_date?: string | null
          id?: string
          notes?: string | null
          position?: number
          priority?: string
          status?: string
          title?: string
          updated_at?: string
          user_id?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "kanban_cards_column_id_fkey"
            columns: ["column_id"]
            isOneToOne: false
            referencedRelation: "kanban_columns"
            referencedColumns: ["id"]
          },
        ]
      }
      kanban_columns: {
        Row: {
          color: string | null
          created_at: string
          id: string
          name: string
          position: number
          updated_at: string
          user_id: string
          workspace_id: string
        }
        Insert: {
          color?: string | null
          created_at?: string
          id?: string
          name: string
          position?: number
          updated_at?: string
          user_id: string
          workspace_id: string
        }
        Update: {
          color?: string | null
          created_at?: string
          id?: string
          name?: string
          position?: number
          updated_at?: string
          user_id?: string
          workspace_id?: string
        }
        Relationships: []
      }
      note_categories: {
        Row: {
          color: string
          created_at: string
          icon: string
          id: string
          name: string
          position: number
          updated_at: string
          user_id: string
          workspace_id: string
        }
        Insert: {
          color?: string
          created_at?: string
          icon?: string
          id?: string
          name: string
          position?: number
          updated_at?: string
          user_id: string
          workspace_id: string
        }
        Update: {
          color?: string
          created_at?: string
          icon?: string
          id?: string
          name?: string
          position?: number
          updated_at?: string
          user_id?: string
          workspace_id?: string
        }
        Relationships: []
      }
      notes: {
        Row: {
          category: string
          color: string | null
          company: string | null
          content: string
          created_at: string
          favorite: boolean
          id: string
          owner_email: string
          pinned: boolean
          tags: string[]
          title: string
          updated_at: string
          user_id: string
          user_name: string | null
          workspace_id: string
        }
        Insert: {
          category?: string
          color?: string | null
          company?: string | null
          content?: string
          created_at?: string
          favorite?: boolean
          id?: string
          owner_email: string
          pinned?: boolean
          tags?: string[]
          title?: string
          updated_at?: string
          user_id: string
          user_name?: string | null
          workspace_id: string
        }
        Update: {
          category?: string
          color?: string | null
          company?: string | null
          content?: string
          created_at?: string
          favorite?: boolean
          id?: string
          owner_email?: string
          pinned?: boolean
          tags?: string[]
          title?: string
          updated_at?: string
          user_id?: string
          user_name?: string | null
          workspace_id?: string
        }
        Relationships: []
      }
      ponto_session_tasks: {
        Row: {
          company: string
          completed_at: string
          created_at: string
          id: string
          owner_email: string
          session_id: string
          task_id: string | null
          title: string
          user_id: string | null
          user_name: string | null
          workspace_id: string
        }
        Insert: {
          company: string
          completed_at?: string
          created_at?: string
          id?: string
          owner_email: string
          session_id: string
          task_id?: string | null
          title: string
          user_id?: string | null
          user_name?: string | null
          workspace_id: string
        }
        Update: {
          company?: string
          completed_at?: string
          created_at?: string
          id?: string
          owner_email?: string
          session_id?: string
          task_id?: string | null
          title?: string
          user_id?: string | null
          user_name?: string | null
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "ponto_session_tasks_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "ponto_sessions"
            referencedColumns: ["id"]
          },
        ]
      }
      ponto_sessions: {
        Row: {
          created_at: string
          ended_at: string | null
          id: string
          owner_email: string
          pause_ms: number
          pauses: Json
          productive_ms: number
          started_at: string
          status: string
          summary: Json | null
          total_ms: number
          updated_at: string
          user_id: string | null
          user_name: string | null
          workspace_id: string
        }
        Insert: {
          created_at?: string
          ended_at?: string | null
          id?: string
          owner_email: string
          pause_ms?: number
          pauses?: Json
          productive_ms?: number
          started_at?: string
          status?: string
          summary?: Json | null
          total_ms?: number
          updated_at?: string
          user_id?: string | null
          user_name?: string | null
          workspace_id: string
        }
        Update: {
          created_at?: string
          ended_at?: string | null
          id?: string
          owner_email?: string
          pause_ms?: number
          pauses?: Json
          productive_ms?: number
          started_at?: string
          status?: string
          summary?: Json | null
          total_ms?: number
          updated_at?: string
          user_id?: string | null
          user_name?: string | null
          workspace_id?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          avatar_url: string | null
          created_at: string
          display_name: string | null
          email: string | null
          id: string
          role: string | null
          updated_at: string
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string
          display_name?: string | null
          email?: string | null
          id: string
          role?: string | null
          updated_at?: string
        }
        Update: {
          avatar_url?: string | null
          created_at?: string
          display_name?: string | null
          email?: string | null
          id?: string
          role?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      stock_categories: {
        Row: {
          color: string
          created_at: string
          icon: string
          id: string
          name: string
          position: number
          updated_at: string
          user_id: string
          workspace_id: string
        }
        Insert: {
          color?: string
          created_at?: string
          icon?: string
          id?: string
          name: string
          position?: number
          updated_at?: string
          user_id: string
          workspace_id: string
        }
        Update: {
          color?: string
          created_at?: string
          icon?: string
          id?: string
          name?: string
          position?: number
          updated_at?: string
          user_id?: string
          workspace_id?: string
        }
        Relationships: []
      }
      stock_items: {
        Row: {
          category: string | null
          company: string
          cost: number
          created_at: string
          description: string | null
          id: string
          location: string | null
          min_quantity: number
          name: string
          notes: string | null
          price: number
          quantity: number
          sku: string | null
          status: string
          supplier: string | null
          updated_at: string
          user_id: string
          workspace_id: string
        }
        Insert: {
          category?: string | null
          company?: string
          cost?: number
          created_at?: string
          description?: string | null
          id?: string
          location?: string | null
          min_quantity?: number
          name: string
          notes?: string | null
          price?: number
          quantity?: number
          sku?: string | null
          status?: string
          supplier?: string | null
          updated_at?: string
          user_id: string
          workspace_id: string
        }
        Update: {
          category?: string | null
          company?: string
          cost?: number
          created_at?: string
          description?: string | null
          id?: string
          location?: string | null
          min_quantity?: number
          name?: string
          notes?: string | null
          price?: number
          quantity?: number
          sku?: string | null
          status?: string
          supplier?: string | null
          updated_at?: string
          user_id?: string
          workspace_id?: string
        }
        Relationships: []
      }
      stock_movements: {
        Row: {
          created_at: string
          id: string
          item_id: string
          item_name: string
          kind: string
          notes: string | null
          occurred_at: string
          quantity: number
          user_id: string
          user_name: string | null
          workspace_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          item_id: string
          item_name: string
          kind: string
          notes?: string | null
          occurred_at?: string
          quantity?: number
          user_id: string
          user_name?: string | null
          workspace_id: string
        }
        Update: {
          created_at?: string
          id?: string
          item_id?: string
          item_name?: string
          kind?: string
          notes?: string | null
          occurred_at?: string
          quantity?: number
          user_id?: string
          user_name?: string | null
          workspace_id?: string
        }
        Relationships: []
      }
      user_roles: {
        Row: {
          created_at: string
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
      workspace_members: {
        Row: {
          created_at: string
          id: string
          role: Database["public"]["Enums"]["workspace_role"]
          user_id: string
          workspace_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          role?: Database["public"]["Enums"]["workspace_role"]
          user_id: string
          workspace_id: string
        }
        Update: {
          created_at?: string
          id?: string
          role?: Database["public"]["Enums"]["workspace_role"]
          user_id?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "workspace_members_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      workspaces: {
        Row: {
          created_at: string
          id: string
          name: string
          owner_id: string
          slug: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          name: string
          owner_id: string
          slug?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          name?: string
          owner_id?: string
          slug?: string | null
          updated_at?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      has_app_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      is_workspace_admin: {
        Args: { _user_id: string; _workspace_id: string }
        Returns: boolean
      }
      is_workspace_member: {
        Args: { _user_id: string; _workspace_id: string }
        Returns: boolean
      }
    }
    Enums: {
      app_role: "master" | "user"
      workspace_role: "admin" | "member"
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
    Enums: {
      app_role: ["master", "user"],
      workspace_role: ["admin", "member"],
    },
  },
} as const
