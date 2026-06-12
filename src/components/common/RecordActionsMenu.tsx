import { MoreVertical, Pencil, Copy, Archive, ArchiveRestore, Trash2 } from "lucide-react";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

export interface RecordAction {
  onEdit?: () => void;
  onDuplicate?: () => void;
  onArchive?: () => void;
  onUnarchive?: () => void;
  onDelete?: () => void;
  isArchived?: boolean;
}

/**
 * Standard record-level action menu used across modules
 * (Checklist, Ponto, Financeiro, Estoque, Kanban, CRM).
 * Touch-friendly: trigger button is 40x40 on touch.
 */
export function RecordActionsMenu({
  onEdit, onDuplicate, onArchive, onUnarchive, onDelete, isArchived,
}: RecordAction) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          className="h-9 w-9 sm:h-8 sm:w-8 rounded-md flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-surface transition"
          aria-label="Ações"
          onClick={(e) => e.stopPropagation()}
        >
          <MoreVertical className="h-4 w-4" />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-44" onClick={(e) => e.stopPropagation()}>
        {onEdit && <DropdownMenuItem onClick={onEdit}><Pencil className="h-3.5 w-3.5 mr-2" /> Editar</DropdownMenuItem>}
        {onDuplicate && <DropdownMenuItem onClick={onDuplicate}><Copy className="h-3.5 w-3.5 mr-2" /> Duplicar</DropdownMenuItem>}
        {(onArchive || onUnarchive) && (
          <DropdownMenuItem onClick={isArchived ? onUnarchive : onArchive}>
            {isArchived
              ? <><ArchiveRestore className="h-3.5 w-3.5 mr-2" /> Restaurar</>
              : <><Archive className="h-3.5 w-3.5 mr-2" /> Arquivar</>}
          </DropdownMenuItem>
        )}
        {onDelete && (
          <>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={onDelete} className="text-destructive focus:text-destructive">
              <Trash2 className="h-3.5 w-3.5 mr-2" /> Excluir
            </DropdownMenuItem>
          </>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
