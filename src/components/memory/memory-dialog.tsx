import { useMemo, useState } from "react"
import { Brain, Pin, Plus, Search } from "lucide-react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Separator } from "@/components/ui/separator"
import { Skeleton } from "@/components/ui/skeleton"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
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
import { MemoryCard } from "@/components/memory/memory-card"
import { MemoryForm } from "@/components/memory/memory-form"
import { useMemories } from "@/hooks/use-memories"
import type { Memory, MemoryInput } from "@/lib/api"

type MemoryDialogProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function MemoryDialog({ open, onOpenChange }: MemoryDialogProps) {
  const { memories, loading, query, setQuery, create, update, remove } = useMemories(open)
  const [editing, setEditing] = useState<Memory | null>(null)
  const [creating, setCreating] = useState(false)
  const [pendingDelete, setPendingDelete] = useState<Memory | null>(null)

  const { pinned, byCategory } = useMemo(() => {
    const pinned = memories.filter((m) => m.pinned)
    const rest = memories.filter((m) => !m.pinned)
    const byCategory = new Map<string, Memory[]>()
    for (const m of rest) {
      const list = byCategory.get(m.category) ?? []
      list.push(m)
      byCategory.set(m.category, list)
    }
    return { pinned, byCategory: [...byCategory.entries()].sort(([a], [b]) => a.localeCompare(b)) }
  }, [memories])

  const handleError = (action: string) => (error: unknown) => {
    toast.error(`Failed to ${action} memory`, {
      description: error instanceof Error ? error.message : undefined,
    })
  }

  const togglePin = (memory: Memory) => {
    void update(memory.id, { pinned: !memory.pinned }).catch(handleError("update"))
  }

  const submitEdit = async (input: MemoryInput) => {
    if (!editing) return
    try {
      await update(editing.id, input)
      toast.success("Memory updated")
      setEditing(null)
    } catch (error) {
      handleError("update")(error)
    }
  }

  const submitCreate = async (input: MemoryInput) => {
    try {
      await create(input)
      setCreating(false)
    } catch (error) {
      handleError("create")(error)
    }
  }

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="flex max-h-[85vh] flex-col sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Brain className="size-5" />
              Memories
            </DialogTitle>
            <DialogDescription>
              Everything the agent remembers about you. Edit anything by hand.
            </DialogDescription>
          </DialogHeader>

          <div className="flex items-center gap-2">
            <div className="relative flex-1">
              <Search className="absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search memories…"
                className="pl-8"
              />
            </div>
            <Button size="sm" onClick={() => setCreating(true)}>
              <Plus className="size-4" />
              New
            </Button>
          </div>

          <ScrollArea className="min-h-0 flex-1 pr-3">
            <div className="flex flex-col gap-4 py-1">
              {loading && (
                <div className="flex flex-col gap-2">
                  {Array.from({ length: 4 }, (_, i) => (
                    <Skeleton key={i} className="h-20 w-full" />
                  ))}
                </div>
              )}

              {!loading && memories.length === 0 && (
                <p className="py-10 text-center text-sm text-muted-foreground">
                  {query
                    ? "No memories match your search."
                    : "No memories yet. Chat with your agent or add one by hand."}
                </p>
              )}

              {!loading && pinned.length > 0 && (
                <section>
                  <h3 className="mb-2 flex items-center gap-1.5 text-xs font-semibold tracking-wide text-muted-foreground uppercase">
                    <Pin className="size-3.5" />
                    Pinned
                  </h3>
                  <div className="flex flex-col gap-2">
                    {pinned.map((m) => (
                      <MemoryCard
                        key={m.id}
                        memory={m}
                        onEdit={setEditing}
                        onTogglePin={togglePin}
                        onDelete={setPendingDelete}
                      />
                    ))}
                  </div>
                </section>
              )}

              {!loading && pinned.length > 0 && byCategory.length > 0 && <Separator />}

              {!loading &&
                byCategory.map(([category, items]) => (
                  <section key={category}>
                    <h3 className="mb-2 text-xs font-semibold tracking-wide text-muted-foreground uppercase">
                      {category}
                    </h3>
                    <div className="flex flex-col gap-2">
                      {items.map((m) => (
                        <MemoryCard
                          key={m.id}
                          memory={m}
                          onEdit={setEditing}
                          onTogglePin={togglePin}
                          onDelete={setPendingDelete}
                        />
                      ))}
                    </div>
                  </section>
                ))}
            </div>
          </ScrollArea>
        </DialogContent>
      </Dialog>

      <Dialog open={creating} onOpenChange={setCreating}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>New memory</DialogTitle>
            <DialogDescription>Add something the agent should remember.</DialogDescription>
          </DialogHeader>
          <MemoryForm submitLabel="Create memory" onSubmit={submitCreate} />
        </DialogContent>
      </Dialog>

      <Dialog open={editing !== null} onOpenChange={(o) => !o && setEditing(null)}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Edit memory</DialogTitle>
            <DialogDescription>Changing the content re-indexes the memory.</DialogDescription>
          </DialogHeader>
          {editing && (
            <MemoryForm
              initial={{
                content: editing.content,
                category: editing.category,
                importance: editing.importance,
                pinned: editing.pinned,
              }}
              submitLabel="Save changes"
              onSubmit={submitEdit}
            />
          )}
        </DialogContent>
      </Dialog>

      <AlertDialog
        open={pendingDelete !== null}
        onOpenChange={(o) => !o && setPendingDelete(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete memory?</AlertDialogTitle>
            <AlertDialogDescription>"{pendingDelete?.content}"</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                if (pendingDelete) void remove(pendingDelete.id).catch(handleError("delete"))
                setPendingDelete(null)
              }}
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}
