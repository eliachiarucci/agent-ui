import { useEffect, useState } from "react"
import { Check, ChevronDown, Copy, ExternalLink, Loader2, Mail, TriangleAlert, Unplug } from "lucide-react"
import { toast } from "sonner"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Separator } from "@/components/ui/separator"
import { Skeleton } from "@/components/ui/skeleton"
import { Switch } from "@/components/ui/switch"
import { ModelPicker, type ModelSelection } from "@/components/model-picker"
import { useConnectors } from "@/hooks/use-connectors"
import { useActiveModel } from "@/lib/active-model"
import { cn } from "@/lib/utils"
import {
  connectorAuthorizeUrl,
  getToolPermissions,
  saveToolPermissions,
  type ConnectorInfo,
  type ConnectorType,
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

export function ToolsSettings() {
  const { connectors, loading, save, remove } = useConnectors()
  // Tool toggles are scoped per chat model; start from the status-bar selection.
  const active = useActiveModel()
  const [selection, setSelection] = useState<ModelSelection | null>(active)
  const [expanded, setExpanded] = useState<ConnectorType | null>(null)

  // The permission map for the selected model, shared by every connector card.
  // Tagged with the model it was fetched for: switching models makes the stale
  // map invisible immediately (reads as null → loading) without a state reset.
  const modelKey = selection ? `${selection.provider}:${selection.model}` : null
  const [fetched, setFetched] = useState<{ key: string; value: ToolPermissions } | null>(null)
  const permissions = fetched && fetched.key === modelKey ? fetched.value : null

  useEffect(() => {
    if (!selection || !modelKey) return
    let stale = false
    getToolPermissions(selection.provider, selection.model)
      .then((perms) => {
        if (!stale) setFetched({ key: modelKey, value: perms })
      })
      .catch((error: unknown) => {
        toast.error("Failed to load tool permissions", {
          description: error instanceof Error ? error.message : undefined,
        })
      })
    return () => {
      stale = true
    }
  }, [selection, modelKey])

  const toggleTool = async (connector: ConnectorType, tool: string, enabled: boolean) => {
    if (!selection || !modelKey || permissions === null) return
    const previous = permissions
    const next: ToolPermissions = {
      ...permissions,
      [connector]: { ...permissions[connector], [tool]: enabled },
    }
    setFetched({ key: modelKey, value: next })
    try {
      await saveToolPermissions(selection.provider, selection.model, next)
    } catch (error) {
      setFetched({ key: modelKey, value: previous })
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
        <ModelPicker
          value={selection}
          onChange={setSelection}
          menuLabel="Model"
          emptyLabel="Select a model"
          clearable={false}
        />
        <p className="text-xs text-muted-foreground">
          Tool permissions are saved per model: pick the model you chat with, then choose which
          tools it may use. Connections themselves are shared across models.
        </p>
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
          selection={selection}
          permissions={permissions}
          onToggleTool={toggleTool}
          onSave={save}
          onRemove={remove}
        />
      ))}
    </div>
  )
}

function ConnectorCard({
  info,
  expanded,
  onToggle,
  selection,
  permissions,
  onToggleTool,
  onSave,
  onRemove,
}: {
  info: ConnectorInfo
  expanded: boolean
  onToggle: () => void
  selection: ModelSelection | null
  permissions: ToolPermissions | null
  onToggleTool: (connector: ConnectorType, tool: string, enabled: boolean) => Promise<void>
  onSave: (
    connector: ConnectorType,
    input: { clientId: string; clientSecret?: string }
  ) => Promise<ConnectorInfo | undefined>
  onRemove: (connector: ConnectorType) => Promise<boolean>
}) {
  const connected = info.status === "connected"

  return (
    // overflow-hidden also zeroes the card's min-content contribution as a grid
    // item: without it, the truncated (nowrap) description propagates its full
    // single-line width upward and forces the whole dialog wider.
    <div className="overflow-hidden rounded-lg border">
      <button
        type="button"
        aria-expanded={expanded}
        className="flex w-full items-center gap-3 p-3 text-left"
        onClick={onToggle}
      >
        <div className="flex size-9 shrink-0 items-center justify-center rounded-md border bg-muted/50">
          <Mail className="size-4" />
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
            {info.status === "error" && (
              <Badge variant="destructive" className="gap-1 text-xs">
                <TriangleAlert className="size-3" />
                Reconnect needed
              </Badge>
            )}
          </div>
          <p className="truncate text-xs text-muted-foreground">
            Search email, read threads, manage labels and prepare drafts — it can never send.
          </p>
        </div>
        <ChevronDown
          className={cn(
            "size-4 shrink-0 text-muted-foreground transition-transform",
            expanded && "rotate-180"
          )}
        />
      </button>

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
              selection={selection}
              permissions={permissions}
              onToggleTool={onToggleTool}
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
            Enable the <span className="font-medium">Gmail API</span> for it (
            <WizardLink href="https://console.cloud.google.com/apis/library/gmail.googleapis.com">
              API library
            </WizardLink>
            ).
          </li>
          <li>
            Configure the OAuth consent screen (
            <WizardLink href="https://console.cloud.google.com/auth/branding">
              auth branding
            </WizardLink>
            ): pick <span className="font-medium">External</span> and add yourself as a test
            user — or <span className="font-medium">Internal</span> if you're on Google
            Workspace (no weekly re-consent).
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
        <p>Then paste the client ID and secret below.</p>
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

// Connected state: account line, per-tool permission switches for the selected
// model (grouped read/write, like Claude's connector settings), disconnect.
function ConnectedSection({
  info,
  selection,
  permissions,
  onToggleTool,
  onRemove,
}: {
  info: ConnectorInfo
  selection: ModelSelection | null
  permissions: ToolPermissions | null
  onToggleTool: (connector: ConnectorType, tool: string, enabled: boolean) => Promise<void>
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
        {selection ? (
          <p className="text-xs text-muted-foreground">
            Which {info.name} tools{" "}
            <span className="font-medium text-foreground">{selection.model}</span> may use.
            Changes apply from the next message.
          </p>
        ) : (
          <p className="text-xs text-amber-600 dark:text-amber-500">
            Select a model at the top of this tab to configure its tool permissions.
          </p>
        )}
      </div>

      {selection && permissions === null ? (
        <Skeleton className="h-24 w-full" />
      ) : (
        selection &&
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
                    <Switch
                      checked={permissions[info.connector]?.[tool.name] !== false}
                      onCheckedChange={(checked) =>
                        void onToggleTool(info.connector, tool.name, checked)
                      }
                      aria-label={`Allow ${tool.name}`}
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
