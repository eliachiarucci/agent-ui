import { Component, lazy, Suspense, useEffect, useRef, useState, type ReactNode } from "react"
import { Loader2 } from "lucide-react"
import { toast } from "sonner"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
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

export type NoteUpdate = (
  id: string,
  changes: { title?: string; content?: string },
  opts?: { silent?: boolean }
) => Promise<Note | null>

const AUTOSAVE_DELAY_MS = 800
// How long sync may keep failing silently before the user is told.
const SYNC_ERROR_AFTER_MS = 5000

type NoteEditorPaneProps = {
  note: Note
  isNew: boolean
  onUpdate: NoteUpdate
}

// One note, always editable: changes autosave in the background after a short
// pause in typing (and flush when the editor closes), so there is no save
// button or status text. Failed saves retry automatically; only a failure that
// persists past SYNC_ERROR_AFTER_MS surfaces as a toast. A blank title is
// never saved — the last saved title stands until it's fixed.
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

type NoteEditorDialogProps = {
  // null keeps the dialog closed; notes always open straight into edit mode.
  note: Note | null
  isNew?: boolean
  onOpenChange: (open: boolean) => void
  onUpdate: NoteUpdate
}

// The note editor popup. Used by the Notes dialog (stacked on top of the list)
// and standalone by the chat's note tool chips ("View" opens the note here
// without going through the list).
export function NoteEditorDialog({ note, isNew = false, onOpenChange, onUpdate }: NoteEditorDialogProps) {
  return (
    <Dialog open={note !== null} onOpenChange={onOpenChange}>
      <DialogContent className="flex h-[min(85vh,44rem)] flex-col sm:max-w-3xl">
        {note && <NoteEditorPane key={note.id} note={note} isNew={isNew} onUpdate={onUpdate} />}
      </DialogContent>
    </Dialog>
  )
}
