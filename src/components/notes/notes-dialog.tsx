import { Component, lazy, Suspense, useEffect, useRef, useState, type ReactNode } from "react"
import { Loader2, Pencil, Plus, StickyNote, Trash2 } from "lucide-react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
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
import { useNotes } from "@/hooks/use-notes"
import { type Note } from "@/lib/api"

// MDXEditor (plus CodeMirror) is heavy; load it only when a note is actually
// being edited instead of shipping it with the main bundle.
const NoteMarkdownEditor = lazy(() =>
  import("./note-markdown-editor").then((m) => ({ default: m.NoteMarkdownEditor }))
)

// MDXEditor throws on markdown it can't represent (raw HTML, exotic syntax —
// agent-written notes can contain anything). When that happens the editor is
// unusable for this note, so swap in the plain-text fallback instead of taking
// the dialog down.
class MarkdownEditorBoundary extends Component<
  { fallback: ReactNode; children: ReactNode },
  { failed: boolean }
> {
  state = { failed: false }

  static getDerivedStateFromError() {
    return { failed: true }
  }

  render() {
    return this.state.failed ? this.props.fallback : this.props.children
  }
}

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
      <Dialog open={editing !== null} onOpenChange={(next) => !next && setEditing(null)}>
        <DialogContent className="flex h-[min(85vh,44rem)] flex-col sm:max-w-3xl">
          {editing && (
            <NoteEditorPane key={editing.note.id} {...editing} onUpdate={update} />
          )}
        </DialogContent>
      </Dialog>

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

const AUTOSAVE_DELAY_MS = 800
// How long sync may keep failing silently before the user is told.
const SYNC_ERROR_AFTER_MS = 5000

type NoteEditorPaneProps = {
  note: Note
  isNew: boolean
  onUpdate: (
    id: string,
    changes: { title?: string; content?: string },
    opts?: { silent?: boolean }
  ) => Promise<Note | null>
}

// One note in the popup, always editable: changes autosave in the background
// after a short pause in typing (and flush when the editor closes), so there
// is no save button or status text. Failed saves retry automatically; only a
// failure that persists past SYNC_ERROR_AFTER_MS surfaces as a toast. A blank
// title is never saved — the last saved title stands until it's fixed.
function NoteEditorPane({ note, isNew, onUpdate }: NoteEditorPaneProps) {
  const [title, setTitle] = useState(note.title)
  const [content, setContent] = useState(note.content)
  // What the server currently has; advanced on every successful save.
  const [saved, setSaved] = useState({ title: note.title, content: note.content })
  const [saving, setSaving] = useState(false)
  // When the current streak of failed saves started; null while sync is fine.
  const [failedSince, setFailedSince] = useState<number | null>(null)
  const syncToastId = `note-sync-${note.id}`

  const pendingChanges = (state: { title: string; content: string }) => {
    const nextTitle = state.title.trim()
    return {
      ...(nextTitle && nextTitle !== saved.title ? { title: nextTitle } : {}),
      ...(state.content !== saved.content ? { content: state.content } : {}),
    }
  }
  const dirty = Object.keys(pendingChanges({ title, content })).length > 0

  const save = async () => {
    const changes = pendingChanges({ title, content })
    if (Object.keys(changes).length === 0) return
    setSaving(true)
    const result = await onUpdate(note.id, changes, { silent: true })
    if (result) {
      setSaved({ title: result.title, content: result.content })
      setFailedSince(null)
      toast.dismiss(syncToastId)
    } else {
      // `saved` stays behind, so the autosave effect keeps retrying.
      setFailedSince((current) => current ?? Date.now())
    }
    setSaving(false)
  }

  // Debounced autosave. `saving` in the deps re-arms the timer after a save
  // finishes, picking up anything typed while the request was in flight —
  // and retrying failed saves until they go through.
  useEffect(() => {
    if (!dirty || saving) return
    const timer = setTimeout(() => void save(), AUTOSAVE_DELAY_MS)
    return () => clearTimeout(timer)
    // eslint-disable-next-line react-hooks/exhaustive-deps -- save/dirty are derived from these
  }, [title, content, saved, saving])

  // One persistent toast (stable id, replaced not stacked) once sync has been
  // failing for SYNC_ERROR_AFTER_MS; dismissed by the next successful save.
  useEffect(() => {
    if (failedSince === null) return
    const timer = setTimeout(() => {
      toast.error("Note changes aren't syncing", {
        id: syncToastId,
        description: "Your edits are kept in the editor and saving will keep retrying.",
        duration: Infinity,
      })
    }, Math.max(0, failedSince + SYNC_ERROR_AFTER_MS - Date.now()))
    return () => clearTimeout(timer)
  }, [failedSince, syncToastId])

  // Flush on unmount (dialog closed mid-debounce). The ref is refreshed after
  // every render so the unmount cleanup sees the latest text, not the closure
  // of mount time. The final attempt is not silent: the editor is gone, so a
  // failure here is the user's last chance to hear about it.
  const flushRef = useRef(() => {})
  useEffect(() => {
    flushRef.current = () => {
      toast.dismiss(syncToastId)
      const changes = pendingChanges({ title, content })
      if (Object.keys(changes).length > 0) void onUpdate(note.id, changes)
    }
  })
  useEffect(() => () => flushRef.current(), [])

  return (
    <>
      <DialogHeader className="sr-only">
        <DialogTitle>Edit note</DialogTitle>
        <DialogDescription>
          Changes save automatically and are visible to the agent and every member from all
          conversations.
        </DialogDescription>
      </DialogHeader>

      {/* pr-8 keeps the title clear of the dialog's close button. */}
      <div className="pr-8">
        <Input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="Title"
          maxLength={200}
          // A fresh note wants its placeholder title replaced first thing.
          autoFocus={isNew}
          onFocus={(e) => isNew && e.target.select()}
          className="font-medium"
        />
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto rounded-md border">
        <MarkdownEditorBoundary
          fallback={
            <Textarea
              value={content}
              onChange={(e) => setContent(e.target.value)}
              placeholder="Write the note…"
              className="h-full w-full resize-none rounded-none border-0 font-mono text-sm focus-visible:ring-0"
            />
          }
        >
          <Suspense
            fallback={
              <div className="flex h-full items-center justify-center text-muted-foreground">
                <Loader2 className="size-5 animate-spin" />
              </div>
            }
          >
            <NoteMarkdownEditor value={content} onChange={setContent} autoFocus={!isNew} />
          </Suspense>
        </MarkdownEditorBoundary>
      </div>
    </>
  )
}
