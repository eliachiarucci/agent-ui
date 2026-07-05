import { useEffect, useMemo, useState } from "react"
import { ArrowLeft, Brain, MessagesSquare, Pin, Plus, Search } from "lucide-react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
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
import {
  useMemoryConversation,
  useMemoryConversationList,
} from "@/hooks/use-memory-conversations"
import type {
  Memory,
  MemoryCategory,
  MemoryConversationMessage,
  MemoryInput,
} from "@/lib/api"

type MemoryDialogProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  // Browse a specific memory pool (Settings → Memory) instead of the default
  // agent's attached pool. Pool mode hides the extractor's conversation log,
  // which is agent-scoped, not pool-scoped.
  poolId?: string
  // Shown under the title in pool mode.
  poolName?: string
}

type View = "memories" | "conversations" | "conversation"

export function MemoryDialog({ open, onOpenChange, poolId, poolName }: MemoryDialogProps) {
  const { memories, loading, query, setQuery, create, update, remove } = useMemories(
    open,
    poolId
  )
  const [editing, setEditing] = useState<Memory | null>(null)
  const [creating, setCreating] = useState(false)
  const [pendingDelete, setPendingDelete] = useState<Memory | null>(null)
  const [category, setCategory] = useState<MemoryCategory | "all">("all")
  const [view, setView] = useState<View>("memories")
  const [selectedId, setSelectedId] = useState<string | null>(null)

  // Reopening always lands on the memory list.
  useEffect(() => {
    if (open) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- intentional: reset view on open
      setView("memories")
      setSelectedId(null)
    }
  }, [open])

  // Chips are built from the categories actually present in the loaded
  // memories; the active filter stays listed even when a search empties it,
  // so it can always be deselected.
  const categories = useMemo(() => {
    const present = new Set(memories.map((m) => m.category))
    if (category !== "all") present.add(category)
    return [...present].sort()
  }, [memories, category])

  const { pinned, byCategory, visibleCount } = useMemo(() => {
    const visible = category === "all" ? memories : memories.filter((m) => m.category === category)
    const pinned = visible.filter((m) => m.pinned)
    const rest = visible.filter((m) => !m.pinned)
    const byCategory = new Map<string, Memory[]>()
    for (const m of rest) {
      const list = byCategory.get(m.category) ?? []
      list.push(m)
      byCategory.set(m.category, list)
    }
    return {
      pinned,
      byCategory: [...byCategory.entries()].sort(([a], [b]) => a.localeCompare(b)),
      visibleCount: visible.length,
    }
  }, [memories, category])

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
        {/* Fixed height so the dialog doesn't resize as views/search/filters change. */}
        <DialogContent className="flex h-[min(85vh,44rem)] flex-col sm:max-w-2xl">
          {view === "memories" ? (
            <>
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2">
                  <Brain className="size-5" />
                  {poolName ? `Memories — ${poolName}` : "Memories"}
                </DialogTitle>
                <DialogDescription>
                  {poolId
                    ? "Everything stored in this memory pool. Edit anything by hand."
                    : "Everything the agent remembers about you. Edit anything by hand."}
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

              {!poolId && (
                <Button
                  variant="outline"
                  size="sm"
                  className="justify-start gap-2"
                  onClick={() => setView("conversations")}
                >
                  <MessagesSquare className="size-4" />
                  View memory conversations
                </Button>
              )}

              {categories.length > 0 && (
                <div className="flex flex-wrap gap-1.5">
                  <Button
                    size="xs"
                    variant={category === "all" ? "default" : "outline"}
                    className="rounded-full"
                    onClick={() => setCategory("all")}
                  >
                    All
                  </Button>
                  {categories.map((c) => (
                    <Button
                      key={c}
                      size="xs"
                      variant={category === c ? "default" : "outline"}
                      className="rounded-full capitalize"
                      onClick={() => setCategory(category === c ? "all" : c)}
                    >
                      {c}
                    </Button>
                  ))}
                </div>
              )}

              {/* Plain overflow div: Radix ScrollArea's display:table viewport doesn't
                  constrain height inside the flex dialog, so it never scrolls. */}
              <div className="min-h-0 flex-1 overflow-y-auto pr-1">
                <div className="flex flex-col gap-4 py-1">
                  {loading && (
                    <div className="flex flex-col gap-2">
                      {Array.from({ length: 4 }, (_, i) => (
                        <Skeleton key={i} className="h-20 w-full" />
                      ))}
                    </div>
                  )}

                  {!loading && visibleCount === 0 && (
                    <p className="py-10 text-center text-sm text-muted-foreground">
                      {query || category !== "all"
                        ? "No memories match your filters."
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
              </div>
            </>
          ) : view === "conversations" ? (
            <MemoryConversationsView
              onBack={() => setView("memories")}
              onOpen={(id) => {
                setSelectedId(id)
                setView("conversation")
              }}
            />
          ) : (
            <MemoryConversationView id={selectedId} onBack={() => setView("conversations")} />
          )}
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

// The list of memory conversations (one per chat the extractor reviewed).
function MemoryConversationsView({
  onBack,
  onOpen,
}: {
  onBack: () => void
  onOpen: (id: string) => void
}) {
  const { conversations, loading } = useMemoryConversationList(true)

  return (
    <>
      <DialogHeader>
        <div className="flex items-center gap-2">
          <Button
            variant="ghost"
            size="icon"
            aria-label="Back to memories"
            className="-ml-2 shrink-0"
            onClick={onBack}
          >
            <ArrowLeft className="size-4" />
          </Button>
          <DialogTitle className="flex items-center gap-2">
            <MessagesSquare className="size-5" />
            Memory conversations
          </DialogTitle>
        </div>
        <DialogDescription>
          What the agent reviewed after each chat to decide what to remember. Read-only.
        </DialogDescription>
      </DialogHeader>

      <div className="min-h-0 flex-1 overflow-y-auto pr-1">
        <div className="flex flex-col gap-2 py-1">
          {loading && (
            <div className="flex flex-col gap-2">
              {Array.from({ length: 4 }, (_, i) => (
                <Skeleton key={i} className="h-14 w-full" />
              ))}
            </div>
          )}

          {!loading && conversations.length === 0 && (
            <p className="py-10 text-center text-sm text-muted-foreground">
              No memory conversations yet. They appear here as you chat with your agent.
            </p>
          )}

          {!loading &&
            conversations.map((c) => (
              <button
                key={c.id}
                type="button"
                className="flex flex-col gap-1 rounded-md border px-3 py-2 text-left hover:bg-accent/60"
                onClick={() => onOpen(c.id)}
              >
                <p className="truncate text-sm">{c.preview || "(empty)"}</p>
                <p className="text-xs text-muted-foreground">
                  {c.exchangeCount} exchange{c.exchangeCount === 1 ? "" : "s"} · updated{" "}
                  {new Date(c.updatedAt).toLocaleString([], {
                    dateStyle: "medium",
                    timeStyle: "short",
                  })}
                </p>
              </button>
            ))}
        </div>
      </div>
    </>
  )
}

// One memory conversation's messages, read-only.
function MemoryConversationView({ id, onBack }: { id: string | null; onBack: () => void }) {
  const { detail, loading } = useMemoryConversation(id)

  return (
    <>
      <DialogHeader>
        <div className="flex items-center gap-2">
          <Button
            variant="ghost"
            size="icon"
            aria-label="Back to memory conversations"
            className="-ml-2 shrink-0"
            onClick={onBack}
          >
            <ArrowLeft className="size-4" />
          </Button>
          <DialogTitle>Memory conversation</DialogTitle>
        </div>
        <DialogDescription>
          The exchanges the agent reviewed and the memory changes it made. Read-only.
        </DialogDescription>
      </DialogHeader>

      <div className="min-h-0 flex-1 overflow-y-auto pr-1">
        <div className="flex flex-col gap-3 py-1">
          {loading && (
            <div className="flex flex-col gap-2">
              {Array.from({ length: 3 }, (_, i) => (
                <Skeleton key={i} className="h-16 w-full" />
              ))}
            </div>
          )}

          {!loading && detail && detail.messages.length === 0 && (
            <p className="py-10 text-center text-sm text-muted-foreground">
              This memory conversation is empty.
            </p>
          )}

          {!loading &&
            detail?.messages.map((m, i) => <MemoryMessage key={i} message={m} />)}
        </div>
      </div>
    </>
  )
}

function stringify(value: unknown): string {
  if (typeof value === "string") return value
  try {
    return JSON.stringify(value, null, 2)
  } catch {
    return String(value)
  }
}

function MemoryMessage({ message }: { message: MemoryConversationMessage }) {
  if (message.role === "user") {
    return (
      <div className="rounded-md border bg-muted/40 px-3 py-2">
        <p className="mb-1 text-xs font-semibold tracking-wide text-muted-foreground uppercase">
          Exchange
        </p>
        <p className="whitespace-pre-wrap text-sm">{message.text}</p>
      </div>
    )
  }

  if (message.role === "tool") {
    if (!message.toolResults?.length) return null
    return (
      <div className="flex flex-col gap-1 pl-3">
        {message.toolResults.map((r, i) => (
          <p key={i} className="truncate text-xs text-muted-foreground">
            → {r.toolName}: {stringify(r.output)}
          </p>
        ))}
      </div>
    )
  }

  // assistant
  return (
    <div className="flex flex-col gap-2">
      {message.text && <p className="whitespace-pre-wrap text-sm">{message.text}</p>}
      {message.toolCalls?.map((c, i) => (
        <div key={i} className="rounded-md border border-dashed px-3 py-2">
          <p className="flex items-center gap-1.5 text-xs font-medium">
            <Brain className="size-3.5" />
            {c.toolName}
          </p>
          <pre className="mt-1 overflow-x-auto text-xs whitespace-pre-wrap text-muted-foreground">
            {stringify(c.input)}
          </pre>
        </div>
      ))}
    </div>
  )
}
