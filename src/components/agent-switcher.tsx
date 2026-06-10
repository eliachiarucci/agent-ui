import { Bot } from "lucide-react"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import type { Agent } from "@/lib/api"
import { cn } from "@/lib/utils"

type AgentSwitcherProps = {
  agents: Agent[]
  activeAgentId?: string
  onSelect: (id: string) => void
  className?: string
}

// Used in the sidebar header and the settings dialog; both control the same
// selection. Switching agents swaps the whole workspace: conversations,
// memories, and who has access.
export function AgentSwitcher({ agents, activeAgentId, onSelect, className }: AgentSwitcherProps) {
  return (
    <Select value={activeAgentId ?? ""} onValueChange={onSelect} disabled={agents.length === 0}>
      <SelectTrigger className={cn("gap-2", className)} aria-label="Switch agent">
        <Bot className="size-4 shrink-0 text-sidebar-primary" />
        <SelectValue placeholder="No agents" />
      </SelectTrigger>
      <SelectContent>
        {agents.map((agent) => (
          <SelectItem key={agent.id} value={agent.id}>
            {agent.name}
            {agent.role === "member" && (
              <span className="ml-1 text-xs text-muted-foreground">(shared with you)</span>
            )}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  )
}
