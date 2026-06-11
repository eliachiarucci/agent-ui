import { useState } from "react"
import {
  BookmarkPlus,
  CheckCircle2,
  ChevronDown,
  Eraser,
  Eye,
  FilePenLine,
  FilePlus2,
  FileText,
  FolderOpen,
  Loader2,
  PenLine,
  NotebookPen,
  ScreenShare,
  Search,
  StickyNote,
  Trash2,
  Wrench,
  XCircle,
} from "lucide-react"
import type { ToolUIPart, DynamicToolUIPart } from "ai"
import { Button } from "@/components/ui/button"
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible"
import { fileToolTarget } from "@/lib/chat-files"
import { noteToolTarget } from "@/lib/chat-notes"
import { useFileViewerActions } from "@/lib/file-viewer-context"
import { cn } from "@/lib/utils"

const TOOL_META: Record<string, { icon: typeof Wrench; running: string; done: string }> = {
  remember: { icon: BookmarkPlus, running: "Saving a memory…", done: "Saved a memory" },
  updateMemory: { icon: PenLine, running: "Updating a memory…", done: "Updated a memory" },
  forget: { icon: Eraser, running: "Forgetting a memory…", done: "Forgot a memory" },
  recallMemories: { icon: Search, running: "Recalling memories…", done: "Recalled memories" },
  writeFile: { icon: FilePlus2, running: "Writing a file…", done: "Wrote a file" },
  editFile: { icon: FilePenLine, running: "Editing a file…", done: "Edited a file" },
  readFile: { icon: FileText, running: "Reading a file…", done: "Read a file" },
  listFiles: { icon: FolderOpen, running: "Listing files…", done: "Listed files" },
  presentFile: { icon: ScreenShare, running: "Opening a file…", done: "Opened a file in the viewer" },
  writeNote: { icon: NotebookPen, running: "Writing a note…", done: "Wrote a note" },
  editNote: { icon: NotebookPen, running: "Editing a note…", done: "Edited a note" },
  readNote: { icon: StickyNote, running: "Reading a note…", done: "Read a note" },
  listNotes: { icon: StickyNote, running: "Listing notes…", done: "Listed notes" },
  deleteNote: { icon: Trash2, running: "Deleting a note…", done: "Deleted a note" },
}

function JsonBlock({ label, value }: { label: string; value: unknown }) {
  if (value === undefined) return null
  return (
    <div>
      <div className="mb-1 text-[10px] font-semibold tracking-wide text-muted-foreground uppercase">
        {label}
      </div>
      <pre className="overflow-x-auto rounded-md bg-muted p-2 font-mono text-xs whitespace-pre-wrap">
        {JSON.stringify(value, null, 2)}
      </pre>
    </div>
  )
}

export function ToolPart({ part, toolName }: { part: ToolUIPart | DynamicToolUIPart; toolName: string }) {
  const [open, setOpen] = useState(false)
  const viewer = useFileViewerActions()
  const meta = TOOL_META[toolName] ?? { icon: Wrench, running: `Running ${toolName}…`, done: toolName }
  const Icon = meta.icon

  const running = part.state === "input-streaming" || part.state === "input-available"
  const failed = part.state === "output-error"
  // File-tool calls that completed on a real file get a shortcut into the
  // viewer; note-tool calls one into the note editor popup.
  const viewableFile = viewer ? fileToolTarget(part) : null
  const viewableNote = viewer ? noteToolTarget(part) : null

  return (
    <Collapsible open={open} onOpenChange={setOpen}>
      <div className="flex items-center gap-1">
        <CollapsibleTrigger
          className={cn(
            "flex items-center gap-1.5 rounded-md border px-2 py-1 text-xs font-medium transition-colors",
            failed
              ? "border-destructive/40 text-destructive hover:bg-destructive/10"
              : "text-muted-foreground hover:bg-muted hover:text-foreground"
          )}
        >
          {running ? (
            <Loader2 className="size-3.5 animate-spin" />
          ) : failed ? (
            <XCircle className="size-3.5" />
          ) : (
            <Icon className="size-3.5" />
          )}
          {running ? meta.running : failed ? `${toolName} failed` : meta.done}
          {!running && part.state === "output-available" && (
            <CheckCircle2 className="size-3 text-emerald-500" />
          )}
          <ChevronDown className={cn("size-3.5 transition-transform", open && "rotate-180")} />
        </CollapsibleTrigger>
        {viewableFile && (
          <Button
            variant="ghost"
            size="xs"
            className="text-muted-foreground"
            aria-label={`View ${viewableFile}`}
            onClick={() => viewer?.viewFile(viewableFile)}
          >
            <Eye className="size-3.5" />
            View
          </Button>
        )}
        {viewableNote && (
          <Button
            variant="ghost"
            size="xs"
            className="text-muted-foreground"
            aria-label={`View note ${viewableNote}`}
            onClick={() => viewer?.viewNote(viewableNote)}
          >
            <Eye className="size-3.5" />
            View
          </Button>
        )}
      </div>
      <CollapsibleContent>
        <div className="mt-1.5 space-y-2 border-l-2 border-muted pl-3">
          <JsonBlock label="Input" value={part.input} />
          {part.state === "output-available" && <JsonBlock label="Result" value={part.output} />}
          {part.state === "output-error" && (
            <p className="text-xs text-destructive">{part.errorText}</p>
          )}
        </div>
      </CollapsibleContent>
    </Collapsible>
  )
}
