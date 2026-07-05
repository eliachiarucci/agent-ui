import { useCallback, useEffect, useState } from "react"
import { toast } from "sonner"
import {
  createAgent,
  deleteAgent,
  listAgents,
  updateAgent,
  type Agent,
  type ProviderType,
} from "@/lib/api"

const ACTIVE_AGENT_KEY = "agent-ui:active-agent"

export function useAgents() {
  const [agents, setAgents] = useState<Agent[]>([])
  const [activeAgentId, setActiveAgentId] = useState<string | undefined>(
    () => localStorage.getItem(ACTIVE_AGENT_KEY) ?? undefined
  )

  useEffect(() => {
    let cancelled = false
    void listAgents()
      .then((list) => {
        if (cancelled) return
        setAgents(list)
        // Drop a stale stored selection (deleted agent) and default to the
        // first agent — persisting the correction, so the stale id can't keep
        // reseeding the first render on every page load.
        setActiveAgentId((current) => {
          if (current && list.some((a) => a.id === current)) return current
          const fallback = list[0]?.id
          if (fallback) localStorage.setItem(ACTIVE_AGENT_KEY, fallback)
          else localStorage.removeItem(ACTIVE_AGENT_KEY)
          return fallback
        })
      })
      .catch((error: unknown) => {
        if (!cancelled)
          toast.error("Failed to load agents", {
            description: error instanceof Error ? error.message : undefined,
          })
      })
    return () => {
      cancelled = true
    }
  }, [])

  /** Re-fetches the agent list (e.g. after a memory-pool deletion detaches agents). */
  const refresh = useCallback(async () => {
    try {
      setAgents(await listAgents())
    } catch (error) {
      toast.error("Failed to load agents", {
        description: error instanceof Error ? error.message : undefined,
      })
    }
  }, [])

  const selectAgent = useCallback((id: string) => {
    setActiveAgentId(id)
    localStorage.setItem(ACTIVE_AGENT_KEY, id)
  }, [])

  /** Creates the agent and makes it active. Returns undefined on failure (already toasted). */
  const create = useCallback(
    async (name: string): Promise<Agent | undefined> => {
      try {
        const agent = await createAgent(name)
        setAgents((prev) => [...prev, agent])
        selectAgent(agent.id)
        return agent
      } catch (error) {
        toast.error("Failed to create agent", {
          description: error instanceof Error ? error.message : undefined,
        })
        return undefined
      }
    },
    [selectAgent]
  )

  /** Updates the agent (owner-only). Returns false on failure (already toasted). */
  const update = useCallback(
    async (
      id: string,
      changes: {
        name?: string
        systemPrompt?: string | null
        memoryPoolId?: string | null
        memoryProvider?: ProviderType | null
        memoryModel?: string | null
        chatMemoryEnabled?: boolean
        chatMemoryPrompt?: string | null
        memoryExtractionEnabled?: boolean
        memoryExtractionPrompt?: string | null
      }
    ) => {
      try {
        const updated = await updateAgent(id, changes)
        setAgents((prev) => prev.map((a) => (a.id === id ? { ...a, ...updated } : a)))
        return true
      } catch (error) {
        toast.error("Failed to update agent", {
          description: error instanceof Error ? error.message : undefined,
        })
        return false
      }
    },
    []
  )

  /**
   * Deletes the agent (owner-only; cascades to its memories and conversations).
   * If it was active, the first remaining agent becomes active.
   * Returns false on failure (already toasted).
   */
  const remove = useCallback(
    async (id: string): Promise<boolean> => {
      try {
        await deleteAgent(id)
      } catch (error) {
        toast.error("Failed to delete agent", {
          description: error instanceof Error ? error.message : undefined,
        })
        return false
      }
      const remaining = agents.filter((a) => a.id !== id)
      setAgents(remaining)
      if (activeAgentId === id) {
        if (remaining[0]) {
          selectAgent(remaining[0].id)
        } else {
          setActiveAgentId(undefined)
          localStorage.removeItem(ACTIVE_AGENT_KEY)
        }
      }
      return true
    },
    [agents, activeAgentId, selectAgent]
  )

  const activeAgent = agents.find((a) => a.id === activeAgentId)

  return { agents, activeAgent, activeAgentId, selectAgent, create, update, remove, refresh }
}
