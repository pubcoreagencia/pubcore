import { useState } from "react";
import { Share2 } from "lucide-react";
import { ShareDialog } from "./ShareDialog";
import type { ShareItemType } from "@/lib/sharing";

interface Props {
  itemType: ShareItemType;
  itemId: string;
  itemTitle: string;
  className?: string;
  variant?: "icon" | "menu";
}

/** Reusable Share trigger. variant="icon" shows just the icon; "menu" shows label too. */
export function ShareButton({ itemType, itemId, itemTitle, className, variant = "icon" }: Props) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button
        type="button"
        onClick={(e) => { e.stopPropagation(); setOpen(true); }}
        className={
          className ??
          (variant === "menu"
            ? "w-full flex items-center gap-2 px-3 py-1.5 text-sm hover:bg-surface rounded-md text-left"
            : "inline-flex items-center gap-1 rounded-md p-1.5 text-muted-foreground hover:text-primary hover:bg-surface transition")
        }
        aria-label="Compartilhar"
      >
        <Share2 className="h-3.5 w-3.5" />
        {variant === "menu" && <span>Compartilhar</span>}
      </button>
      {open && (
        <ShareDialog
          open={open}
          onOpenChange={setOpen}
          itemType={itemType}
          itemId={itemId}
          itemTitle={itemTitle}
        />
      )}
    </>
  );
}
