import { useState } from "react"
import {
  BookmarkPlus,
  CheckCircle2,
  ChevronDown,
  Eraser,
  Loader2,
  PenLine,
  Search,
  Wrench,
  XCircle,
} from "lucide-react"
import type { ToolUIPart, DynamicToolUIPart } from "ai"
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible"
import { cn } from "@/lib/utils"

const TOOL_META: Record<string, { icon: typeof Wrench; running: string; done: string }> = {
  remember: { icon: BookmarkPlus, running: "Saving a memory…", done: "Saved a memory" },
  updateMemory: { icon: PenLine, running: "Updating a memory…", done: "Updated a memory" },
  forget: { icon: Eraser, running: "Forgetting a memory…", done: "Forgot a memory" },
  recallMemories: { icon: Search, running: "Recalling memories…", done: "Recalled memories" },
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
  const meta = TOOL_META[toolName] ?? { icon: Wrench, running: `Running ${toolName}…`, done: toolName }
  const Icon = meta.icon

  const running = part.state === "input-streaming" || part.state === "input-available"
  const failed = part.state === "output-error"

  return (
    <Collapsible open={open} onOpenChange={setOpen}>
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
