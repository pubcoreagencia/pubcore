import { supabase } from "@/integrations/supabase/client";
import { getActiveWorkspaceId } from "./workspace";

export type ActivityEntityType =
  | "checklist_task"
  | "kanban_card"
  | "kanban_column"
  | "calendar_event"
  | "crm_lead"
  | "ponto_session"
  | "note";

export type ActivityAction = "deleted" | "created" | "completed" | "updated";

export interface ActivityLogInput {
  entity_type: ActivityEntityType;
  entity_id?: string | null;
  action: ActivityAction;
  title?: string | null;
  company?: string | null;
  payload?: Record<string, unknown>;
  user_name?: string | null;
}

/**
 * Inserts an activity record. Best-effort: logs and swallows errors so the
 * primary mutation (delete/update/etc.) is never blocked by audit failures.
 */
export async function logActivity(input: ActivityLogInput): Promise<void> {
  try {
    const { data: u } = await supabase.auth.getUser();
    const user = u?.user;
    if (!user) return;
    const workspace_id = getActiveWorkspaceId();
    if (!workspace_id) return;
    await supabase.from("activity_log").insert({
      user_id: user.id,
      workspace_id,
      owner_email: user.email ?? "unknown",
      user_name:
        input.user_name ??
        (user.user_metadata?.name as string | undefined) ??
        (user.user_metadata?.full_name as string | undefined) ??
        user.email?.split("@")[0] ??
        null,
      entity_type: input.entity_type,
      entity_id: input.entity_id ?? null,
      action: input.action,
      title: input.title ?? null,
      company: input.company ?? null,
      payload: (input.payload ?? {}) as never,
    } as never);
  } catch (err) {
    // eslint-disable-next-line no-console
    console.warn("[activity-log] failed:", err);
  }
}
