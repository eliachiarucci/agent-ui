import { useState } from "react"
import { Bot, Boxes, Plus, Trash2, UserRound } from "lucide-react"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
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
import { Separator } from "@/components/ui/separator"
import { Textarea } from "@/components/ui/textarea"
import { AgentSwitcher } from "@/components/agent-switcher"
import { AccountSettings } from "@/components/auth/account-settings"
import { ModelsSettings } from "@/components/models-settings"
import { cn } from "@/lib/utils"
import type { Agent } from "@/lib/api"

type SettingsDialogProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  agents: Agent[]
  activeAgentId?: string
  onSelectAgent: (id: string) => void
  // Creates the agent and switches to it; resolves once it is active.
  onCreateAgent: (name: string) => Promise<boolean>
  // Owner-only; resolves false on failure (already toasted by the hook).
  onUpdateAgent: (
    id: string,
    changes: { systemPrompt?: string | null }
  ) => Promise<boolean>
  // Owner-only; deletes the agent with all its memories and conversations.
  onDeleteAgent: (id: string) => Promise<boolean>
}

const TABS = [
  { id: "agent", label: "Agent", icon: Bot },
  { id: "models", label: "Models", icon: Boxes },
  { id: "account", label: "Account", icon: UserRound },
] as const

type TabId = (typeof TABS)[number]["id"]

export function SettingsDialog({
  open,
  onOpenChange,
  agents,
  activeAgentId,
  onSelectAgent,
  onCreateAgent,
  onUpdateAgent,
  onDeleteAgent,
}: SettingsDialogProps) {
  const [tab, setTab] = useState<TabId>("agent")

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="gap-0 overflow-hidden p-0 sm:max-w-2xl">
        <DialogHeader className="border-b p-4">
          <DialogTitle>Settings</DialogTitle>
          <DialogDescription className="sr-only">
            Configure your workspace and account.
          </DialogDescription>
        </DialogHeader>

        {/* Taller body, but clamped so the dialog always fits short viewports
            (the 8rem accounts for the header plus breathing room around the
            centered dialog). The content pane scrolls when clamped. */}
        <div className="flex max-sm:flex-col sm:h-[min(40rem,calc(100dvh-8rem))]">
          <nav
            role="tablist"
            aria-orientation="vertical"
            className="flex shrink-0 gap-1 p-2 max-sm:border-b sm:w-40 sm:flex-col sm:border-r"
          >
            {TABS.map(({ id, label, icon: Icon }) => (
              <Button
                key={id}
                role="tab"
                aria-selected={tab === id}
                variant="ghost"
                className={cn(
                  "justify-start gap-2 max-sm:flex-1",
                  tab === id
                    ? "bg-accent text-accent-foreground"
                    : "text-muted-foreground"
                )}
                onClick={() => setTab(id)}
              >
                <Icon className="size-4" />
                {label}
              </Button>
            ))}
          </nav>

          <div className="min-w-0 flex-1 overflow-y-auto p-4 max-sm:max-h-[60dvh]">
            {tab === "agent" ? (
              <AgentTab
                agents={agents}
                activeAgentId={activeAgentId}
                onSelectAgent={onSelectAgent}
                onCreateAgent={onCreateAgent}
                onUpdateAgent={onUpdateAgent}
                onDeleteAgent={onDeleteAgent}
              />
            ) : tab === "models" ? (
              <ModelsSettings />
            ) : (
              <AccountSettings />
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}

function AgentTab({
  agents,
  activeAgentId,
  onSelectAgent,
  onCreateAgent,
  onUpdateAgent,
  onDeleteAgent,
}: Pick<
  SettingsDialogProps,
  | "agents"
  | "activeAgentId"
  | "onSelectAgent"
  | "onCreateAgent"
  | "onUpdateAgent"
  | "onDeleteAgent"
>) {
  const [newName, setNewName] = useState("")
  const [creating, setCreating] = useState(false)
  const activeAgent = agents.find((a) => a.id === activeAgentId)

  const submitNewAgent = async () => {
    const name = newName.trim()
    if (!name || creating) return
    setCreating(true)
    const created = await onCreateAgent(name)
    setCreating(false)
    if (created) setNewName("")
  }

  return (
    <div className="grid gap-4">
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

      {activeAgent && (
        <>
          <Separator />
          {/* Keyed so the draft resets when the selected agent changes. */}
          <SystemPromptEditor
            key={activeAgent.id}
            agent={activeAgent}
            onUpdateAgent={onUpdateAgent}
          />
        </>
      )}

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

      {activeAgent && (
        <>
          <Separator />
          <DeleteAgentSection
            agent={activeAgent}
            lastAgent={agents.length <= 1}
            onDeleteAgent={onDeleteAgent}
          />
        </>
      )}
    </div>
  )
}

function DeleteAgentSection({
  agent,
  lastAgent,
  onDeleteAgent,
}: {
  agent: Agent
  lastAgent: boolean
  onDeleteAgent: SettingsDialogProps["onDeleteAgent"]
}) {
  const [deleting, setDeleting] = useState(false)
  const isOwner = agent.role === "owner"
  const disabled = !isOwner || lastAgent || deleting

  const confirmDelete = async () => {
    setDeleting(true)
    await onDeleteAgent(agent.id)
    setDeleting(false)
  }

  return (
    <div className="grid gap-2">
      <Label>Delete agent</Label>
      <p className="text-xs text-muted-foreground">
        {!isOwner
          ? "Only the agent's owner can delete it."
          : lastAgent
            ? "You can't delete your only agent."
            : "Permanently deletes this agent with all of its memories and conversations, for every member."}
      </p>
      <AlertDialog>
        <AlertDialogTrigger asChild>
          <Button
            variant="outline"
            className="justify-self-start gap-2 text-destructive hover:text-destructive"
            disabled={disabled}
          >
            <Trash2 className="size-4" />
            Delete “{agent.name}”
          </Button>
        </AlertDialogTrigger>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete “{agent.name}”?</AlertDialogTitle>
            <AlertDialogDescription>
              This permanently deletes the agent along with all of its memories and
              conversations, for every member. This cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction variant="destructive" onClick={() => void confirmDelete()}>
              Delete agent
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}

function SystemPromptEditor({
  agent,
  onUpdateAgent,
}: {
  agent: Agent
  onUpdateAgent: SettingsDialogProps["onUpdateAgent"]
}) {
  const saved = agent.systemPrompt ?? ""
  const [draft, setDraft] = useState(saved)
  const [saving, setSaving] = useState(false)
  const isOwner = agent.role === "owner"
  const dirty = draft.trim() !== saved.trim()

  const save = async () => {
    if (!dirty || saving) return
    setSaving(true)
    // Empty clears the prompt; the backend stores it as null.
    await onUpdateAgent(agent.id, { systemPrompt: draft.trim() || null })
    setSaving(false)
  }

  return (
    <div className="grid gap-2">
      <Label htmlFor="agent-system-prompt">System prompt</Label>
      <Textarea
        id="agent-system-prompt"
        value={draft}
        placeholder="e.g. Always answer briefly. We live in Milan; assume metric units."
        rows={5}
        disabled={!isOwner}
        onChange={(e) => setDraft(e.target.value)}
      />
      <p className="text-xs text-muted-foreground">
        {isOwner
          ? "Extra instructions added to this agent's built-in prompt on every conversation."
          : "Only the agent's owner can edit its system prompt."}
      </p>
      {isOwner && (
        <Button
          variant="outline"
          className="justify-self-start"
          disabled={!dirty || saving}
          onClick={() => void save()}
        >
          {saving ? "Saving…" : "Save prompt"}
        </Button>
      )}
    </div>
  )
}
