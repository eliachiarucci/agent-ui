import { useState } from "react"
import { Check, ChevronDown, ChevronsUpDown, Loader2 } from "lucide-react"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { useProviders } from "@/hooks/use-providers"
import { setActiveModel, useActiveModel } from "@/lib/active-model"
import { testProvider, type ProviderConfig, type ProviderType } from "@/lib/api"
import { cn } from "@/lib/utils"

const PROVIDER_LABELS: Record<ProviderType, string> = {
  lmstudio: "LM Studio",
  anthropic: "Anthropic",
  google: "Google",
  deepinfra: "DeepInfra",
}

// Status-bar model picker: a menu of configured providers; clicking one expands
// an indented, live-fetched list of its models. Picking a model makes it the
// active model for subsequent chat requests; "Default" returns to the backend's
// env-configured model.
export function ModelSelector({ fallbackModel }: { fallbackModel?: string }) {
  const { providers } = useProviders()
  const active = useActiveModel()
  const [expanded, setExpanded] = useState<ProviderType | null>(null)
  // undefined = not fetched yet, "loading" = in flight, [] = fetched but empty.
  const [modelsByProvider, setModelsByProvider] = useState<
    Partial<Record<ProviderType, string[] | "loading">>
  >({})

  // A selection whose provider was removed in settings silently falls back to
  // the default model server-side; reflect that here instead of lying.
  const activeConfigured =
    active && providers.some((p) => p.provider === active.provider) ? active : null
  const label = activeConfigured ? activeConfigured.model : (fallbackModel ?? "model")

  const toggleProvider = async (config: ProviderConfig) => {
    const provider = config.provider
    setExpanded((cur) => (cur === provider ? null : provider))
    if (modelsByProvider[provider] !== undefined) return
    setModelsByProvider((cur) => ({ ...cur, [provider]: "loading" }))
    // The stored API key is filled in server-side; LM Studio just needs its URL.
    const { models } = await testProvider(
      provider,
      provider === "lmstudio" ? { url: config.settings.url } : {}
    ).catch(() => ({ models: [] as string[] }))
    const sorted = [...models].sort((a, b) => a.localeCompare(b, undefined, { sensitivity: "base" }))
    setModelsByProvider((cur) => ({ ...cur, [provider]: sorted }))
  }

  return (
    <DropdownMenu
      onOpenChange={(open) => {
        // Fresh model lists (LM Studio's change as models load) per menu open.
        if (open) {
          setExpanded(null)
          setModelsByProvider({})
        }
      }}
    >
      <DropdownMenuTrigger className="flex max-w-56 items-center gap-1 rounded px-1 text-[11px] text-muted-foreground outline-none hover:text-foreground data-[state=open]:text-foreground">
        <span className="truncate">{label}</span>
        <ChevronsUpDown className="size-3 shrink-0" />
      </DropdownMenuTrigger>
      <DropdownMenuContent side="top" align="end" className="w-64">
        <DropdownMenuLabel className="text-xs">Model</DropdownMenuLabel>
        {providers.length === 0 && (
          <div className="px-2 py-1.5 text-xs text-muted-foreground">
            No providers configured — add one in Settings → Models.
          </div>
        )}
        {providers.map((config) => {
          const provider = config.provider
          const models = modelsByProvider[provider]
          const isExpanded = expanded === provider
          return (
            <div key={provider}>
              <DropdownMenuItem
                // Providers expand in place; only model clicks close the menu.
                onSelect={(e) => {
                  e.preventDefault()
                  void toggleProvider(config)
                }}
              >
                <ChevronDown
                  className={cn("size-3.5 transition-transform", !isExpanded && "-rotate-90")}
                />
                {PROVIDER_LABELS[provider]}
              </DropdownMenuItem>
              {isExpanded &&
                (models === "loading" || models === undefined ? (
                  <div className="flex items-center gap-2 py-1.5 pl-8 pr-2 text-xs text-muted-foreground">
                    <Loader2 className="size-3 animate-spin" />
                    Loading models…
                  </div>
                ) : models.length === 0 ? (
                  <div className="py-1.5 pl-8 pr-2 text-xs text-muted-foreground">
                    No models available.
                  </div>
                ) : (
                  models.map((model) => {
                    const isActive =
                      activeConfigured?.provider === provider &&
                      activeConfigured.model === model
                    return (
                      <DropdownMenuItem
                        key={model}
                        className="pl-8 text-xs"
                        onSelect={() => setActiveModel({ provider, model })}
                      >
                        <span className="truncate">{model}</span>
                        {isActive && <Check className="ml-auto size-3.5 shrink-0" />}
                      </DropdownMenuItem>
                    )
                  })
                ))}
            </div>
          )
        })}
        {activeConfigured && (
          <>
            <DropdownMenuSeparator />
            <DropdownMenuItem className="text-xs" onSelect={() => setActiveModel(null)}>
              Use default model
            </DropdownMenuItem>
          </>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
