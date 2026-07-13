import { useEffect, useState } from "react"
import {
  CalendarDays,
  Check,
  ChevronDown,
  Copy,
  ExternalLink,
  Loader2,
  Mail,
  ShieldCheck,
  Trash2,
  TriangleAlert,
  Unplug,
  type LucideIcon,
} from "lucide-react"
import { toast } from "sonner"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Separator } from "@/components/ui/separator"
import { Skeleton } from "@/components/ui/skeleton"
import { Switch } from "@/components/ui/switch"
import { useConnectors } from "@/hooks/use-connectors"
import { cn } from "@/lib/utils"
import {
  connectorAuthorizeUrl,
  deleteToolApproval,
  getToolPermissions,
  listToolApprovals,
  saveToolPermissions,
  type Agent,
  type ConnectorInfo,
  type ConnectorType,
  type ToolApproval,
  type ToolPermissionLevel,
  type ToolPermissions,
} from "@/lib/api"

// The clipboard API needs a secure context, which LAN deployments don't have;
// fall back to the legacy path so the copy button works everywhere.
async function copyText(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text)
    return true
  } catch {
    const el = document.createElement("textarea")
    el.value = text
    document.body.appendChild(el)
    el.select()
    try {
      return document.execCommand("copy")
    } finally {
      el.remove()
    }
  }
}

// Purely presentational per-connector bits the backend catalog doesn't carry:
// card icon, one-line tagline, and which Google API the setup wizard tells the
// user to enable in their Cloud project.
const CONNECTOR_META: Record<
  ConnectorType,
  { icon: LucideIcon; tagline: string; api: { name: string; href: string } }
> = {
  gmail: {
    icon: Mail,
    tagline: "Search email, read threads, manage labels, draft and send — writes ask first.",
    api: {
      name: "Gmail API",
      href: "https://console.cloud.google.com/apis/library/gmail.googleapis.com",
    },
  },
  "google-calendar": {
    icon: CalendarDays,
    tagline: "Read your schedule, find free time, create and manage events — writes ask first.",
    api: {
      name: "Google Calendar API",
      href: "https://console.cloud.google.com/apis/library/calendar-json.googleapis.com",
    },
  },
}

export function ToolsSettings({
  agents,
  activeAgentId,
}: {
  agents: Agent[]
  activeAgentId?: string
}) {
  const { connectors, loading, save, toggle, remove } = useConnectors()
  // Tool permissions are scoped per agent; start from the active one.
  const [agentId, setAgentId] = useState<string | undefined>(activeAgentId ?? agents[0]?.id)
  const [expanded, setExpanded] = useState<ConnectorType | null>(null)

  // The permission map for the selected agent, shared by every connector card.
  // Tagged with the agent it was fetched for: switching agents makes the stale
  // map invisible immediately (reads as null → loading) without a state reset.
  const [fetched, setFetched] = useState<{ key: string; value: ToolPermissions } | null>(null)
  const permissions = fetched && fetched.key === agentId ? fetched.value : null

  useEffect(() => {
    if (!agentId) return
    let stale = false
    getToolPermissions(agentId)
      .then((perms) => {
        if (!stale) setFetched({ key: agentId, value: perms })
      })
      .catch((error: unknown) => {
        toast.error("Failed to load tool permissions", {
          description: error instanceof Error ? error.message : undefined,
        })
      })
    return () => {
      stale = true
    }
  }, [agentId])

  const setToolLevel = async (
    connector: ConnectorType,
    tool: string,
    level: ToolPermissionLevel
  ) => {
    if (!agentId || permissions === null) return
    const previous = permissions
    const next: ToolPermissions = {
      ...permissions,
      [connector]: { ...permissions[connector], [tool]: level },
    }
    setFetched({ key: agentId, value: next })
    try {
      await saveToolPermissions(agentId, next)
    } catch (error) {
      setFetched({ key: agentId, value: previous })
      toast.error("Failed to save tool permissions", {
        description: error instanceof Error ? error.message : undefined,
      })
    }
  }

  if (loading) {
    return (
      <div className="grid gap-3">
        <Skeleton className="h-16 w-full" />
        <Skeleton className="h-16 w-full" />
      </div>
    )
  }

  return (
    <div className="grid gap-3">
      <div className="grid gap-2">
        <Label>Configure tools for</Label>
        <Select value={agentId} onValueChange={setAgentId}>
          <SelectTrigger className="w-full">
            <SelectValue placeholder="Select an agent" />
          </SelectTrigger>
          <SelectContent>
            {agents.map((agent) => (
              <SelectItem key={agent.id} value={agent.id}>
                {agent.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <p className="text-xs text-muted-foreground">
          Tool permissions are saved per agent: pick an agent, then choose what its tools may
          do. Connections themselves are yours and shared across agents.
        </p>
        {agentId && <ApprovalOverridesDialog agentId={agentId} />}
      </div>

      <Separator />

      <div>
        <p className="text-sm font-medium">MCP connectors</p>
        <p className="text-xs text-muted-foreground">
          Connect external services the agent can use as tools. Each connector uses your own
          Google Cloud OAuth app, so credentials and data never touch third-party servers.
        </p>
      </div>

      {connectors.map((connector) => (
        <ConnectorCard
          key={connector.connector}
          info={connector}
          expanded={expanded === connector.connector}
          onToggle={() =>
            setExpanded((cur) => (cur === connector.connector ? null : connector.connector))
          }
          agentSelected={Boolean(agentId)}
          permissions={permissions}
          onSetLevel={setToolLevel}
          onSave={save}
          onToggleEnabled={toggle}
          onRemove={remove}
        />
      ))}
    </div>
  )
}

// Standing "always approve" overrides for the selected agent: created from the
// chat's approval prompts, listed here so they can be reviewed and revoked.
function ApprovalOverridesDialog({ agentId }: { agentId: string }) {
  const [open, setOpen] = useState(false)
  // Tagged with the agent it was fetched for, like the permissions map above:
  // switching agents reads as null (loading) without a state reset in the effect.
  const [fetched, setFetched] = useState<{ key: string; rows: ToolApproval[] } | null>(null)
  const approvals = fetched && fetched.key === agentId ? fetched.rows : null

  useEffect(() => {
    if (!open) return
    let stale = false
    listToolApprovals(agentId)
      .then((rows) => {
        if (!stale) setFetched({ key: agentId, rows })
      })
      .catch((error: unknown) => {
        toast.error("Failed to load approval overrides", {
          description: error instanceof Error ? error.message : undefined,
        })
      })
    return () => {
      stale = true
    }
  }, [open, agentId])

  const remove = async (id: string) => {
    const previous = fetched
    setFetched((cur) => (cur ? { ...cur, rows: cur.rows.filter((r) => r.id !== id) } : cur))
    try {
      await deleteToolApproval(id)
    } catch (error) {
      setFetched(previous)
      toast.error("Failed to remove the override", {
        description: error instanceof Error ? error.message : undefined,
      })
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" className="w-fit gap-2">
          <ShieldCheck className="size-4" />
          Approval overrides
        </Button>
      </DialogTrigger>
      <DialogContent className="max-h-[80vh] gap-4 overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Approval overrides</DialogTitle>
          <DialogDescription>
            Combinations you chose to "always approve" from the chat's approval prompts. The
            agent runs matching calls without asking; remove one to be asked again.
          </DialogDescription>
        </DialogHeader>
        {approvals === null ? (
          <Skeleton className="h-24 w-full" />
        ) : approvals.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            No overrides yet. When a tool set to "Ask" requests approval in a chat, choosing
            "Always allow" saves it here.
          </p>
        ) : (
          <div className="rounded-md border">
            {approvals.map((approval, i) => (
              <div
                key={approval.id}
                className={cn("flex items-center gap-3 p-2.5", i > 0 && "border-t")}
              >
                <div className="min-w-0 flex-1">
                  <p className="font-mono text-xs">{approval.tool}</p>
                  <p className="truncate text-xs text-muted-foreground">
                    {approval.target === "*" ? "Any call" : approval.target}
                  </p>
                </div>
                <Badge variant="secondary" className="shrink-0 text-xs">
                  {approval.connector}
                </Badge>
                <Button
                  variant="ghost"
                  size="icon"
                  className="size-7 shrink-0 text-muted-foreground hover:text-destructive"
                  aria-label={`Remove override for ${approval.tool}`}
                  onClick={() => void remove(approval.id)}
                >
                  <Trash2 className="size-3.5" />
                </Button>
              </div>
            ))}
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}

function ConnectorCard({
  info,
  expanded,
  onToggle,
  agentSelected,
  permissions,
  onSetLevel,
  onSave,
  onToggleEnabled,
  onRemove,
}: {
  info: ConnectorInfo
  expanded: boolean
  onToggle: () => void
  agentSelected: boolean
  permissions: ToolPermissions | null
  onSetLevel: (
    connector: ConnectorType,
    tool: string,
    level: ToolPermissionLevel
  ) => Promise<void>
  onSave: (
    connector: ConnectorType,
    input: { clientId: string; clientSecret?: string }
  ) => Promise<ConnectorInfo | undefined>
  onToggleEnabled: (connector: ConnectorType, enabled: boolean) => Promise<void>
  onRemove: (connector: ConnectorType) => Promise<boolean>
}) {
  const connected = info.status === "connected"
  const meta = CONNECTOR_META[info.connector]

  return (
    // overflow-hidden also zeroes the card's min-content contribution as a grid
    // item: without it, the truncated (nowrap) description propagates its full
    // single-line width upward and forces the whole dialog wider.
    <div className="overflow-hidden rounded-lg border">
      {/* The expand control and the enable switch are sibling controls (a
          switch may not nest inside a button): the icon+text area expands the
          card, the switch and chevron sit after it in the same row. */}
      <div className="flex w-full items-center gap-3 p-3">
        <button
          type="button"
          aria-expanded={expanded}
          className={cn(
            "flex min-w-0 flex-1 items-center gap-3 text-left",
            connected && !info.enabled && "opacity-60"
          )}
          onClick={onToggle}
        >
          <div className="flex size-9 shrink-0 items-center justify-center rounded-md border bg-muted/50">
            <meta.icon className="size-4" />
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <span className="text-sm font-medium">Google {info.name}</span>
              {connected && (
                <Badge variant="secondary" className="gap-1 text-xs">
                  <Check className="size-3" />
                  {info.email ?? "Connected"}
                </Badge>
              )}
              {connected && !info.enabled && (
                <Badge variant="outline" className="text-xs">
                  Off
                </Badge>
              )}
              {info.status === "error" && (
                <Badge variant="destructive" className="gap-1 text-xs">
                  <TriangleAlert className="size-3" />
                  Reconnect needed
                </Badge>
              )}
            </div>
            <p className="truncate text-xs text-muted-foreground">{meta.tagline}</p>
          </div>
        </button>
        {/* Only connected connectors offer tools, so only they can be switched
            off. Credentials and tokens stay; flipping back needs no reconnect. */}
        {connected && (
          <Switch
            checked={info.enabled}
            onCheckedChange={(checked) => void onToggleEnabled(info.connector, checked)}
            aria-label={`${info.enabled ? "Disable" : "Enable"} Google ${info.name} tools`}
          />
        )}
        <button
          type="button"
          aria-expanded={expanded}
          aria-label={expanded ? "Collapse" : "Expand"}
          className="shrink-0"
          onClick={onToggle}
        >
          <ChevronDown
            className={cn(
              "size-4 text-muted-foreground transition-transform",
              expanded && "rotate-180"
            )}
          />
        </button>
      </div>

      {expanded && (
        <div className="grid gap-4 border-t p-3">
          {info.status === "error" && (
            <p className="text-xs text-amber-600 dark:text-amber-500">
              Google no longer accepts the stored connection (it expired or was revoked). Connect
              again below.
            </p>
          )}

          {connected ? (
            <ConnectedSection
              info={info}
              agentSelected={agentSelected}
              permissions={permissions}
              onSetLevel={onSetLevel}
              onRemove={onRemove}
            />
          ) : (
            <SetupWizard info={info} onSave={onSave} onRemove={onRemove} />
          )}
        </div>
      )}
    </div>
  )
}

// First-run tutorial + credentials form + connect button. Google requires the
// app to be reached over HTTPS (or localhost) for the OAuth redirect to be
// registrable — mirrored in the copy below.
function SetupWizard({
  info,
  onSave,
  onRemove,
}: {
  info: ConnectorInfo
  onSave: (
    connector: ConnectorType,
    input: { clientId: string; clientSecret?: string }
  ) => Promise<ConnectorInfo | undefined>
  onRemove: (connector: ConnectorType) => Promise<boolean>
}) {
  const [clientId, setClientId] = useState(info.clientId ?? "")
  const [clientSecret, setClientSecret] = useState("")
  const [saving, setSaving] = useState(false)
  const [connecting, setConnecting] = useState(false)

  const configured = Boolean(info.clientId && info.hasClientSecret)
  const dirty = clientId.trim() !== (info.clientId ?? "") || clientSecret.trim() !== ""
  const incomplete = !clientId.trim() || (!clientSecret.trim() && !info.hasClientSecret)

  const runSave = async () => {
    setSaving(true)
    const saved = await onSave(info.connector, {
      clientId: clientId.trim(),
      // Omitted → the backend keeps the stored secret.
      ...(clientSecret.trim() && { clientSecret: clientSecret.trim() }),
    })
    setSaving(false)
    if (saved) setClientSecret("")
    return saved
  }

  const connect = async () => {
    setConnecting(true)
    // Save any pending edits first so the authorize redirect uses them.
    if (dirty || !configured) {
      const saved = await runSave()
      if (!saved) {
        setConnecting(false)
        return
      }
    }
    // Full-page navigation: Google's consent screen, then back to the app.
    window.location.href = connectorAuthorizeUrl(info.connector)
  }

  return (
    <>
      <div className="grid gap-2 text-xs text-muted-foreground">
        <p className="text-sm font-medium text-foreground">One-time setup (~10 minutes)</p>
        <p>
          The agent connects with your own Google Cloud OAuth app, so you stay in full control
          of the access. You'll see Google's normal consent screen, like connecting any app.
        </p>
        <ol className="ml-4 grid list-decimal gap-1.5">
          <li>
            Create (or pick) a project at{" "}
            <WizardLink href="https://console.cloud.google.com/projectcreate">
              console.cloud.google.com
            </WizardLink>
            .
          </li>
          <li>
            Enable the <span className="font-medium">{CONNECTOR_META[info.connector].api.name}</span>{" "}
            for it (
            <WizardLink href={CONNECTOR_META[info.connector].api.href}>API library</WizardLink>
            ).
          </li>
          <li>
            Configure the OAuth consent screen (
            <WizardLink href="https://console.cloud.google.com/auth/branding">
              auth branding
            </WizardLink>
            ): pick <span className="font-medium">External</span> — or{" "}
            <span className="font-medium">Internal</span> if you're on Google Workspace (no
            weekly re-consent, skip the next step).
          </li>
          <li>
            Add the <span className="font-medium">exact Google account you'll connect</span> as
            a test user (
            <WizardLink href="https://console.cloud.google.com/auth/audience">
              audience
            </WizardLink>{" "}
            → Test users). Required: without it Google blocks the consent with{" "}
            <span className="font-medium">error 403: access_denied</span>.
          </li>
          <li>
            Create an OAuth client (
            <WizardLink href="https://console.cloud.google.com/auth/clients">
              credentials
            </WizardLink>
            ): type <span className="font-medium">Web application</span>, and register this
            redirect URI (requires the app to be served over HTTPS or localhost):
          </li>
        </ol>
        <CopyField value={info.redirectUri} />
        <p>
          Then paste the client ID and secret below. When you connect, Google will warn that it
          "hasn't verified this app" — expected while the app is in testing: click{" "}
          <span className="font-medium">Continue</span>.
        </p>
      </div>

      <div className="grid gap-2">
        <Label htmlFor={`${info.connector}-client-id`}>Client ID</Label>
        <Input
          id={`${info.connector}-client-id`}
          value={clientId}
          placeholder="1234...apps.googleusercontent.com"
          autoComplete="off"
          onChange={(e) => setClientId(e.target.value)}
        />
      </div>
      <div className="grid gap-2">
        <Label htmlFor={`${info.connector}-client-secret`}>Client secret</Label>
        <Input
          id={`${info.connector}-client-secret`}
          type="password"
          autoComplete="off"
          value={clientSecret}
          placeholder={
            info.hasClientSecret ? "•••••••• (stored — leave empty to keep)" : "GOCSPX-..."
          }
          onChange={(e) => setClientSecret(e.target.value)}
        />
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <Button className="gap-2" disabled={incomplete || saving || connecting} onClick={() => void connect()}>
          {connecting ? <Loader2 className="size-4 animate-spin" /> : <ExternalLink className="size-4" />}
          {info.status === "error" ? "Reconnect Google account" : "Connect Google account"}
        </Button>
        <Button
          variant="outline"
          disabled={incomplete || saving || connecting}
          onClick={() => void runSave()}
        >
          {saving && <Loader2 className="size-4 animate-spin" />}
          Save credentials
        </Button>
        {configured && (
          <Button
            variant="ghost"
            className="ml-auto gap-2 text-destructive hover:text-destructive"
            disabled={saving || connecting}
            onClick={() => void onRemove(info.connector)}
          >
            <Unplug className="size-4" />
            Remove
          </Button>
        )}
      </div>
    </>
  )
}

// Connected state: account line, per-tool permission levels for the selected
// agent (grouped read/write, like Claude's connector settings), disconnect.
function ConnectedSection({
  info,
  agentSelected,
  permissions,
  onSetLevel,
  onRemove,
}: {
  info: ConnectorInfo
  agentSelected: boolean
  permissions: ToolPermissions | null
  onSetLevel: (
    connector: ConnectorType,
    tool: string,
    level: ToolPermissionLevel
  ) => Promise<void>
  onRemove: (connector: ConnectorType) => Promise<boolean>
}) {
  const [removing, setRemoving] = useState(false)
  const groups: Array<{ kind: "read" | "write"; label: string }> = [
    { kind: "read", label: "Read" },
    { kind: "write", label: "Write" },
  ]

  return (
    <>
      <div className="grid gap-1">
        <p className="text-sm font-medium">Permissions</p>
        {agentSelected ? (
          <p className="text-xs text-muted-foreground">
            What the selected agent may do with {info.name}. Changes apply from the next
            message. "Ask" pauses the chat on each call so you can approve it, always approve
            that tool + target combination, or deny it. Recurring jobs run unattended, so
            "Ask" tools stay unavailable there.
          </p>
        ) : (
          <p className="text-xs text-amber-600 dark:text-amber-500">
            Select an agent at the top of this tab to configure its tool permissions.
          </p>
        )}
      </div>

      {agentSelected && permissions === null ? (
        <Skeleton className="h-24 w-full" />
      ) : (
        agentSelected &&
        permissions !== null &&
        groups.map(({ kind, label }) => {
          const tools = info.tools.filter((t) => t.kind === kind)
          if (tools.length === 0) return null
          return (
            <div key={kind} className="grid gap-1">
              <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                {label}
              </p>
              <div className="rounded-md border">
                {tools.map((tool, i) => (
                  <div
                    key={tool.name}
                    className={cn(
                      "flex items-center justify-between gap-3 p-2.5",
                      i > 0 && "border-t"
                    )}
                  >
                    <div className="min-w-0">
                      <p className="font-mono text-xs">{tool.name}</p>
                      <p className="text-xs text-muted-foreground">{tool.description}</p>
                    </div>
                    <LevelControl
                      label={`Permission for ${tool.name}`}
                      value={permissions[info.connector]?.[tool.name] ?? tool.defaultLevel}
                      onChange={(level) => void onSetLevel(info.connector, tool.name, level)}
                    />
                  </div>
                ))}
              </div>
            </div>
          )
        })
      )}

      <div className="flex items-center">
        <Button
          variant="ghost"
          className="ml-auto gap-2 text-destructive hover:text-destructive"
          disabled={removing}
          onClick={() => {
            setRemoving(true)
            void onRemove(info.connector).finally(() => setRemoving(false))
          }}
        >
          {removing ? <Loader2 className="size-4 animate-spin" /> : <Unplug className="size-4" />}
          Disconnect
        </Button>
      </div>
    </>
  )
}

// Segmented three-way control, in escalating order of access: deny, ask, allow.
const LEVELS: Array<{ id: ToolPermissionLevel; label: string }> = [
  { id: "deny", label: "Deny" },
  { id: "ask", label: "Ask" },
  { id: "allow", label: "Allow" },
]

function LevelControl({
  value,
  onChange,
  label,
}: {
  value: ToolPermissionLevel
  onChange: (level: ToolPermissionLevel) => void
  label: string
}) {
  return (
    <div role="radiogroup" aria-label={label} className="flex shrink-0 rounded-md border p-0.5">
      {LEVELS.map((level) => (
        <button
          key={level.id}
          type="button"
          role="radio"
          aria-checked={value === level.id}
          className={cn(
            "rounded px-2 py-1 text-xs transition-colors",
            value === level.id
              ? "bg-accent font-medium text-accent-foreground"
              : "text-muted-foreground hover:text-foreground"
          )}
          onClick={() => onChange(level.id)}
        >
          {level.label}
        </button>
      ))}
    </div>
  )
}

function WizardLink({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noreferrer"
      className="underline underline-offset-2 hover:text-foreground"
    >
      {children}
    </a>
  )
}

function CopyField({ value }: { value: string }) {
  const [copied, setCopied] = useState(false)
  return (
    <div className="flex items-center gap-2">
      <Input readOnly value={value} className="font-mono text-xs" onFocus={(e) => e.target.select()} />
      <Button
        variant="outline"
        size="icon"
        className="shrink-0"
        aria-label="Copy redirect URI"
        onClick={() => {
          void copyText(value).then((ok) => {
            if (!ok) return
            setCopied(true)
            setTimeout(() => setCopied(false), 1500)
          })
        }}
      >
        {copied ? <Check className="size-4" /> : <Copy className="size-4" />}
      </Button>
    </div>
  )
}
