import { supabase } from "@/integrations/supabase/client";

export type ShareItemType =
  | "checklist_task"
  | "kanban_card"
  | "kanban_funnel"
  | "file"
  | "folder"
  | "note"
  | "calendar_event";

export type SharePermission = "view" | "comment" | "edit" | "duplicate";
export type ShareStatus = "active" | "revoked";

export interface SharedItem {
  id: string;
  item_type: ShareItemType;
  item_id: string;
  source_workspace_id: string;
  target_workspace_id: string;
  shared_by_user_id: string;
  permission_level: SharePermission;
  status: ShareStatus;
  item_title: string | null;
  message: string | null;
  created_at: string;
  updated_at: string;
}

export interface ShareInput {
  item_type: ShareItemType;
  item_id: string;
  item_title: string;
  source_workspace_id: string;
  target_workspace_id: string;
  permission_level: SharePermission;
  message?: string;
}

export const SHARE_TYPE_LABEL: Record<ShareItemType, string> = {
  checklist_task: "Tarefa",
  kanban_card: "Card",
  kanban_funnel: "Funil",
  file: "Arquivo",
  folder: "Pasta",
  note: "Nota",
  calendar_event: "Evento",
};

export const SHARE_PERMISSION_LABEL: Record<SharePermission, string> = {
  view: "Visualizar",
  comment: "Comentar",
  edit: "Editar",
  duplicate: "Duplicar",
};

export async function createShare(input: ShareInput, userId: string): Promise<{ ok: boolean; error?: string; id?: string }> {
  if (input.source_workspace_id === input.target_workspace_id) {
    return { ok: false, error: "Não é possível compartilhar com o mesmo workspace." };
  }
  const { data, error } = await supabase
    .from("shared_items")
    .upsert(
      {
        item_type: input.item_type,
        item_id: input.item_id,
        item_title: input.item_title,
        source_workspace_id: input.source_workspace_id,
        target_workspace_id: input.target_workspace_id,
        shared_by_user_id: userId,
        permission_level: input.permission_level,
        message: input.message ?? null,
        status: "active",
      } as never,
      { onConflict: "item_type,item_id,target_workspace_id" }
    )
    .select("id")
    .single();
  if (error) return { ok: false, error: error.message };
  await logActivity(data.id, userId, "shared", { permission: input.permission_level });
  return { ok: true, id: data.id };
}

export async function revokeShare(shareId: string, userId: string) {
  const { error } = await supabase
    .from("shared_items")
    .update({ status: "revoked" } as never)
    .eq("id", shareId);
  if (error) return { ok: false, error: error.message };
  await logActivity(shareId, userId, "revoked");
  return { ok: true };
}

export async function reactivateShare(shareId: string, userId: string) {
  const { error } = await supabase
    .from("shared_items")
    .update({ status: "active" } as never)
    .eq("id", shareId);
  if (error) return { ok: false, error: error.message };
  await logActivity(shareId, userId, "reactivated");
  return { ok: true };
}

export async function updateSharePermission(shareId: string, permission: SharePermission, userId: string) {
  const { error } = await supabase
    .from("shared_items")
    .update({ permission_level: permission } as never)
    .eq("id", shareId);
  if (error) return { ok: false, error: error.message };
  await logActivity(shareId, userId, "permission_changed", { permission });
  return { ok: true };
}

export async function logActivity(shareId: string, userId: string, action: string, metadata?: Record<string, unknown>) {
  await supabase.from("shared_item_activity").insert({
    shared_item_id: shareId,
    user_id: userId,
    action,
    metadata: (metadata ?? null) as never,
  } as never);
}

export async function postComment(shareId: string, userId: string, workspaceId: string, body: string) {
  const trimmed = body.trim();
  if (!trimmed) return { ok: false, error: "Mensagem vazia" };
  const { error } = await supabase.from("shared_item_comments").insert({
    shared_item_id: shareId,
    user_id: userId,
    workspace_id: workspaceId,
    body: trimmed,
  } as never);
  if (error) return { ok: false, error: error.message };
  await logActivity(shareId, userId, "commented");
  return { ok: true };
}

/** True if the given item is currently shared OUT of the given workspace. */
export async function isItemShared(itemType: ShareItemType, itemId: string): Promise<boolean> {
  const { data } = await supabase
    .from("shared_items")
    .select("id")
    .eq("item_type", itemType)
    .eq("item_id", itemId)
    .eq("status", "active")
    .limit(1);
  return !!data && data.length > 0;
}
