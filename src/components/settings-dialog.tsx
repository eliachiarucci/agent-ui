import { useEffect, useState } from "react"
import { Bot, Boxes, Download, Info, Plus, Trash2, UserRound, Wrench } from "lucide-react"
import { toast } from "sonner"
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
import { Checkbox } from "@/components/ui/checkbox"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Separator } from "@/components/ui/separator"
import { Textarea } from "@/components/ui/textarea"
import { AgentSwitcher } from "@/components/agent-switcher"
import { AccountSettings } from "@/components/auth/account-settings"
import { ModelsSettings } from "@/components/models-settings"
import { ToolsSettings } from "@/components/tools-settings"
import { ModelPicker } from "@/components/model-picker"
import { cn } from "@/lib/utils"
import {
  downloadBackup,
  getDefaultMemoryPrompts,
  type Agent,
  type ProviderType,
} from "@/lib/api"

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
    changes: {
      systemPrompt?: string | null
      memoryProvider?: ProviderType | null
      memoryModel?: string | null
      chatMemoryEnabled?: boolean
      chatMemoryPrompt?: string | null
      memoryExtractionEnabled?: boolean
      memoryExtractionPrompt?: string | null
    }
  ) => Promise<boolean>
  // Owner-only; deletes the agent with all its memories and conversations.
  onDeleteAgent: (id: string) => Promise<boolean>
  // When set, opening the dialog lands on this tab instead of the default
  // (used by the OAuth callback landing to jump straight to Tools).
  initialTab?: SettingsTabId
}

const TABS = [
  { id: "agent", label: "Agent", icon: Bot },
  { id: "models", label: "Models", icon: Boxes },
  { id: "tools", label: "Tools", icon: Wrench },
  { id: "account", label: "Account", icon: UserRound },
  { id: "general", label: "General", icon: Info },
] as const

export type SettingsTabId = (typeof TABS)[number]["id"]
type TabId = SettingsTabId

export function SettingsDialog({
  open,
  onOpenChange,
  agents,
  activeAgentId,
  onSelectAgent,
  onCreateAgent,
  onUpdateAgent,
  onDeleteAgent,
  initialTab,
}: SettingsDialogProps) {
  const [tab, setTab] = useState<TabId>("agent")

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- intentional: jump to the requested tab on open
    if (open && initialTab) setTab(initialTab)
  }, [open, initialTab])

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
            ) : tab === "tools" ? (
              <ToolsSettings agents={agents} activeAgentId={activeAgentId} />
            ) : tab === "account" ? (
              <AccountSettings />
            ) : (
              <GeneralTab />
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}

// Injected at image build time from the release tag (Dockerfile APP_VERSION
// build arg); local dev has no tag and shows "dev".
const APP_VERSION: string = import.meta.env.VITE_APP_VERSION ?? "dev"

function GeneralTab() {
  const [downloading, setDownloading] = useState(false)

  const download = async () => {
    setDownloading(true)
    try {
      await downloadBackup()
    } catch (error) {
      toast.error("Backup failed", {
        description: error instanceof Error ? error.message : undefined,
      })
    } finally {
      setDownloading(false)
    }
  }

  return (
    <div className="grid gap-4">
      <div className="grid gap-2">
        <Label>About</Label>
        <div className="flex items-center justify-between rounded-md border px-3 py-2">
          <span className="text-sm text-muted-foreground">Version</span>
          <span className="font-mono text-sm">{APP_VERSION}</span>
        </div>
      </div>

      <Separator />

      <div className="grid gap-2">
        <Label>Backup</Label>
        <p className="text-xs text-muted-foreground">
          Download a snapshot of this server's entire database: every user's account,
          agents, memories, conversations, and settings — including stored provider
          keys and connector tokens, so keep it somewhere safe. Files created by
          agents are stored on disk and not included. Restore with{" "}
          <code className="font-mono">pg_restore</code>; see the install docs.
        </p>
        <Button
          variant="outline"
          className="justify-self-start gap-2"
          disabled={downloading}
          onClick={() => void download()}
        >
          <Download className="size-4" />
          {downloading ? "Preparing backup…" : "Download backup"}
        </Button>
      </div>
    </div>
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
          <Separator />
          <MemoryModelEditor agent={activeAgent} onUpdateAgent={onUpdateAgent} />
          <MemorySettings agent={activeAgent} onUpdateAgent={onUpdateAgent} />
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

// Owner-tunable memory settings for the active agent, in two sections: the
// chat model's own memory surface (instructions + tools + recalled memories)
// and the background extraction "second pass" that mines facts after every
// turn. Each has an on/off checkbox and a prompt override with a copyable
// built-in default. Rendered inside the Agent tab, below the memory model.
function MemorySettings({
  agent,
  onUpdateAgent,
}: {
  agent: Agent
  onUpdateAgent: SettingsDialogProps["onUpdateAgent"]
}) {
  const isOwner = agent.role === "owner"

  return (
    <>
      <Separator />

      <div className="grid gap-2">
        <Label>Memory in conversations</Label>
        <p className="text-xs text-muted-foreground">
          While you chat, “{agent.name}” carries memory instructions and tools to
          recall and store facts about you.
          {!isOwner && " Only the agent's owner can change these settings."}
        </p>
      </div>

      <MemoryToggle
        id="chat-memory-enabled"
        label="Use memory in conversations"
        description="When off, conversations run without memory instructions, recalled memories, or memory tools."
        checked={agent.chatMemoryEnabled}
        isOwner={isOwner}
        onToggle={(enabled) => onUpdateAgent(agent.id, { chatMemoryEnabled: enabled })}
      />

      {/* Editors are keyed so drafts reset when the selected agent changes. */}
      <MemoryPromptEditor
        key={`chat-${agent.id}`}
        id="chat-memory-prompt"
        label="Memory prompt"
        description="Replaces the built-in memory instructions of the chat model. Who the agent assists and its pinned core memories always apply."
        saved={agent.chatMemoryPrompt ?? ""}
        isOwner={isOwner}
        onSave={(prompt) => onUpdateAgent(agent.id, { chatMemoryPrompt: prompt })}
        loadDefault={() => getDefaultMemoryPrompts().then((p) => p.chat)}
      />

      <Separator />

      <div className="grid gap-2">
        <Label>Background memory extraction</Label>
        <p className="text-xs text-muted-foreground">
          After every exchange, “{agent.name}” runs a second pass with its memory
          model to pick out durable facts and store them as memories.
        </p>
      </div>

      <MemoryToggle
        id="memory-extraction-enabled"
        label="Extract memories automatically"
        description="When off, the agent only remembers what it explicitly saves during the conversation; nothing is extracted in the background."
        checked={agent.memoryExtractionEnabled}
        isOwner={isOwner}
        onToggle={(enabled) => onUpdateAgent(agent.id, { memoryExtractionEnabled: enabled })}
      />

      <MemoryPromptEditor
        key={`extraction-${agent.id}`}
        id="memory-extraction-prompt"
        label="Extraction prompt"
        description="Replaces the extractor's built-in instructions."
        saved={agent.memoryExtractionPrompt ?? ""}
        isOwner={isOwner}
        onSave={(prompt) => onUpdateAgent(agent.id, { memoryExtractionPrompt: prompt })}
        loadDefault={() => getDefaultMemoryPrompts().then((p) => p.extraction)}
      />
    </>
  )
}

function MemoryToggle({
  id,
  label,
  description,
  checked,
  isOwner,
  onToggle,
}: {
  id: string
  label: string
  description: string
  checked: boolean
  isOwner: boolean
  onToggle: (enabled: boolean) => Promise<boolean>
}) {
  const [saving, setSaving] = useState(false)

  const toggle = async (enabled: boolean) => {
    setSaving(true)
    await onToggle(enabled)
    setSaving(false)
  }

  return (
    <div className="flex items-start gap-3">
      <Checkbox
        id={id}
        className="mt-0.5"
        checked={checked}
        disabled={!isOwner || saving}
        onCheckedChange={(state) => void toggle(state === true)}
      />
      <div className="grid gap-1">
        <Label htmlFor={id}>{label}</Label>
        <p className="text-xs text-muted-foreground">{description}</p>
      </div>
    </div>
  )
}

// Prompt-override editor: empty saves as null, which means "use the built-in
// prompt"; the copy button pulls that built-in text in as a starting point.
function MemoryPromptEditor({
  id,
  label,
  description,
  saved,
  isOwner,
  onSave,
  loadDefault,
}: {
  id: string
  label: string
  description: string
  saved: string
  isOwner: boolean
  onSave: (prompt: string | null) => Promise<boolean>
  loadDefault: () => Promise<string>
}) {
  const [draft, setDraft] = useState(saved)
  const [saving, setSaving] = useState(false)
  const [loadingDefault, setLoadingDefault] = useState(false)
  const dirty = draft.trim() !== saved.trim()

  const save = async () => {
    if (!dirty || saving) return
    setSaving(true)
    await onSave(draft.trim() || null)
    setSaving(false)
  }

  const copyDefault = async () => {
    setLoadingDefault(true)
    try {
      setDraft(await loadDefault())
    } catch (error) {
      toast.error("Failed to load the default prompt", {
        description: error instanceof Error ? error.message : undefined,
      })
    } finally {
      setLoadingDefault(false)
    }
  }

  return (
    <div className="grid gap-2">
      <Label htmlFor={id}>{label}</Label>
      <Textarea
        id={id}
        value={draft}
        placeholder="Leave empty to use the built-in prompt."
        rows={6}
        disabled={!isOwner}
        onChange={(e) => setDraft(e.target.value)}
      />
      <p className="text-xs text-muted-foreground">
        {isOwner ? description : "Only the agent's owner can edit this prompt."}
      </p>
      {isOwner && (
        <div className="flex gap-2">
          <Button variant="outline" disabled={!dirty || saving} onClick={() => void save()}>
            {saving ? "Saving…" : "Save prompt"}
          </Button>
          <Button
            variant="ghost"
            disabled={loadingDefault}
            onClick={() => void copyDefault()}
          >
            {loadingDefault ? "Loading…" : "Copy default prompt"}
          </Button>
        </div>
      )}
    </div>
  )
}

// Owner-only picker for the model the background memory extractor runs on for
// this agent. Persisted on the agent via onUpdateAgent; resolved against the
// owner's provider credentials server-side. "Default model" clears it.
function MemoryModelEditor({
  agent,
  onUpdateAgent,
}: {
  agent: Agent
  onUpdateAgent: SettingsDialogProps["onUpdateAgent"]
}) {
  const isOwner = agent.role === "owner"
  const [saving, setSaving] = useState(false)

  const selected: { provider: ProviderType; model: string } | null =
    agent.memoryProvider && agent.memoryModel
      ? { provider: agent.memoryProvider, model: agent.memoryModel }
      : null

  const choose = async (next: { provider: ProviderType; model: string } | null) => {
    setSaving(true)
    await onUpdateAgent(agent.id, {
      memoryProvider: next?.provider ?? null,
      memoryModel: next?.model ?? null,
    })
    setSaving(false)
  }

  return (
    <div className="grid gap-2">
      <Label>Memory model</Label>
      <ModelPicker
        value={selected}
        onChange={(next) => void choose(next)}
        disabled={!isOwner}
        busy={saving}
        menuLabel="Memory model"
      />
      <p className="text-xs text-muted-foreground">
        {isOwner
          ? "The model that reviews each message in the background and updates this agent's memories. Defaults to your account's default model."
          : "Only the agent's owner can change the memory model."}
      </p>
    </div>
  )
}
