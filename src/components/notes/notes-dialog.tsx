import { useState } from "react"
import { Loader2, Pencil, Plus, StickyNote, Trash2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { NoteEditorDialog } from "@/components/notes/note-editor-dialog"
import { useNotes } from "@/hooks/use-notes"
import { type Note } from "@/lib/api"

type NotesDialogProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  agentId?: string
}

// Titles are unique per agent, so "New note" picks the first free placeholder.
function untitledTitle(notes: Note[]): string {
  const taken = new Set(notes.map((note) => note.title))
  if (!taken.has("Untitled")) return "Untitled"
  let i = 2
  while (taken.has(`Untitled ${i}`)) i++
  return `Untitled ${i}`
}

// The agent's shared notes in one flat list — same layout as the files dialog.
// Notes are agent-wide (not per conversation) and editable by hand here as
// well as by the agent's note tools.
export function NotesDialog({ open, onOpenChange, agentId }: NotesDialogProps) {
  const { notes, loading, create, update, remove } = useNotes(open, agentId)
  // Note open in the editor popup. isNew steers focus: a fresh note wants its
  // placeholder title replaced, an existing one is opened for its content.
  const [editing, setEditing] = useState<{ note: Note; isNew: boolean } | null>(null)
  const [creating, setCreating] = useState(false)
  const [pendingDelete, setPendingDelete] = useState<Note | null>(null)

  const handleOpenChange = (next: boolean) => {
    if (!next) {
      setEditing(null)
      setPendingDelete(null)
    }
    onOpenChange(next)
  }

  // The row is created up front (notes autosave, so there is no explicit save
  // moment to create it at) and opened with a placeholder title.
  const handleNewNote = async () => {
    setCreating(true)
    try {
      const note = await create(untitledTitle(notes), "")
      if (note) setEditing({ note, isNew: true })
    } finally {
      setCreating(false)
    }
  }

  return (
    <>
      <Dialog open={open} onOpenChange={handleOpenChange}>
        {/* Fixed height so the dialog doesn't resize as the list loads. */}
        <DialogContent className="flex h-[min(85vh,44rem)] flex-col sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <StickyNote className="size-5" />
              Notes
            </DialogTitle>
            <DialogDescription>
              Shared notes the agent can read and update from any conversation. You can edit them
              by hand too.
            </DialogDescription>
          </DialogHeader>

          <div>
            <Button
              variant="outline"
              size="sm"
              className="gap-2"
              disabled={creating}
              onClick={() => void handleNewNote()}
            >
              {creating ? <Loader2 className="size-4 animate-spin" /> : <Plus className="size-4" />}
              New note
            </Button>
          </div>

          {/* Plain overflow div: Radix ScrollArea's display:table viewport doesn't
              constrain height inside the flex dialog, so it never scrolls. */}
          <div className="min-h-0 flex-1 overflow-y-auto pr-1">
            <div className="flex flex-col gap-1 py-1">
              {loading && (
                <div className="flex flex-col gap-2">
                  {Array.from({ length: 4 }, (_, i) => (
                    <Skeleton key={i} className="h-12 w-full" />
                  ))}
                </div>
              )}

              {!loading && notes.length === 0 && (
                <p className="py-10 text-center text-sm text-muted-foreground">
                  No notes yet. Ask the agent to keep a note — a running list, a plan — or create
                  one yourself.
                </p>
              )}

              {!loading &&
                notes.map((note) => (
                  <div
                    key={note.id}
                    className="group flex items-center gap-3 rounded-md border px-3 py-2"
                  >
                    <StickyNote className="size-4 shrink-0 text-muted-foreground" />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium">{note.title}</p>
                      <p className="text-xs text-muted-foreground">
                        Updated {new Date(note.updatedAt).toLocaleDateString()}
                      </p>
                    </div>
                    <Button
                      variant="ghost"
                      size="icon"
                      aria-label={`Edit ${note.title}`}
                      className="shrink-0 opacity-60 hover:opacity-100"
                      onClick={() => setEditing({ note, isNew: false })}
                    >
                      <Pencil className="size-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      aria-label={`Remove ${note.title}`}
                      className="shrink-0 opacity-60 hover:text-destructive hover:opacity-100"
                      onClick={() => setPendingDelete(note)}
                    >
                      <Trash2 className="size-4" />
                    </Button>
                  </div>
                ))}
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Editor popup, stacked on top of the notes dialog (rendered later in
          the portal, so it sits above). Notes always open in edit mode and
          autosave, so closing it is the only way out. */}
      <NoteEditorDialog
        note={editing?.note ?? null}
        isNew={editing?.isNew ?? false}
        onOpenChange={(next) => !next && setEditing(null)}
        onUpdate={update}
      />

      <AlertDialog
        open={pendingDelete !== null}
        onOpenChange={(open) => !open && setPendingDelete(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remove note?</AlertDialogTitle>
            <AlertDialogDescription>
              "{pendingDelete?.title}" will be permanently deleted for everyone using this agent.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                if (pendingDelete) void remove(pendingDelete.id)
                setPendingDelete(null)
              }}
            >
              Remove
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}
