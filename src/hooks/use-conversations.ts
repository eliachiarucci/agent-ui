import { useCallback, useEffect, useState } from "react"
import { toast } from "sonner"
import {
  deleteConversation,
  listConversations,
  setConversationArchived,
  type Conversation,
} from "@/lib/api"

// Scoped to the active agent; waits until the agent list has loaded (agentId
// defined) before fetching. `showArchived` flips the list between the normal
// view and the archived one (the backend filters server-side).
export function useConversations(agentId?: string) {
  const [conversations, setConversations] = useState<Conversation[]>([])
  const [loading, setLoading] = useState(true)
  const [showArchived, setShowArchived] = useState(false)

  const refresh = useCallback(async () => {
    if (!agentId) return
    try {
      const list = await listConversations(agentId, showArchived ? true : undefined)
      list.sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime())
      setConversations(list)
    } catch (error) {
      toast.error("Failed to load conversations", {
        description: error instanceof Error ? error.message : undefined,
      })
    } finally {
      setLoading(false)
    }
  }, [agentId, showArchived])

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- intentional fetch-on-mount; state updates happen after the request resolves
    void refresh()
  }, [refresh])

  // Optimistic insert for a just-started chat: shows it in the sidebar the
  // moment the first message is sent; the next refresh (onFinish) replaces it
  // with the real server row, which shares the same client-generated id.
  const add = useCallback((conversation: Conversation) => {
    setConversations((prev) =>
      prev.some((c) => c.id === conversation.id) ? prev : [conversation, ...prev]
    )
  }, [])

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

  // Archive/unarchive. Either direction removes the row from the current view
  // (the conversation now belongs to the other list).
  const archive = useCallback(async (id: string, archived: boolean) => {
    try {
      await setConversationArchived(id, archived)
      setConversations((prev) => prev.filter((c) => c.id !== id))
    } catch (error) {
      toast.error(archived ? "Failed to archive conversation" : "Failed to unarchive conversation", {
        description: error instanceof Error ? error.message : undefined,
      })
    }
  }, [])

  return { conversations, loading, refresh, add, remove, archive, showArchived, setShowArchived }
}
