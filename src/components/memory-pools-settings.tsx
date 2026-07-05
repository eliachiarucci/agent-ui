import { useCallback, useEffect, useState } from "react"
import { Brain, Plus, Trash2 } from "lucide-react"
import { toast } from "sonner"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Separator } from "@/components/ui/separator"
import { Skeleton } from "@/components/ui/skeleton"
import { MemoryDialog } from "@/components/memory/memory-dialog"
import {
  createMemoryPool,
  deleteMemoryPool,
  listMemoryPools,
  type MemoryPool,
} from "@/lib/api"

// Settings → Memory: the user's memory pools. Pools are named memory stores
// decoupled from agents — attach one to an agent (Settings → Agent) to give it
// that memory; several agents on the same pool share every memory.
export function MemoryPoolsSettings({
  onPoolsChanged,
}: {
  // Called after a pool is deleted so the agent list (attachments) refreshes.
  onPoolsChanged?: () => void
}) {
  const [pools, setPools] = useState<MemoryPool[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedId, setSelectedId] = useState<string | undefined>(undefined)
  const [newName, setNewName] = useState("")
  const [creating, setCreating] = useState(false)
  const [memoriesOpen, setMemoriesOpen] = useState(false)

  const load = useCallback(async () => {
    try {
      const list = await listMemoryPools()
      setPools(list)
      setSelectedId((current) =>
        current && list.some((p) => p.id === current) ? current : list[0]?.id
      )
    } catch (error) {
      toast.error("Failed to load memory pools", {
        description: error instanceof Error ? error.message : undefined,
      })
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  const selected = pools.find((p) => p.id === selectedId)

  const submitNewPool = async () => {
    const name = newName.trim()
    if (!name || creating) return
    setCreating(true)
    try {
      const pool = await createMemoryPool(name)
      setPools((prev) => [...prev, pool])
      setSelectedId(pool.id)
      setNewName("")
      toast.success(`Memory pool "${pool.name}" created`)
    } catch (error) {
      toast.error("Failed to create memory pool", {
        description: error instanceof Error ? error.message : undefined,
      })
    } finally {
      setCreating(false)
    }
  }

  const confirmDelete = async () => {
    if (!selected) return
    try {
      await deleteMemoryPool(selected.id)
      setPools((prev) => {
        const remaining = prev.filter((p) => p.id !== selected.id)
        setSelectedId(remaining[0]?.id)
        return remaining
      })
      toast.success(`Memory pool "${selected.name}" deleted`)
      onPoolsChanged?.()
    } catch (error) {
      toast.error("Failed to delete memory pool", {
        description: error instanceof Error ? error.message : undefined,
      })
    }
  }

  if (loading) {
    return (
      <div className="grid gap-3">
        <Skeleton className="h-9 w-full" />
        <Skeleton className="h-24 w-full" />
      </div>
    )
  }

  return (
    <div className="grid gap-4">
      <div className="grid gap-2">
        <Label htmlFor="memory-pool">Memory pool</Label>
        <Select value={selectedId ?? ""} onValueChange={setSelectedId}>
          <SelectTrigger id="memory-pool" className="w-full">
            <Brain className="size-4 shrink-0 text-muted-foreground" />
            <SelectValue placeholder="Select a memory pool" />
          </SelectTrigger>
          <SelectContent>
            {pools.map((pool) => (
              <SelectItem key={pool.id} value={pool.id}>
                {pool.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <p className="text-xs text-muted-foreground">
          Pools are named memory stores, independent of agents. Attach one to an agent
          in Settings → Agent; agents attached to the same pool share every memory.
        </p>
      </div>

      {selected && (
        <>
          <Separator />

          <div className="grid gap-2">
            <Label>“{selected.name}”</Label>
            <p className="text-sm text-muted-foreground">
              {selected.memoryCount} memor{selected.memoryCount === 1 ? "y" : "ies"}
              {selected.agents.length > 0
                ? ` · used by ${selected.agents.map((a) => a.name).join(", ")}`
                : " · not attached to any agent"}
            </p>
            <div className="flex flex-wrap gap-2">
              <Button
                variant="outline"
                className="gap-2"
                onClick={() => setMemoriesOpen(true)}
              >
                <Brain className="size-4" />
                Open memories
              </Button>
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button
                    variant="outline"
                    className="gap-2 text-destructive hover:text-destructive"
                  >
                    <Trash2 className="size-4" />
                    Delete pool
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>Delete “{selected.name}”?</AlertDialogTitle>
                    <AlertDialogDescription>
                      This permanently deletes the pool and
                      {selected.memoryCount === 1
                        ? " its 1 memory"
                        : ` all of its ${selected.memoryCount} memories`}
                      .
                      {selected.agents.length > 0 &&
                        ` The agents using it (${selected.agents
                          .map((a) => a.name)
                          .join(", ")}) lose their memory until another pool is attached.`}{" "}
                      This cannot be undone.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Cancel</AlertDialogCancel>
                    <AlertDialogAction
                      variant="destructive"
                      onClick={() => void confirmDelete()}
                    >
                      Delete pool
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            </div>
          </div>
        </>
      )}

      <Separator />

      <div className="grid gap-2">
        <Label htmlFor="new-pool-name">New memory pool</Label>
        <div className="flex gap-2">
          <Input
            id="new-pool-name"
            value={newName}
            placeholder="Pool name (e.g. Family)"
            onChange={(e) => setNewName(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault()
                void submitNewPool()
              }
            }}
          />
          <Button
            className="gap-1"
            disabled={!newName.trim() || creating}
            onClick={() => void submitNewPool()}
          >
            <Plus className="size-4" />
            Create
          </Button>
        </div>
        <p className="text-xs text-muted-foreground">
          A new pool starts empty. Attach it to an agent to start filling it.
        </p>
      </div>

      {/* Keyed so the list reloads when switching pools between opens. */}
      {selected && (
        <MemoryDialog
          key={selected.id}
          open={memoriesOpen}
          onOpenChange={(open) => {
            setMemoriesOpen(open)
            // Counts may have changed after manual edits/deletes.
            if (!open) void load()
          }}
          poolId={selected.id}
          poolName={selected.name}
        />
      )}
    </div>
  )
}
