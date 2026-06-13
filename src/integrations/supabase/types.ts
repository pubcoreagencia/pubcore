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
      checklist_companies: {
        Row: {
          archived_at: string | null
          color: string | null
          created_at: string
          description: string | null
          id: string
          name: string
          notes: string | null
          parent_company_id: string | null
          ponto_daily_limit_minutes: number
          ponto_limit_enabled: boolean
          position: number
          responsible: string | null
          segment: string | null
          status: string
          updated_at: string
          workspace_id: string
        }
        Insert: {
          archived_at?: string | null
          color?: string | null
          created_at?: string
          description?: string | null
          id?: string
          name: string
          notes?: string | null
          parent_company_id?: string | null
          ponto_daily_limit_minutes?: number
          ponto_limit_enabled?: boolean
          position?: number
          responsible?: string | null
          segment?: string | null
          status?: string
          updated_at?: string
          workspace_id: string
        }
        Update: {
          archived_at?: string | null
          color?: string | null
          created_at?: string
          description?: string | null
          id?: string
          name?: string
          notes?: string | null
          parent_company_id?: string | null
          ponto_daily_limit_minutes?: number
          ponto_limit_enabled?: boolean
          position?: number
          responsible?: string | null
          segment?: string | null
          status?: string
          updated_at?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "checklist_companies_parent_company_id_fkey"
            columns: ["parent_company_id"]
            isOneToOne: false
            referencedRelation: "checklist_companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "checklist_companies_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      checklist_daily_completions: {
        Row: {
          company: string
          completed_at: string
          completed_on: string
          created_at: string
          id: string
          owner_email: string
          task_id: string | null
          task_title: string
          user_id: string | null
          user_name: string | null
          workspace_id: string
        }
        Insert: {
          company: string
          completed_at?: string
          completed_on: string
          created_at?: string
          id?: string
          owner_email: string
          task_id?: string | null
          task_title: string
          user_id?: string | null
          user_name?: string | null
          workspace_id: string
        }
        Update: {
          company?: string
          completed_at?: string
          completed_on?: string
          created_at?: string
          id?: string
          owner_email?: string
          task_id?: string | null
          task_title?: string
          user_id?: string | null
          user_name?: string | null
          workspace_id?: string
        }
        Relationships: []
      }
      checklist_tasks: {
        Row: {
          assignee: string | null
          column_id: string | null
          company: string
          created_at: string
          description: string | null
          done_at: string | null
          due_date: string | null
          funnel_id: string | null
          id: string
          legacy_checklist: Json
          notes: string | null
          owner_email: string
          parent_id: string | null
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
          column_id?: string | null
          company: string
          created_at?: string
          description?: string | null
          done_at?: string | null
          due_date?: string | null
          funnel_id?: string | null
          id?: string
          legacy_checklist?: Json
          notes?: string | null
          owner_email: string
          parent_id?: string | null
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
          column_id?: string | null
          company?: string
          created_at?: string
          description?: string | null
          done_at?: string | null
          due_date?: string | null
          funnel_id?: string | null
          id?: string
          legacy_checklist?: Json
          notes?: string | null
          owner_email?: string
          parent_id?: string | null
          position?: number
          priority?: string
          status?: string
          title?: string
          updated_at?: string
          user_id?: string | null
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "checklist_tasks_parent_id_fkey"
            columns: ["parent_id"]
            isOneToOne: false
            referencedRelation: "checklist_tasks"
            referencedColumns: ["id"]
          },
        ]
      }
      crm_leads: {
        Row: {
          archived_at: string | null
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
          archived_at?: string | null
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
          archived_at?: string | null
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
      files_folders: {
        Row: {
          color: string | null
          company: string | null
          created_at: string
          created_by: string | null
          description: string | null
          favorite: boolean
          icon: string | null
          id: string
          name: string
          parent_id: string | null
          pos_x: number
          pos_y: number
          updated_at: string
          workspace_id: string
        }
        Insert: {
          color?: string | null
          company?: string | null
          created_at?: string
          created_by?: string | null
          description?: string | null
          favorite?: boolean
          icon?: string | null
          id?: string
          name: string
          parent_id?: string | null
          pos_x?: number
          pos_y?: number
          updated_at?: string
          workspace_id: string
        }
        Update: {
          color?: string | null
          company?: string | null
          created_at?: string
          created_by?: string | null
          description?: string | null
          favorite?: boolean
          icon?: string | null
          id?: string
          name?: string
          parent_id?: string | null
          pos_x?: number
          pos_y?: number
          updated_at?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "files_folders_parent_id_fkey"
            columns: ["parent_id"]
            isOneToOne: false
            referencedRelation: "files_folders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "files_folders_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      files_items: {
        Row: {
          category: string | null
          company: string | null
          created_at: string
          created_by: string | null
          favorite: boolean
          folder_id: string | null
          id: string
          mime_type: string | null
          name: string
          pos_x: number
          pos_y: number
          size_bytes: number
          storage_path: string
          updated_at: string
          workspace_id: string
        }
        Insert: {
          category?: string | null
          company?: string | null
          created_at?: string
          created_by?: string | null
          favorite?: boolean
          folder_id?: string | null
          id?: string
          mime_type?: string | null
          name: string
          pos_x?: number
          pos_y?: number
          size_bytes?: number
          storage_path: string
          updated_at?: string
          workspace_id: string
        }
        Update: {
          category?: string | null
          company?: string | null
          created_at?: string
          created_by?: string | null
          favorite?: boolean
          folder_id?: string | null
          id?: string
          mime_type?: string | null
          name?: string
          pos_x?: number
          pos_y?: number
          size_bytes?: number
          storage_path?: string
          updated_at?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "files_items_folder_id_fkey"
            columns: ["folder_id"]
            isOneToOne: false
            referencedRelation: "files_folders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "files_items_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
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
          archived_at: string | null
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
          archived_at?: string | null
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
          archived_at?: string | null
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
          archived_at: string | null
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
          archived_at?: string | null
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
          archived_at?: string | null
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
          archived_at: string | null
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
          archived_at?: string | null
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
          archived_at?: string | null
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
      gratitude_entries: {
        Row: {
          completed_at: string | null
          content: string
          created_at: string
          entry_date: string
          id: string
          owner_email: string
          updated_at: string
          user_id: string
          workspace_id: string
        }
        Insert: {
          completed_at?: string | null
          content: string
          created_at?: string
          entry_date?: string
          id?: string
          owner_email: string
          updated_at?: string
          user_id: string
          workspace_id: string
        }
        Update: {
          completed_at?: string | null
          content?: string
          created_at?: string
          entry_date?: string
          id?: string
          owner_email?: string
          updated_at?: string
          user_id?: string
          workspace_id?: string
        }
        Relationships: []
      }
      kanban_attachments: {
        Row: {
          card_id: string
          created_at: string
          id: string
          mime_type: string | null
          name: string
          size: number
          storage_path: string
          uploader_name: string | null
          user_id: string
          workspace_id: string
        }
        Insert: {
          card_id: string
          created_at?: string
          id?: string
          mime_type?: string | null
          name: string
          size?: number
          storage_path: string
          uploader_name?: string | null
          user_id: string
          workspace_id: string
        }
        Update: {
          card_id?: string
          created_at?: string
          id?: string
          mime_type?: string | null
          name?: string
          size?: number
          storage_path?: string
          uploader_name?: string | null
          user_id?: string
          workspace_id?: string
        }
        Relationships: []
      }
      kanban_card_links: {
        Row: {
          created_at: string
          from_card_id: string
          funnel_id: string
          id: string
          label: string | null
          to_card_id: string
          workspace_id: string
        }
        Insert: {
          created_at?: string
          from_card_id: string
          funnel_id: string
          id?: string
          label?: string | null
          to_card_id: string
          workspace_id: string
        }
        Update: {
          created_at?: string
          from_card_id?: string
          funnel_id?: string
          id?: string
          label?: string | null
          to_card_id?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "kanban_card_links_from_card_id_fkey"
            columns: ["from_card_id"]
            isOneToOne: false
            referencedRelation: "kanban_cards"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "kanban_card_links_to_card_id_fkey"
            columns: ["to_card_id"]
            isOneToOne: false
            referencedRelation: "kanban_cards"
            referencedColumns: ["id"]
          },
        ]
      }
      kanban_cards: {
        Row: {
          archived_at: string | null
          assignee: string | null
          column_id: string | null
          company: string
          created_at: string
          description: string | null
          due_date: string | null
          flow_collapsed: boolean
          flow_x: number | null
          flow_y: number | null
          funnel_id: string | null
          id: string
          legacy_checklist: Json
          notes: string | null
          owner_email: string
          parent_card_id: string | null
          position: number
          priority: string
          status: string
          title: string
          updated_at: string
          user_id: string | null
          workspace_id: string
        }
        Insert: {
          archived_at?: string | null
          assignee?: string | null
          column_id?: string | null
          company: string
          created_at?: string
          description?: string | null
          due_date?: string | null
          flow_collapsed?: boolean
          flow_x?: number | null
          flow_y?: number | null
          funnel_id?: string | null
          id?: string
          legacy_checklist?: Json
          notes?: string | null
          owner_email: string
          parent_card_id?: string | null
          position?: number
          priority?: string
          status?: string
          title: string
          updated_at?: string
          user_id?: string | null
          workspace_id: string
        }
        Update: {
          archived_at?: string | null
          assignee?: string | null
          column_id?: string | null
          company?: string
          created_at?: string
          description?: string | null
          due_date?: string | null
          flow_collapsed?: boolean
          flow_x?: number | null
          flow_y?: number | null
          funnel_id?: string | null
          id?: string
          legacy_checklist?: Json
          notes?: string | null
          owner_email?: string
          parent_card_id?: string | null
          position?: number
          priority?: string
          status?: string
          title?: string
          updated_at?: string
          user_id?: string | null
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "kanban_cards_parent_card_id_fkey"
            columns: ["parent_card_id"]
            isOneToOne: false
            referencedRelation: "kanban_cards"
            referencedColumns: ["id"]
          },
        ]
      }
      kanban_cards_archive: {
        Row: {
          assignee: string | null
          checklist: Json
          column_id: string | null
          column_name: string | null
          company: string
          created_at: string
          description: string | null
          due_date: string | null
          funnel_id: string | null
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
          funnel_id?: string | null
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
          funnel_id?: string | null
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
          funnel_id: string | null
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
          funnel_id?: string | null
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
          funnel_id?: string | null
          id?: string
          name?: string
          position?: number
          updated_at?: string
          user_id?: string
          workspace_id?: string
        }
        Relationships: []
      }
      kanban_funnels: {
        Row: {
          archived_at: string | null
          color: string
          company: string | null
          created_at: string
          description: string | null
          icon: string
          id: string
          name: string
          position: number
          updated_at: string
          user_id: string
          workspace_id: string
        }
        Insert: {
          archived_at?: string | null
          color?: string
          company?: string | null
          created_at?: string
          description?: string | null
          icon?: string
          id?: string
          name: string
          position?: number
          updated_at?: string
          user_id: string
          workspace_id: string
        }
        Update: {
          archived_at?: string | null
          color?: string
          company?: string | null
          created_at?: string
          description?: string | null
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
      ponto_session_edits: {
        Row: {
          created_at: string
          edited_by: string
          edited_by_email: string | null
          id: string
          next: Json
          previous: Json
          session_id: string
          workspace_id: string
        }
        Insert: {
          created_at?: string
          edited_by: string
          edited_by_email?: string | null
          id?: string
          next: Json
          previous: Json
          session_id: string
          workspace_id: string
        }
        Update: {
          created_at?: string
          edited_by?: string
          edited_by_email?: string | null
          id?: string
          next?: Json
          previous?: Json
          session_id?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "ponto_session_edits_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "ponto_sessions"
            referencedColumns: ["id"]
          },
        ]
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
          company: string | null
          created_at: string
          description: string | null
          edited_at: string | null
          edited_by: string | null
          ended_at: string | null
          id: string
          notes: string | null
          original_ended_at: string | null
          original_started_at: string | null
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
          company?: string | null
          created_at?: string
          description?: string | null
          edited_at?: string | null
          edited_by?: string | null
          ended_at?: string | null
          id?: string
          notes?: string | null
          original_ended_at?: string | null
          original_started_at?: string | null
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
          company?: string | null
          created_at?: string
          description?: string | null
          edited_at?: string | null
          edited_by?: string | null
          ended_at?: string | null
          id?: string
          notes?: string | null
          original_ended_at?: string | null
          original_started_at?: string | null
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
          onboarding_completed_at: string | null
          role: string | null
          status: string
          theme_preference: string
          updated_at: string
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string
          display_name?: string | null
          email?: string | null
          id: string
          onboarding_completed_at?: string | null
          role?: string | null
          status?: string
          theme_preference?: string
          updated_at?: string
        }
        Update: {
          avatar_url?: string | null
          created_at?: string
          display_name?: string | null
          email?: string | null
          id?: string
          onboarding_completed_at?: string | null
          role?: string | null
          status?: string
          theme_preference?: string
          updated_at?: string
        }
        Relationships: []
      }
      sticky_notes: {
        Row: {
          color: string
          content: string
          created_at: string
          id: string
          owner_email: string
          position: number
          tag: string | null
          title: string
          updated_at: string
          user_id: string
          workspace_id: string
        }
        Insert: {
          color?: string
          content?: string
          created_at?: string
          id?: string
          owner_email: string
          position?: number
          tag?: string | null
          title?: string
          updated_at?: string
          user_id: string
          workspace_id: string
        }
        Update: {
          color?: string
          content?: string
          created_at?: string
          id?: string
          owner_email?: string
          position?: number
          tag?: string | null
          title?: string
          updated_at?: string
          user_id?: string
          workspace_id?: string
        }
        Relationships: []
      }
      stock_categories: {
        Row: {
          color: string
          company_id: string | null
          created_at: string
          group_id: string | null
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
          company_id?: string | null
          created_at?: string
          group_id?: string | null
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
          company_id?: string | null
          created_at?: string
          group_id?: string | null
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
      stock_companies: {
        Row: {
          color: string
          created_at: string
          icon: string
          id: string
          name: string
          position: number
          slug: string
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
          slug: string
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
          slug?: string
          updated_at?: string
          user_id?: string
          workspace_id?: string
        }
        Relationships: []
      }
      stock_field_defs: {
        Row: {
          company_id: string
          created_at: string
          id: string
          is_system: boolean
          key: string
          label: string
          options: Json
          position: number
          required: boolean
          type: string
          updated_at: string
          user_id: string
          visible: boolean
          workspace_id: string
        }
        Insert: {
          company_id: string
          created_at?: string
          id?: string
          is_system?: boolean
          key: string
          label: string
          options?: Json
          position?: number
          required?: boolean
          type?: string
          updated_at?: string
          user_id: string
          visible?: boolean
          workspace_id: string
        }
        Update: {
          company_id?: string
          created_at?: string
          id?: string
          is_system?: boolean
          key?: string
          label?: string
          options?: Json
          position?: number
          required?: boolean
          type?: string
          updated_at?: string
          user_id?: string
          visible?: boolean
          workspace_id?: string
        }
        Relationships: []
      }
      stock_groups: {
        Row: {
          color: string
          company_id: string
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
          company_id: string
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
          company_id?: string
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
          archived_at: string | null
          category: string | null
          category_id: string | null
          company: string
          company_id: string | null
          cost: number
          created_at: string
          data: Json
          description: string | null
          group_id: string | null
          id: string
          location: string | null
          min_quantity: number
          name: string
          notes: string | null
          position: number
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
          archived_at?: string | null
          category?: string | null
          category_id?: string | null
          company?: string
          company_id?: string | null
          cost?: number
          created_at?: string
          data?: Json
          description?: string | null
          group_id?: string | null
          id?: string
          location?: string | null
          min_quantity?: number
          name: string
          notes?: string | null
          position?: number
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
          archived_at?: string | null
          category?: string | null
          category_id?: string | null
          company?: string
          company_id?: string | null
          cost?: number
          created_at?: string
          data?: Json
          description?: string | null
          group_id?: string | null
          id?: string
          location?: string | null
          min_quantity?: number
          name?: string
          notes?: string | null
          position?: number
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
          company_id: string | null
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
          company_id?: string | null
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
          company_id?: string | null
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
      close_ponto_session: {
        Args: { _ended_at?: string; _session_id: string }
        Returns: boolean
      }
      close_stale_ponto_sessions: { Args: { _idle?: string }; Returns: number }
      company_impact_report: {
        Args: { _name: string; _workspace_id: string }
        Returns: Json
      }
      delete_checklist_company_cascade: {
        Args: { _name: string; _workspace_id: string }
        Returns: undefined
      }
      delete_workspace_cascade: {
        Args: { _workspace_id: string }
        Returns: undefined
      }
      has_app_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      invite_member_by_email: {
        Args: {
          _email: string
          _role?: Database["public"]["Enums"]["workspace_role"]
          _workspace_id: string
        }
        Returns: Json
      }
      is_workspace_admin: {
        Args: { _user_id: string; _workspace_id: string }
        Returns: boolean
      }
      is_workspace_member: {
        Args: { _user_id: string; _workspace_id: string }
        Returns: boolean
      }
      list_accounts_by_status: {
        Args: { _status?: string }
        Returns: {
          created_at: string
          display_name: string
          email: string
          id: string
          status: string
        }[]
      }
      list_all_workspaces: {
        Args: never
        Returns: {
          created_at: string
          id: string
          member_count: number
          name: string
          owner_email: string
          owner_id: string
          owner_name: string
          slug: string
        }[]
      }
      list_workspace_members: {
        Args: { _workspace_id: string }
        Returns: {
          display_name: string
          email: string
          role: Database["public"]["Enums"]["workspace_role"]
          user_id: string
        }[]
      }
      remove_member: {
        Args: { _user_id: string; _workspace_id: string }
        Returns: undefined
      }
      rename_checklist_company: {
        Args: { _new_name: string; _old_name: string; _workspace_id: string }
        Returns: undefined
      }
      set_account_status: {
        Args: { _status: string; _user_id: string }
        Returns: undefined
      }
      set_company_ponto_limit: {
        Args: { _company_id: string; _enabled: boolean; _minutes: number }
        Returns: undefined
      }
      set_member_role: {
        Args: {
          _role: Database["public"]["Enums"]["workspace_role"]
          _user_id: string
          _workspace_id: string
        }
        Returns: undefined
      }
      transfer_company_records: {
        Args: { _from: string; _to: string; _workspace_id: string }
        Returns: undefined
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
