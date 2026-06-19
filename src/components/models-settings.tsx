import { useState } from "react"
import { Bot, Check, ChevronDown, Cloud, Gem, Loader2, Plug, Server, Sparkles, Trash2, Waypoints, Zap } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Separator } from "@/components/ui/separator"
import { Skeleton } from "@/components/ui/skeleton"
import { ModelPicker, type ModelSelection } from "@/components/model-picker"
import { useProviders } from "@/hooks/use-providers"
import { useDefaultModel } from "@/hooks/use-default-model"
import { cn } from "@/lib/utils"
import type { ProviderConfig, ProviderSettingsInput, ProviderType } from "@/lib/api"

const PROVIDERS: Array<{
  id: ProviderType
  name: string
  description: string
  icon: typeof Server
  // Only LM Studio takes a URL; everyone else authenticates with just a key.
  keyPlaceholder: string
  keyHelp?: string
}> = [
  {
    id: "lmstudio",
    name: "LM Studio",
    description: "Local models through LM Studio's OpenAI-compatible server.",
    icon: Server,
    keyPlaceholder: "Only if your LM Studio server requires one",
  },
  {
    id: "anthropic",
    name: "Anthropic",
    description: "Claude models through the Anthropic API.",
    icon: Sparkles,
    keyPlaceholder: "sk-ant-api...",
    keyHelp:
      "Create an API key in the Anthropic Console (console.anthropic.com). Claude Code setup tokens won't work here.",
  },
  {
    id: "google",
    name: "Google",
    description: "Gemini models through the Gemini API.",
    icon: Gem,
    keyPlaceholder: "AIza...",
    keyHelp: "Create an API key in Google AI Studio (aistudio.google.com).",
  },
  {
    id: "deepinfra",
    name: "DeepInfra",
    description: "Open-source models through DeepInfra's inference cloud.",
    icon: Cloud,
    keyPlaceholder: "Your DeepInfra API key",
    keyHelp: "Create an API key in the DeepInfra dashboard (deepinfra.com/dash/api_keys).",
  },
  {
    id: "tensorx",
    name: "TensorX",
    description: "Open models through TensorX's OpenAI-compatible inference cloud.",
    icon: Zap,
    keyPlaceholder: "Your TensorX API key",
    keyHelp: "Create an API key in the TensorX dashboard (tensorx.ai).",
  },
  {
    id: "openrouter",
    name: "OpenRouter",
    description: "Hundreds of models from many providers through one OpenRouter key.",
    icon: Waypoints,
    keyPlaceholder: "sk-or-...",
    keyHelp: "Create an API key in the OpenRouter dashboard (openrouter.ai/keys).",
  },
  {
    id: "openai",
    name: "OpenAI",
    description: "GPT and o-series models through the OpenAI API.",
    icon: Bot,
    keyPlaceholder: "sk-...",
    keyHelp: "Create an API key at platform.openai.com/api-keys.",
  },
]

export function ModelsSettings() {
  const { providers, loading, test, save, remove } = useProviders()
  const [expanded, setExpanded] = useState<ProviderType | null>(null)

  if (loading) {
    return (
      <div className="grid gap-3">
        {PROVIDERS.map((meta) => (
          <Skeleton key={meta.id} className="h-16 w-full" />
        ))}
      </div>
    )
  }

  return (
    <div className="grid gap-3">
      <DefaultModelSection />
      <Separator />
      <p className="text-xs text-muted-foreground">
        Connect a model provider. Settings are verified with a test request before they
        are saved. Pick the active model from the selector in the chat's status bar.
      </p>
      {PROVIDERS.map((meta) => {
        const config = providers.find((p) => p.provider === meta.id)
        return (
          <ProviderCard
            // Re-keying on updatedAt resets drafts after a successful save.
            key={`${meta.id}-${config?.updatedAt ?? "new"}`}
            meta={meta}
            config={config}
            expanded={expanded === meta.id}
            onToggle={() => setExpanded((cur) => (cur === meta.id ? null : meta.id))}
            onTest={test}
            onSave={save}
            onRemove={remove}
          />
        )
      })}
    </div>
  )
}

// The account default model: used for chats with no explicit selection and as
// the fallback for background work (scheduled jobs, memory). Persisted server-
// side; "Use default model" clears it back to the server's configured model.
function DefaultModelSection() {
  const { selected, loading, set } = useDefaultModel()
  const [saving, setSaving] = useState(false)

  // Mandatory: the picker hides its clear item, so `next` is always a selection.
  const choose = async (next: ModelSelection | null) => {
    if (!next) return
    setSaving(true)
    await set(next.provider, next.model)
    setSaving(false)
  }

  return (
    <div className="grid gap-2">
      <Label>
        Default model <span className="text-destructive">*</span>
      </Label>
      <ModelPicker
        value={selected}
        onChange={(next) => void choose(next)}
        busy={saving}
        menuLabel="Default model"
        emptyLabel="Select a model"
        clearable={false}
      />
      {!loading && !selected ? (
        <p className="text-xs text-amber-600 dark:text-amber-500">
          Required — pick a model to start chatting. Without one, the agent can't run.
          Add a provider below first if you haven't.
        </p>
      ) : (
        <p className="text-xs text-muted-foreground">
          Used for every chat (unless you override it in the status bar) and for background
          tasks like scheduled jobs and memory.
        </p>
      )}
    </div>
  )
}

function ProviderCard({
  meta,
  config,
  expanded,
  onToggle,
  onTest,
  onSave,
  onRemove,
}: {
  meta: (typeof PROVIDERS)[number]
  config?: ProviderConfig
  expanded: boolean
  onToggle: () => void
  onTest: (provider: ProviderType, settings: ProviderSettingsInput) => Promise<string[] | undefined>
  onSave: (provider: ProviderType, settings: ProviderSettingsInput) => Promise<boolean>
  onRemove: (provider: ProviderType) => Promise<boolean>
}) {
  const Icon = meta.icon
  const hasStoredKey = config?.settings.hasApiKey ?? false

  const [url, setUrl] = useState(config?.settings.url ?? (meta.id === "lmstudio" ? "http://localhost:1234" : ""))
  const [apiKey, setApiKey] = useState("")
  const [testing, setTesting] = useState(false)
  const [saving, setSaving] = useState(false)
  const [removing, setRemoving] = useState(false)
  // Model count from the last successful test, shown as connection feedback.
  const [testedModels, setTestedModels] = useState<number | null>(null)

  const draft = (): ProviderSettingsInput => ({
    ...(meta.id === "lmstudio" && { url: url.trim() }),
    // Omitted keys fall back to the stored one server-side.
    ...(apiKey.trim() && { apiKey: apiKey.trim() }),
  })

  // Key-only providers need a key (typed now or already stored); LM Studio
  // needs a URL.
  const needsKey = meta.id !== "lmstudio"
  const incomplete = needsKey ? !apiKey.trim() && !hasStoredKey : !url.trim()
  const busy = testing || saving || removing

  const runTest = async () => {
    setTesting(true)
    const found = await onTest(meta.id, draft())
    setTesting(false)
    if (found) setTestedModels(found.length)
  }

  const runSave = async () => {
    setSaving(true)
    const ok = await onSave(meta.id, draft())
    setSaving(false)
    if (ok) setApiKey("")
  }

  const runRemove = async () => {
    setRemoving(true)
    await onRemove(meta.id)
    setRemoving(false)
  }

  return (
    <div className="rounded-lg border">
      <button
        type="button"
        aria-expanded={expanded}
        className="flex w-full items-center gap-3 p-3 text-left"
        onClick={onToggle}
      >
        <div className="flex size-9 shrink-0 items-center justify-center rounded-md border bg-muted/50">
          <Icon className="size-4" />
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <span className="text-sm font-medium">{meta.name}</span>
            {config && (
              <Badge variant="secondary" className="gap-1 text-xs">
                <Check className="size-3" />
                Connected
              </Badge>
            )}
          </div>
          <p className="truncate text-xs text-muted-foreground">{meta.description}</p>
        </div>
        <ChevronDown
          className={cn(
            "size-4 shrink-0 text-muted-foreground transition-transform",
            expanded && "rotate-180"
          )}
        />
      </button>

      {expanded && (
        <div className="grid gap-3 border-t p-3">
          {meta.id === "lmstudio" && (
            <div className="grid gap-2">
              <Label htmlFor={`${meta.id}-url`}>Server URL</Label>
              <Input
                id={`${meta.id}-url`}
                value={url}
                placeholder="http://localhost:1234"
                onChange={(e) => setUrl(e.target.value)}
              />
            </div>
          )}

          <div className="grid gap-2">
            <Label htmlFor={`${meta.id}-key`}>
              API key
              {!needsKey && (
                <span className="font-normal text-muted-foreground"> (optional)</span>
              )}
            </Label>
            <Input
              id={`${meta.id}-key`}
              type="password"
              autoComplete="off"
              value={apiKey}
              placeholder={
                hasStoredKey
                  ? "•••••••• (stored — leave empty to keep)"
                  : meta.keyPlaceholder
              }
              onChange={(e) => setApiKey(e.target.value)}
            />
            {meta.keyHelp && (
              <p className="text-xs text-muted-foreground">{meta.keyHelp}</p>
            )}
          </div>

          {testedModels !== null && (
            <p className="text-xs text-muted-foreground">
              Connection OK — {testedModels} model{testedModels === 1 ? "" : "s"} available.
            </p>
          )}

          <div className="flex flex-wrap items-center gap-2">
            <Button
              variant="outline"
              className="gap-2"
              disabled={incomplete || busy}
              onClick={() => void runTest()}
            >
              {testing ? <Loader2 className="size-4 animate-spin" /> : <Plug className="size-4" />}
              Test connection
            </Button>
            <Button
              className="gap-2"
              disabled={incomplete || busy}
              onClick={() => void runSave()}
            >
              {saving && <Loader2 className="size-4 animate-spin" />}
              {saving ? "Verifying…" : "Save"}
            </Button>
            {config && (
              <Button
                variant="ghost"
                className="ml-auto gap-2 text-destructive hover:text-destructive"
                disabled={busy}
                onClick={() => void runRemove()}
              >
                <Trash2 className="size-4" />
                Remove
              </Button>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
