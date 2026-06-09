import { useState } from "react"
import { BrainCircuit, ChevronDown, Loader2 } from "lucide-react"
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible"
import { cn } from "@/lib/utils"

type ReasoningPartProps = {
  text: string
  streaming: boolean
}

export function ReasoningPart({ text, streaming }: ReasoningPartProps) {
  // Collapsed by default; the trigger still shows a live "Thinking…" indicator while streaming.
  const [open, setOpen] = useState(false)

  if (!text.trim() && !streaming) return null

  return (
    <Collapsible open={open} onOpenChange={setOpen}>
      <CollapsibleTrigger className="flex items-center gap-1.5 rounded-md px-2 py-1 text-xs font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground">
        {streaming ? (
          <Loader2 className="size-3.5 animate-spin" />
        ) : (
          <BrainCircuit className="size-3.5" />
        )}
        {streaming ? "Thinking…" : "Thought process"}
        <ChevronDown className={cn("size-3.5 transition-transform", open && "rotate-180")} />
      </CollapsibleTrigger>
      <CollapsibleContent>
        <div className="mt-1 border-l-2 border-muted pl-3 text-xs leading-relaxed whitespace-pre-wrap text-muted-foreground italic">
          {text}
        </div>
      </CollapsibleContent>
    </Collapsible>
  )
}
