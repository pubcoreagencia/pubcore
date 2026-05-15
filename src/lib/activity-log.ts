// Activity log was removed. Deleted items are wiped permanently with no audit trail.
// This stub remains so existing call sites compile without changes.

export type ActivityEntityType =
  | "checklist_task"
  | "kanban_card"
  | "kanban_column"
  | "calendar_event"
  | "crm_lead"
  | "ponto_session"
  | "note"
  | "finance_transaction"
  | "finance_cost"
  | "finance_product";

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

export async function logActivity(_input: ActivityLogInput): Promise<void> {
  // no-op
}
