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

export function useMemories(active: boolean) {
  const [memories, setMemories] = useState<Memory[]>([])
  const [loading, setLoading] = useState(false)
  const [query, setQuery] = useState("")
  const debounceRef = useRef<ReturnType<typeof setTimeout>>(undefined)

  const load = useCallback(async (q: string) => {
    setLoading(true)
    try {
      const list = await listMemories(q.trim() ? { q: q.trim(), limit: 50 } : { limit: 200 })
      setMemories(list)
    } catch (error) {
      toast.error("Failed to load memories", {
        description: error instanceof Error ? error.message : undefined,
      })
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    if (!active) return
    clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(() => void load(query), query ? 300 : 0)
    return () => clearTimeout(debounceRef.current)
  }, [active, query, load])

  const create = useCallback(
    async (input: MemoryInput) => {
      await createMemory(input)
      toast.success("Memory saved")
      void load(query)
    },
    [load, query]
  )

  const update = useCallback(
    async (id: string, input: Partial<MemoryInput>) => {
      const updated = await updateMemory(id, input)
      setMemories((prev) => prev.map((m) => (m.id === id ? updated : m)))
    },
    []
  )

  const remove = useCallback(async (id: string) => {
    await deleteMemory(id)
    setMemories((prev) => prev.filter((m) => m.id !== id))
    toast.success("Memory deleted")
  }, [])

  return { memories, loading, query, setQuery, create, update, remove }
}
