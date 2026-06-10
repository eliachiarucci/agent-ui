import { useCallback, useEffect, useState } from "react"
import { toast } from "sonner"
import { createAgent, listAgents, type Agent } from "@/lib/api"

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
        // Drop a stale stored selection (deleted agent) and default to the first agent.
        setActiveAgentId((current) =>
          current && list.some((a) => a.id === current) ? current : list[0]?.id
        )
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

  const activeAgent = agents.find((a) => a.id === activeAgentId)

  return { agents, activeAgent, activeAgentId, selectAgent, create }
}
