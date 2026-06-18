import { useEffect, useState } from "react"
import { toast } from "sonner"
import {
  getMemoryConversation,
  listMemoryConversations,
  type MemoryConversationDetail,
  type MemoryConversationSummary,
} from "@/lib/api"

// The list of memory conversations, fetched whenever `enabled` turns true (i.e.
// when the user opens the memory-conversations view).
export function useMemoryConversationList(enabled: boolean) {
  const [conversations, setConversations] = useState<MemoryConversationSummary[]>([])
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (!enabled) return
    let cancelled = false
    setLoading(true)
    listMemoryConversations()
      .then((list) => {
        if (!cancelled) setConversations(list)
      })
      .catch((error: unknown) => {
        if (!cancelled)
          toast.error("Failed to load memory conversations", {
            description: error instanceof Error ? error.message : undefined,
          })
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [enabled])

  return { conversations, loading }
}

// One memory conversation's messages, fetched when an id is selected.
export function useMemoryConversation(id: string | null) {
  const [detail, setDetail] = useState<MemoryConversationDetail | null>(null)
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (!id) {
      setDetail(null)
      return
    }
    let cancelled = false
    setLoading(true)
    setDetail(null)
    getMemoryConversation(id)
      .then((value) => {
        if (!cancelled) setDetail(value)
      })
      .catch((error: unknown) => {
        if (!cancelled)
          toast.error("Failed to load memory conversation", {
            description: error instanceof Error ? error.message : undefined,
          })
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [id])

  return { detail, loading }
}
