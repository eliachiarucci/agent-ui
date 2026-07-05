import { useCallback, useEffect, useRef, useState } from "react"
import { toast } from "sonner"
import {
  createMemory,
  deleteMemory,
  listMemories,
  updateMemory,
  type Memory,
  type MemoryInput,
} from "@/lib/api"

// Without poolId the backend scopes to the default agent's attached pool (the
// sidebar Memories dialog); with it, to that pool directly (Settings → Memory).
export function useMemories(active: boolean, poolId?: string) {
  const [memories, setMemories] = useState<Memory[]>([])
  const [loading, setLoading] = useState(false)
  const [query, setQuery] = useState("")
  const debounceRef = useRef<ReturnType<typeof setTimeout>>(undefined)

  const load = useCallback(
    async (q: string) => {
      setLoading(true)
      try {
        const list = await listMemories(
          q.trim() ? { q: q.trim(), limit: 50, poolId } : { limit: 200, poolId }
        )
        setMemories(list)
      } catch (error) {
        toast.error("Failed to load memories", {
          description: error instanceof Error ? error.message : undefined,
        })
      } finally {
        setLoading(false)
      }
    },
    [poolId]
  )

  useEffect(() => {
    if (!active) return
    clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(() => void load(query), query ? 300 : 0)
    return () => clearTimeout(debounceRef.current)
  }, [active, query, load])

  const create = useCallback(
    async (input: MemoryInput) => {
      await createMemory(input, poolId)
      toast.success("Memory saved")
      void load(query)
    },
    [load, query, poolId]
  )

  const update = useCallback(
    async (id: string, input: Partial<MemoryInput>) => {
      const updated = await updateMemory(id, input, poolId)
      setMemories((prev) => prev.map((m) => (m.id === id ? updated : m)))
    },
    [poolId]
  )

  const remove = useCallback(
    async (id: string) => {
      await deleteMemory(id, poolId)
      setMemories((prev) => prev.filter((m) => m.id !== id))
      toast.success("Memory deleted")
    },
    [poolId]
  )

  return { memories, loading, query, setQuery, create, update, remove }
}
