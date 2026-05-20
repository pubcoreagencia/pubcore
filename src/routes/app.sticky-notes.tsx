import { createFileRoute } from "@tanstack/react-router";
import { StickyNote, Plus } from "lucide-react";
import { StickyNotesPanel, useStickyNotes } from "@/components/StickyNotesPanel";

export const Route = createFileRoute("/app/sticky-notes")({
  component: StickyNotesPage,
});

function StickyNotesPage() {
  const { notes, createNote } = useStickyNotes();
  return (
    <div className="w-full min-w-0 max-w-full overflow-x-hidden p-4 md:p-6">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2 min-w-0">
          <div className="h-8 w-8 rounded-lg bg-amber-300/20 grid place-items-center shrink-0">
            <StickyNote className="h-4 w-4 text-amber-300" />
          </div>
          <div className="min-w-0">
            <h1 className="text-base md:text-lg font-semibold text-foreground leading-tight">Sticky Notes</h1>
            <p className="text-[11px] text-muted-foreground">{notes.length} nota(s)</p>
          </div>
        </div>
        <button
          onClick={createNote}
          className="inline-flex items-center gap-1.5 h-9 px-3 rounded-lg bg-primary text-primary-foreground text-xs font-medium hover:opacity-90 active:scale-95 transition"
        >
          <Plus className="h-4 w-4" />
          Nova
        </button>
      </div>
      <StickyNotesPanel variant="full" />
    </div>
  );
}
