import { useState } from "react"
import { Plus } from "lucide-react"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Separator } from "@/components/ui/separator"
import { AgentSwitcher } from "@/components/agent-switcher"
import { AccountSettings } from "@/components/auth/account-settings"
import type { Agent } from "@/lib/api"

type SettingsDialogProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  agents: Agent[]
  activeAgentId?: string
  onSelectAgent: (id: string) => void
  // Creates the agent and switches to it; resolves once it is active.
  onCreateAgent: (name: string) => Promise<boolean>
}

// Agent switching/creation for now; more settings will land here later.
export function SettingsDialog({
  open,
  onOpenChange,
  agents,
  activeAgentId,
  onSelectAgent,
  onCreateAgent,
}: SettingsDialogProps) {
  const [newName, setNewName] = useState("")
  const [creating, setCreating] = useState(false)

  const submitNewAgent = async () => {
    const name = newName.trim()
    if (!name || creating) return
    setCreating(true)
    const created = await onCreateAgent(name)
    setCreating(false)
    if (created) setNewName("")
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[85dvh] overflow-y-auto sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Settings</DialogTitle>
          <DialogDescription>Configure your workspace.</DialogDescription>
        </DialogHeader>

        <div className="grid gap-2">
          <Label htmlFor="settings-agent">Agent</Label>
          <AgentSwitcher
            agents={agents}
            activeAgentId={activeAgentId}
            onSelect={onSelectAgent}
            className="w-full"
          />
          <p className="text-xs text-muted-foreground">
            Each agent has its own conversations and memories. Agents shared with you give
            every member access to the same memory.
          </p>
        </div>

        <Separator />

        <div className="grid gap-2">
          <Label htmlFor="new-agent-name">New agent</Label>
          <div className="flex gap-2">
            <Input
              id="new-agent-name"
              value={newName}
              placeholder="Agent name (e.g. House Renovation)"
              onChange={(e) => setNewName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault()
                  void submitNewAgent()
                }
              }}
            />
            <Button
              className="gap-1"
              disabled={!newName.trim() || creating}
              onClick={() => void submitNewAgent()}
            >
              <Plus className="size-4" />
              Create
            </Button>
          </div>
          <p className="text-xs text-muted-foreground">
            A new agent starts with an empty memory and becomes the active agent.
          </p>
        </div>

        <Separator />

        <AccountSettings />
      </DialogContent>
    </Dialog>
  )
}
