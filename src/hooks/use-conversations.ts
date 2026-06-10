import { useCallback, useEffect, useState } from "react"
import { toast } from "sonner"
import { deleteConversation, listConversations, type Conversation } from "@/lib/api"

// Scoped to the active agent; waits until the agent list has loaded (agentId
// defined) before fetching.
export function useConversations(agentId?: string) {
  const [conversations, setConversations] = useState<Conversation[]>([])
  const [loading, setLoading] = useState(true)

  const refresh = useCallback(async () => {
    if (!agentId) return
    try {
      const list = await listConversations(agentId)
      list.sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime())
      setConversations(list)
    } catch (error) {
      toast.error("Failed to load conversations", {
        description: error instanceof Error ? error.message : undefined,
      })
    } finally {
      setLoading(false)
    }
  }, [agentId])

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- intentional fetch-on-mount; state updates happen after the request resolves
    void refresh()
  }, [refresh])

  const remove = useCallback(async (id: string) => {
    try {
      await deleteConversation(id)
      setConversations((prev) => prev.filter((c) => c.id !== id))
    } catch (error) {
      toast.error("Failed to delete conversation", {
        description: error instanceof Error ? error.message : undefined,
      })
    }
  }, [])

  return { conversations, loading, refresh, remove }
}
