import { Pencil, Pin, PinOff, Trash2 } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip"
import type { Memory } from "@/lib/api"

type MemoryCardProps = {
  memory: Memory
  onEdit: (memory: Memory) => void
  onTogglePin: (memory: Memory) => void
  onDelete: (memory: Memory) => void
}

export function MemoryCard({ memory, onEdit, onTogglePin, onDelete }: MemoryCardProps) {
  return (
    <div className="group flex items-start gap-3 rounded-lg border bg-card p-3 transition-colors hover:bg-accent/40">
      <div className="min-w-0 flex-1">
        <p className="text-sm leading-snug">{memory.content}</p>
        <div className="mt-2 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
          <Badge variant="secondary" className="capitalize">
            {memory.category}
          </Badge>
          <Tooltip>
            <TooltipTrigger asChild>
              <span className="inline-flex h-1.5 w-16 overflow-hidden rounded-full bg-muted">
                <span
                  className="h-full rounded-full bg-primary"
                  style={{ width: `${Math.round(memory.importance * 100)}%` }}
                />
              </span>
            </TooltipTrigger>
            <TooltipContent>Importance: {memory.importance.toFixed(2)}</TooltipContent>
          </Tooltip>
          <span>{new Date(memory.createdAt).toLocaleDateString()}</span>
        </div>
      </div>

      <div className="flex shrink-0 gap-0.5 opacity-0 transition-opacity group-hover:opacity-100">
        <Button
          variant="ghost"
          size="icon"
          className="size-7"
          aria-label={memory.pinned ? "Unpin memory" : "Pin memory"}
          onClick={() => onTogglePin(memory)}
        >
          {memory.pinned ? <PinOff className="size-3.5" /> : <Pin className="size-3.5" />}
        </Button>
        <Button
          variant="ghost"
          size="icon"
          className="size-7"
          aria-label="Edit memory"
          onClick={() => onEdit(memory)}
        >
          <Pencil className="size-3.5" />
        </Button>
        <Button
          variant="ghost"
          size="icon"
          className="size-7 hover:text-destructive"
          aria-label="Delete memory"
          onClick={() => onDelete(memory)}
        >
          <Trash2 className="size-3.5" />
        </Button>
      </div>
    </div>
  )
}
